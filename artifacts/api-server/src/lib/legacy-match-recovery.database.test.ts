import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express, { type RequestHandler } from "express";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@workspace/db/schema";
import {
  LEGACY_UNASSIGNED_OWNER_ID,
  tennisMatchesTable,
} from "@workspace/db/schema";
import { hashSyncToken } from "./legacy-match-recovery";

const { Pool } = pg;
// This integration test only accepts a test database URL and uses a disposable schema.
const testDatabaseUrl = process.env.LEGACY_MATCH_TEST_DATABASE_URL;

test(
  "concurrent database-backed legacy claims have one owner and one inaccessible loser",
  { skip: !testDatabaseUrl },
  async (t) => {
    if (!testDatabaseUrl) {
      throw new Error("LEGACY_MATCH_TEST_DATABASE_URL is required.");
    }

    const priorDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = testDatabaseUrl;

    const schemaName = `legacy_claim_test_${randomUUID().replaceAll("-", "")}`;
    const adminPool = new Pool({ connectionString: testDatabaseUrl, max: 1 });
    let testPool: InstanceType<typeof Pool> | undefined;
    let schemaCreated = false;
    let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;

    t.after(async () => {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => (error ? reject(error) : resolve()));
        });
      }
      await testPool?.end();
      if (schemaCreated) {
        await adminPool.query(`DROP SCHEMA "${schemaName}" CASCADE`);
      }
      await adminPool.end();
      if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = priorDatabaseUrl;
    });

    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    testPool = new Pool({
      connectionString: testDatabaseUrl,
      max: 4,
      options: `-c search_path=${schemaName}`,
    });
    await testPool.query(`
      CREATE TABLE tennis_matches (
        id uuid PRIMARY KEY,
        owner_id text NOT NULL,
        match_date date NOT NULL,
        event text,
        round text,
        set_number integer NOT NULL,
        tracked_player text NOT NULL,
        opponent text NOT NULL,
        chair_coach text,
        surface text NOT NULL,
        first_server text NOT NULL,
        client_match_id text,
        status text NOT NULL,
        sync_token_hash text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE tennis_points (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        match_id uuid NOT NULL,
        sequence_number integer NOT NULL,
        set_number integer NOT NULL,
        game_number integer NOT NULL,
        server text NOT NULL,
        is_tiebreak boolean NOT NULL DEFAULT false,
        winner text NOT NULL,
        ending_code text,
        first_serve_fault boolean NOT NULL DEFAULT false,
        client_point_id text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const database = drizzle(testPool, { schema });
    const matchId = randomUUID();
    const syncToken = `legacy-match-test-${randomUUID()}`;
    await database.insert(tennisMatchesTable).values({
      id: matchId,
      ownerId: LEGACY_UNASSIGNED_OWNER_ID,
      matchDate: "2026-10-30",
      event: "Legacy recovery concurrency test",
      round: "Test",
      setNumber: 1,
      trackedPlayer: "Tracked Player",
      opponent: "Opponent Player",
      chairCoach: null,
      surface: "Hard",
      firstServer: "tracked",
      clientMatchId: null,
      status: "in_progress",
      syncTokenHash: hashSyncToken(syncToken),
    });

    const { createMatchesRouter } = await import("../routes/matches");
    const requireTestUser: RequestHandler = (req, res, next) => {
      if (!req.header("x-test-user")) {
        res.sendStatus(401);
        return;
      }
      next();
    };
    const app = express();
    app.use(express.json());
    app.use(
      createMatchesRouter({
        db: database as never,
        getUserId: (req) => req.header("x-test-user") ?? "",
        getVerifiedEmails: async () => [],
        requireAuth: requireTestUser,
      }),
    );

    server = app.listen(0);
    await new Promise<void>((resolve) => server?.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const request = (userId: string, path: string, init: RequestInit = {}) =>
      fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          "x-test-user": userId,
          ...init.headers,
        },
      });

    const invalidClaim = await request(
      "account-invalid-legacy-claim",
      `/matches/${matchId}/claim-ownership`,
      {
        method: "POST",
        body: JSON.stringify({ syncToken: `invalid-${syncToken}` }),
      },
    );
    assert.equal(invalidClaim.status, 404);
    const invalidClaimBody = await invalidClaim.json();
    assert.deepEqual(invalidClaimBody, {
      error: "Match not found or ownership could not be verified.",
    });

    const claimants = ["account-legacy-claim-a", "account-legacy-claim-b"];
    const claimResponses = await Promise.all(
      claimants.map((userId) =>
        request(userId, `/matches/${matchId}/claim-ownership`, {
          method: "POST",
          body: JSON.stringify({ syncToken }),
        }),
      ),
    );
    const claimBodies = await Promise.all(
      claimResponses.map((response) => response.json()),
    );
    const winnerIndex = claimResponses.findIndex(
      (response) => response.status === 200,
    );
    const loserIndex = claimResponses.findIndex(
      (response) => response.status === 404,
    );

    assert.deepEqual(
      claimResponses.map((response) => response.status).sort((a, b) => a - b),
      [200, 404],
    );
    assert.ok(winnerIndex >= 0);
    assert.ok(loserIndex >= 0);
    assert.deepEqual(claimBodies[winnerIndex], {
      id: matchId,
      ownershipRecovered: true,
    });
    assert.deepEqual(claimBodies[loserIndex], invalidClaimBody);

    const [winnerRead, loserRead] = await Promise.all([
      request(claimants[winnerIndex]!, `/matches/${matchId}`),
      request(claimants[loserIndex]!, `/matches/${matchId}`),
    ]);
    assert.equal(winnerRead.status, 200);
    assert.equal(
      (await winnerRead.json() as { isOwner: boolean }).isOwner,
      true,
    );
    assert.equal(loserRead.status, 404);
    assert.deepEqual(await loserRead.json(), { error: "Match not found" });
  },
);
