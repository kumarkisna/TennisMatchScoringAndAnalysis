import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import express, { type RequestHandler } from "express";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  tennisMatchSharesTable,
  tennisMatchesTable,
  tennisPointsTable,
} from "@workspace/db/schema";

process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/test";

const { createMatchesRouter } = await import("./matches");

const matchId = "00000000-0000-4000-8000-000000000001";
const ownerId = "account-owner";
const invitedViewerId = "account-invited";
const unsharedViewerId = "account-stranger";
const unverifiedViewerId = "account-unverified";
const invitedEmail = "coach@example.test";

function makeMatch() {
  const timestamp = new Date("2026-10-29T12:00:00.000Z");
  return {
    id: matchId,
    ownerId,
    matchDate: "2026-10-29",
    event: "Autumn Open",
    round: "Quarter-final",
    setNumber: 1,
    trackedPlayer: "Tracked Player",
    opponent: "Opponent Player",
    chairCoach: null,
    surface: "Hard",
    firstServer: "tracked",
    clientMatchId: null,
    status: "in_progress",
    syncTokenHash: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

class FakeSelectQuery {
  private table: unknown;
  private condition: unknown;

  constructor(private readonly database: FakeMatchDatabase) {}

  from(table: unknown): this {
    this.table = table;
    return this;
  }

  where(condition: unknown): this {
    this.condition = condition;
    return this;
  }

  orderBy(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  for(): this {
    return this;
  }

  private rows(): unknown[] {
    if (this.table === tennisMatchesTable) {
      if (this.database.inTransaction && this.condition) {
        const query = new PgDialect().sqlToQuery(this.condition as never);
        if (
          query.sql.includes('"owner_id"') &&
          this.database.match.ownerId !== this.database.currentUserId
        ) {
          return [];
        }
      }
      return [this.database.match];
    }
    if (this.table === tennisPointsTable) {
      return [...this.database.points].sort(
        (left, right) => left.sequenceNumber - right.sequenceNumber,
      );
    }
    if (this.table === tennisMatchSharesTable) {
      const verifiedEmails =
        this.database.verifiedEmails[this.database.currentUserId] ?? [];
      return this.database.shares.filter((share) =>
        verifiedEmails.includes(share.inviteEmail),
      );
    }
    return [];
  }

  then(
    onFulfilled?: ((value: unknown[]) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ): Promise<unknown> {
    return Promise.resolve(this.rows()).then(onFulfilled, onRejected);
  }
}

class FakeMatchDatabase {
  readonly match = makeMatch();
  readonly points: Array<Record<string, any>> = [];
  readonly shares = [
    {
      id: "00000000-0000-4000-8000-000000000002",
      matchId,
      inviteEmail: invitedEmail,
      createdBy: ownerId,
      createdAt: new Date("2026-10-29T12:00:00.000Z"),
    },
  ];
  readonly verifiedEmails: Record<string, string[]> = {
    [invitedViewerId]: [invitedEmail],
    [unverifiedViewerId]: [],
    [unsharedViewerId]: [],
  };
  currentUserId = "";
  inTransaction = false;

  select(): FakeSelectQuery {
    return new FakeSelectQuery(this);
  }

  async transaction<T>(work: (transaction: this) => Promise<T>): Promise<T> {
    this.inTransaction = true;
    try {
      return await work(this);
    } finally {
      this.inTransaction = false;
    }
  }

  insert(table: unknown) {
    return {
      values: async (values: Record<string, unknown>) => {
        if (table === tennisPointsTable) {
          this.points.push({
            ...values,
            id: randomUUID(),
            createdAt: new Date("2026-10-29T12:01:00.000Z"),
          });
        }
      },
    };
  }

  update(table: unknown) {
    return {
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            if (table !== tennisMatchesTable) return [];
            Object.assign(this.match, values);
            return [this.match];
          },
        }),
      }),
    };
  }
}

test("HTTP routes keep match reads and writes within owner and verified-share access", async (t) => {
  const database = new FakeMatchDatabase();
  const testAuth: RequestHandler = (req, res, next) => {
    const userId = req.header("x-test-user");
    if (!userId) {
      res.sendStatus(401);
      return;
    }
    database.currentUserId = userId;
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    createMatchesRouter({
      db: database as never,
      getUserId: (req) => req.header("x-test-user") ?? "",
      getVerifiedEmails: async (userId) => database.verifiedEmails[userId] ?? [],
      requireAuth: testAuth,
    }),
  );

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  t.after(
    () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const request = (
    userId: string,
    path: string,
    init: RequestInit = {},
  ) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-test-user": userId,
        ...init.headers,
      },
    });

  const ownerRead = await request(ownerId, `/matches/${matchId}`);
  assert.equal(ownerRead.status, 200);
  const ownerMatch = (await ownerRead.json()) as { isOwner: boolean };
  assert.equal(ownerMatch.isOwner, true);

  const ownerUpdate = await request(ownerId, `/matches/${matchId}/points`, {
    method: "POST",
    body: JSON.stringify({ winner: "tracked" }),
  });
  assert.equal(ownerUpdate.status, 201);
  const ownerUpdatedMatch = (await ownerUpdate.json()) as {
    points: unknown[];
  };
  assert.equal(ownerUpdatedMatch.points.length, 1);
  assert.equal(database.points.length, 1);

  for (const userId of [unsharedViewerId, unverifiedViewerId]) {
    const matchRead = await request(userId, `/matches/${matchId}`);
    assert.equal(matchRead.status, 404);
    assert.deepEqual(await matchRead.json(), { error: "Match not found" });

    const insightsRead = await request(
      userId,
      `/matches/${matchId}/insights`,
    );
    assert.equal(insightsRead.status, 404);
    assert.deepEqual(await insightsRead.json(), { error: "Match not found" });
  }

  const invitedRead = await request(invitedViewerId, `/matches/${matchId}`);
  assert.equal(invitedRead.status, 200);
  const invitedMatch = (await invitedRead.json()) as {
    isOwner: boolean;
    points: unknown[];
  };
  assert.equal(invitedMatch.isOwner, false);
  assert.equal(invitedMatch.points.length, 1);

  const viewerWrite = await request(
    invitedViewerId,
    `/matches/${matchId}/points`,
    {
      method: "POST",
      body: JSON.stringify({ winner: "opponent" }),
    },
  );
  assert.equal(viewerWrite.status, 404);
  assert.deepEqual(await viewerWrite.json(), { error: "Match not found" });
  assert.equal(database.points.length, 1);
});
