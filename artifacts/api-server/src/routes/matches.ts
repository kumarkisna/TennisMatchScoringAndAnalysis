import { and, desc, eq, exists, inArray, or } from "drizzle-orm";
import {
  Router,
  type IRouter,
  type Request,
  type RequestHandler,
} from "express";
import {
  clerkClient as defaultClerkClient,
  getAuth as clerkGetAuth,
} from "@clerk/express";
import {
  db as defaultDb,
  tennisMatchSharesTable,
  tennisMatchesTable,
  tennisPointsTable,
} from "@workspace/db";
import {
  ClaimLegacyMatchOwnershipBody,
  ClaimLegacyMatchOwnershipParams,
  ClaimLegacyMatchOwnershipResponse,
  CreateMatchShareBody,
  CreateMatchShareParams,
  CreateMatchShareResponse,
  CreateMatchBody,
  CreateMatchResponse,
  DeleteSyncedDevicePointParams,
  DeleteSyncedDevicePointResponse,
  DeleteMatchShareParams,
  GetMatchInsightsParams,
  GetMatchInsightsResponse,
  GetMatchParams,
  GetMatchResponse,
  ListMatchSharesParams,
  ListMatchSharesResponse,
  ListMatchesResponse,
  RecordPointBody,
  RecordPointParams,
  RecordPointResponse,
  SyncDeviceMatchBody,
  SyncDeviceMatchResponse,
  SyncDevicePointsBody,
  SyncDevicePointsParams,
  SyncDevicePointsResponse,
  UndoLatestPointParams,
  UndoLatestPointResponse,
} from "@workspace/api-zod";
import { requireAuth as defaultRequireAuth } from "../middlewares/require-auth";
import { canReadMatch, normalizeInviteEmail } from "../lib/match-access";
import {
  claimLegacyMatchOwnership,
  hashSyncToken,
  matchesSyncToken,
} from "../lib/legacy-match-recovery";
import {
  calculateScore,
  getPointContext,
  toMatchRecord,
  type PlayerSide,
} from "../lib/tennis-scoring";

function getAuthenticatedUserId(req: Request): string {
  const userId = clerkGetAuth(req).userId;
  if (!userId) throw new Error("Authentication middleware did not provide a user.");
  return userId;
}

async function getVerifiedEmailsForUser(userId: string): Promise<string[]> {
  const user = await defaultClerkClient.users.getUser(userId);
  return user.emailAddresses
    .filter((address) => address.verification?.status === "verified")
    .map((address) => normalizeInviteEmail(address.emailAddress));
}

export interface MatchesRouterDependencies {
  db?: typeof defaultDb;
  getUserId?: (req: Request) => string;
  getVerifiedEmails?: (userId: string) => Promise<string[]>;
  requireAuth?: RequestHandler;
}

export function createMatchesRouter(
  dependencies: MatchesRouterDependencies = {},
): IRouter {
  const db = dependencies.db ?? defaultDb;
  const getUserId = dependencies.getUserId ?? getAuthenticatedUserId;
  const getVerifiedEmails =
    dependencies.getVerifiedEmails ?? getVerifiedEmailsForUser;
  const requireAuth = dependencies.requireAuth ?? defaultRequireAuth;

  const router: IRouter = Router();
  router.use(requireAuth);

  async function fetchMatch(matchId: string, userId: string) {
    const [match] = await db
      .select()
      .from(tennisMatchesTable)
      .where(eq(tennisMatchesTable.id, matchId));

    if (!match) return null;

    const isOwner = match.ownerId === userId;
    if (!isOwner) {
      const verifiedEmails = await getVerifiedEmails(userId);
      const shares =
        verifiedEmails.length === 0
          ? []
          : await db
              .select({ inviteEmail: tennisMatchSharesTable.inviteEmail })
              .from(tennisMatchSharesTable)
              .where(
                and(
                  eq(tennisMatchSharesTable.matchId, matchId),
                  inArray(tennisMatchSharesTable.inviteEmail, verifiedEmails),
                ),
              );
      if (
        !canReadMatch(
          match.ownerId,
          userId,
          verifiedEmails,
          shares.map((share) => share.inviteEmail),
        )
      ) {
        return null;
      }
    }

    const points = await db
      .select()
      .from(tennisPointsTable)
      .where(eq(tennisPointsTable.matchId, matchId))
      .orderBy(tennisPointsTable.sequenceNumber);

    return { match, points, isOwner };
  }

router.post(
  "/matches/:id/claim-ownership",
  async (req, res): Promise<void> => {
    const params = ClaimLegacyMatchOwnershipParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = ClaimLegacyMatchOwnershipBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const userId = getUserId(req);
    const recovered = await db.transaction(async (tx) => {
      const [match] = await tx
        .select({
          id: tennisMatchesTable.id,
          ownerId: tennisMatchesTable.ownerId,
          syncTokenHash: tennisMatchesTable.syncTokenHash,
        })
        .from(tennisMatchesTable)
        .where(eq(tennisMatchesTable.id, params.data.id))
        .for("update");

      return claimLegacyMatchOwnership(
        match ?? null,
        userId,
        body.data.syncToken,
        async (update) => {
          const [claimed] = await tx
            .update(tennisMatchesTable)
            .set({ ownerId: update.newOwnerId })
            .where(
              and(
                eq(tennisMatchesTable.id, update.matchId),
                eq(tennisMatchesTable.ownerId, update.expectedOwnerId),
                eq(
                  tennisMatchesTable.syncTokenHash,
                  update.expectedSyncTokenHash,
                ),
              ),
            )
            .returning({ id: tennisMatchesTable.id });
          return Boolean(claimed);
        },
      );
    });

    if (!recovered) {
      res.status(404).json({
        error: "Match not found or ownership could not be verified.",
      });
      return;
    }

    res.json(
      ClaimLegacyMatchOwnershipResponse.parse({
        id: params.data.id,
        ownershipRecovered: true,
      }),
    );
  },
);

router.post("/matches/device-sync", async (req, res): Promise<void> => {
  const parsed = SyncDeviceMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const userId = getUserId(req);
  const syncTokenHash = hashSyncToken(data.syncToken);
  const result = await db.transaction(async (tx) => {
    let [match] = await tx
      .select()
      .from(tennisMatchesTable)
      .where(
        and(
          eq(tennisMatchesTable.clientMatchId, data.clientMatchId),
          eq(tennisMatchesTable.ownerId, userId),
        ),
      )
      .for("update");

    if (match && !matchesSyncToken(match.syncTokenHash, data.syncToken)) {
      return { error: "unauthorized" as const };
    }

    if (!match) {
      const [created] = await tx
        .insert(tennisMatchesTable)
        .values({
          ownerId: userId,
          clientMatchId: data.clientMatchId,
          syncTokenHash,
          matchDate: data.matchDate.toISOString().slice(0, 10),
          event: data.event ?? null,
          round: data.round ?? null,
          setNumber: data.setNumber,
          trackedPlayer: data.trackedPlayer.trim(),
          opponent: data.opponent.trim(),
          chairCoach: data.chairCoach ?? null,
          surface: data.surface,
          firstServer: data.firstServer,
          status: data.status,
        })
        .onConflictDoNothing()
        .returning();

      if (created) {
        match = created;
      } else {
        [match] = await tx
          .select()
          .from(tennisMatchesTable)
          .where(
            and(
              eq(tennisMatchesTable.clientMatchId, data.clientMatchId),
              eq(tennisMatchesTable.ownerId, userId),
            ),
          )
          .for("update");
      }

      if (!match) return { error: "not_found" as const };
      if (!matchesSyncToken(match.syncTokenHash, data.syncToken)) {
        return { error: "unauthorized" as const };
      }
    }

    const [updated] = await tx
      .update(tennisMatchesTable)
      .set({
        matchDate: data.matchDate.toISOString().slice(0, 10),
        event: data.event ?? null,
        round: data.round ?? null,
        setNumber: data.setNumber,
        trackedPlayer: data.trackedPlayer.trim(),
        opponent: data.opponent.trim(),
        chairCoach: data.chairCoach ?? null,
        surface: data.surface,
        firstServer: data.firstServer,
        status: data.status,
        syncTokenHash,
      })
      .where(eq(tennisMatchesTable.id, match.id))
      .returning();
    const points = await tx
      .select()
      .from(tennisPointsTable)
      .where(eq(tennisPointsTable.matchId, updated.id));

    return {
      id: updated.id,
      clientMatchId: data.clientMatchId,
      pointCount: points.length,
      nextSequence: points.length + 1,
    };
  });

  if ("error" in result) {
    res.status(result.error === "unauthorized" ? 401 : 404).json({
      error:
        result.error === "unauthorized"
          ? "Device sync credential is invalid"
          : "Match could not be synchronized",
    });
    return;
  }

  res.json(SyncDeviceMatchResponse.parse(result));
});

router.get("/matches", async (req, res): Promise<void> => {
  const userId = getUserId(req);
  const verifiedEmails = await getVerifiedEmails(userId);
  const visibility =
    verifiedEmails.length === 0
      ? eq(tennisMatchesTable.ownerId, userId)
      : or(
          eq(tennisMatchesTable.ownerId, userId),
          exists(
            db
              .select({ id: tennisMatchSharesTable.id })
              .from(tennisMatchSharesTable)
              .where(
                and(
                  eq(tennisMatchSharesTable.matchId, tennisMatchesTable.id),
                  inArray(tennisMatchSharesTable.inviteEmail, verifiedEmails),
                ),
              ),
          ),
        );
  const matches = await db
    .select()
    .from(tennisMatchesTable)
    .where(visibility)
    .orderBy(desc(tennisMatchesTable.updatedAt))
    .limit(50);

  if (matches.length === 0) {
    res.json(ListMatchesResponse.parse([]));
    return;
  }

  const ids = matches.map((match) => match.id);
  const points = await db
    .select()
    .from(tennisPointsTable)
    .where(inArray(tennisPointsTable.matchId, ids))
    .orderBy(tennisPointsTable.sequenceNumber);
  const pointsByMatch = new Map<string, typeof points>();

  for (const point of points) {
    const group = pointsByMatch.get(point.matchId) ?? [];
    group.push(point);
    pointsByMatch.set(point.matchId, group);
  }

  const items = matches.map((match) => {
    const matchPoints = pointsByMatch.get(match.id) ?? [];
    const score = calculateScore(match, matchPoints);
    return {
      id: match.id,
      matchDate: match.matchDate,
      event: match.event,
      round: match.round,
      setNumber: match.setNumber,
      trackedPlayer: match.trackedPlayer,
      opponent: match.opponent,
      surface: match.surface,
      status: score.isComplete ? "complete" : "in_progress",
      trackedGames: score.trackedGames,
      opponentGames: score.opponentGames,
      pointCount: matchPoints.length,
      winner: score.winner,
      updatedAt: match.updatedAt.toISOString(),
      isOwner: match.ownerId === userId,
    };
  });

  res.json(ListMatchesResponse.parse(items));
});

router.post("/matches", async (req, res): Promise<void> => {
  const parsed = CreateMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const userId = getUserId(req);
  const [match] = await db
    .insert(tennisMatchesTable)
    .values({
      ownerId: userId,
      matchDate: data.matchDate.toISOString().slice(0, 10),
      event: data.event ?? null,
      round: data.round ?? null,
      setNumber: data.setNumber,
      trackedPlayer: data.trackedPlayer.trim(),
      opponent: data.opponent.trim(),
      chairCoach: data.chairCoach ?? null,
      surface: data.surface,
      firstServer: data.firstServer,
      status: "in_progress",
    })
    .returning();

  const record = { ...toMatchRecord(match, []), isOwner: true };
  res.status(201).json(CreateMatchResponse.parse(record));
});

router.post(
  "/matches/:id/sync-points",
  async (req, res): Promise<void> => {
    const params = SyncDevicePointsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const token = req.get("x-match-sync-token");
    if (!token) {
      res.status(401).json({ error: "Device sync credential is required" });
      return;
    }
    const userId = getUserId(req);
    const body = SyncDevicePointsBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const idempotencyKeys = new Set<string>();
    let previousSequence = 0;
    for (const point of body.data.points) {
      if (
        idempotencyKeys.has(point.idempotencyKey) ||
        point.sequenceNumber <= previousSequence
      ) {
        res.status(400).json({
          error: "Point idempotency keys must be unique and points must be ordered.",
        });
        return;
      }
      idempotencyKeys.add(point.idempotencyKey);
      previousSequence = point.sequenceNumber;
    }

    const result = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(tennisMatchesTable)
        .where(
          and(
            eq(tennisMatchesTable.id, params.data.id),
            eq(tennisMatchesTable.ownerId, userId),
          ),
        )
        .for("update");
      if (!match) return { error: "not_found" as const };
      if (
        !match.syncTokenHash ||
        !matchesSyncToken(match.syncTokenHash, token)
      ) {
        return { error: "unauthorized" as const };
      }

      const points = await tx
        .select()
        .from(tennisPointsTable)
        .where(eq(tennisPointsTable.matchId, match.id))
        .orderBy(tennisPointsTable.sequenceNumber);
      const byClientPointId = new Map(
        points
          .filter((point) => point.clientPointId !== null)
          .map((point) => [point.clientPointId as string, point]),
      );
      const pointsToInsert: typeof body.data.points = [];
      let expectedSequence = points.length + 1;

      for (const point of body.data.points) {
        const existing = byClientPointId.get(point.idempotencyKey);
        if (existing) {
          const samePoint =
            existing.sequenceNumber === point.sequenceNumber &&
            existing.setNumber === point.setNumber &&
            existing.gameNumber === point.gameNumber &&
            existing.server === point.server &&
            existing.isTiebreak === point.isTiebreak &&
            existing.winner === point.winner &&
            existing.endingCode === (point.endingCode ?? null) &&
            existing.firstServeFault === point.firstServeFault;
          if (!samePoint) return { error: "idempotency_conflict" as const };
          continue;
        }

        if (point.sequenceNumber !== expectedSequence) {
          return {
            error: "sequence_conflict" as const,
            expectedSequence,
          };
        }
        pointsToInsert.push(point);
        expectedSequence += 1;
      }

      for (const point of pointsToInsert) {
        const [inserted] = await tx
          .insert(tennisPointsTable)
          .values({
            matchId: match.id,
            clientPointId: point.idempotencyKey,
            sequenceNumber: point.sequenceNumber,
            setNumber: point.setNumber,
            gameNumber: point.gameNumber,
            server: point.server,
            isTiebreak: point.isTiebreak,
            winner: point.winner,
            endingCode: point.endingCode ?? null,
            firstServeFault: point.firstServeFault,
          })
          .returning();
        points.push(inserted);
        byClientPointId.set(point.idempotencyKey, inserted);
      }

      await tx
        .update(tennisMatchesTable)
        .set({ updatedAt: new Date() })
        .where(eq(tennisMatchesTable.id, match.id));

      return {
        pointCount: points.length,
        nextSequence: points.length + 1,
      };
    });

    if ("error" in result) {
      if (result.error === "unauthorized") {
        res.status(401).json({ error: "Device sync credential is invalid" });
        return;
      }
      if (result.error === "idempotency_conflict") {
        res.status(409).json({
          error: "An idempotency key was reused with different point data.",
        });
        return;
      }
      if (result.error === "sequence_conflict") {
        res.status(409).json({
          error: `Expected point sequence ${result.expectedSequence}.`,
          expectedSequence: result.expectedSequence,
        });
        return;
      }
      res.status(404).json({ error: "Match not found" });
      return;
    }

    res.json(SyncDevicePointsResponse.parse(result));
  },
);

router.delete(
  "/matches/:id/sync-points/:pointId",
  async (req, res): Promise<void> => {
    const params = DeleteSyncedDevicePointParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const token = req.get("x-match-sync-token");
    if (!token) {
      res.status(401).json({ error: "Device sync credential is required" });
      return;
    }
    const userId = getUserId(req);

    const result = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(tennisMatchesTable)
        .where(
          and(
            eq(tennisMatchesTable.id, params.data.id),
            eq(tennisMatchesTable.ownerId, userId),
          ),
        )
        .for("update");
      if (!match) return { error: "not_found" as const };
      if (
        !match.syncTokenHash ||
        !matchesSyncToken(match.syncTokenHash, token)
      ) {
        return { error: "unauthorized" as const };
      }

      const [point] = await tx
        .select()
        .from(tennisPointsTable)
        .where(
          and(
            eq(tennisPointsTable.matchId, match.id),
            eq(tennisPointsTable.clientPointId, params.data.pointId),
          ),
        );
      const points = await tx
        .select()
        .from(tennisPointsTable)
        .where(eq(tennisPointsTable.matchId, match.id))
        .orderBy(desc(tennisPointsTable.sequenceNumber));

      if (!point) {
        return {
          deleted: false,
          pointCount: points.length,
          nextSequence: points.length + 1,
        };
      }
      if (points[0]?.id !== point.id) {
        return { error: "not_latest" as const };
      }

      await tx
        .delete(tennisPointsTable)
        .where(
          and(
            eq(tennisPointsTable.matchId, match.id),
            eq(tennisPointsTable.id, point.id),
          ),
        );
      await tx
        .update(tennisMatchesTable)
        .set({ status: "in_progress", updatedAt: new Date() })
        .where(eq(tennisMatchesTable.id, match.id));

      return {
        deleted: true,
        pointCount: points.length - 1,
        nextSequence: points.length,
      };
    });

    if ("error" in result) {
      if (result.error === "unauthorized") {
        res.status(401).json({ error: "Device sync credential is invalid" });
        return;
      }
      if (result.error === "not_latest") {
        res.status(409).json({
          error: "Only the latest synchronized point can be undone.",
        });
        return;
      }
      res.status(404).json({ error: "Match not found" });
      return;
    }

    res.json(DeleteSyncedDevicePointResponse.parse(result));
  },
);

router.get("/matches/:id", async (req, res): Promise<void> => {
  const params = GetMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await fetchMatch(params.data.id, getUserId(req));
  if (!result) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  res.json(
    GetMatchResponse.parse({
      ...toMatchRecord(result.match, result.points),
      isOwner: result.isOwner,
    }),
  );
});

router.post("/matches/:id/points", async (req, res): Promise<void> => {
  const params = RecordPointParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = RecordPointBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = getUserId(req);
  const record = await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(tennisMatchesTable)
      .where(
        and(
          eq(tennisMatchesTable.id, params.data.id),
          eq(tennisMatchesTable.ownerId, userId),
        ),
      )
      .for("update");
    if (!match) return { error: "not_found" as const };
    if (match.syncTokenHash) return { error: "private" as const };

    const points = await tx
      .select()
      .from(tennisPointsTable)
      .where(eq(tennisPointsTable.matchId, match.id))
      .orderBy(tennisPointsTable.sequenceNumber);
    const score = calculateScore(match, points);
    if (score.isComplete) return { error: "complete" as const };

    const context = getPointContext(match, points, score);
    await tx.insert(tennisPointsTable).values({
      matchId: match.id,
      sequenceNumber: points.length + 1,
      setNumber: match.setNumber,
      gameNumber: context.gameNumber,
      server: context.server,
      isTiebreak: context.isTiebreak,
      winner: body.data.winner,
      endingCode: body.data.endingCode ?? null,
      firstServeFault: body.data.firstServeFault ?? false,
    });

    const updatedPoints = await tx
      .select()
      .from(tennisPointsTable)
      .where(eq(tennisPointsTable.matchId, match.id))
      .orderBy(tennisPointsTable.sequenceNumber);
    const updatedScore = calculateScore(match, updatedPoints);
    const [updatedMatch] = await tx
      .update(tennisMatchesTable)
      .set({ status: updatedScore.isComplete ? "complete" : "in_progress" })
      .where(eq(tennisMatchesTable.id, match.id))
      .returning();

    return {
      match: updatedMatch,
      points: updatedPoints,
    };
  });

  if ("error" in record) {
    if (record.error === "not_found") {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (record.error === "private") {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    res.status(409).json({ error: "This set is already complete" });
    return;
  }

  res.status(201).json(
    RecordPointResponse.parse({
      ...toMatchRecord(record.match, record.points),
      isOwner: true,
    }),
  );
});

router.delete(
  "/matches/:id/points/latest",
  async (req, res): Promise<void> => {
    const params = UndoLatestPointParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const userId = getUserId(req);
    const record = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(tennisMatchesTable)
        .where(
          and(
            eq(tennisMatchesTable.id, params.data.id),
            eq(tennisMatchesTable.ownerId, userId),
          ),
        )
        .for("update");
      if (!match) return { error: "not_found" as const };
      if (match.syncTokenHash) return { error: "private" as const };

      const [latest] = await tx
        .select()
        .from(tennisPointsTable)
        .where(eq(tennisPointsTable.matchId, match.id))
        .orderBy(desc(tennisPointsTable.sequenceNumber))
        .limit(1);
      if (!latest) return { error: "empty" as const };

      await tx
        .delete(tennisPointsTable)
        .where(
          and(
            eq(tennisPointsTable.matchId, match.id),
            eq(tennisPointsTable.id, latest.id),
          ),
        );

      const points = await tx
        .select()
        .from(tennisPointsTable)
        .where(eq(tennisPointsTable.matchId, match.id))
        .orderBy(tennisPointsTable.sequenceNumber);
      const score = calculateScore(match, points);
      const [updatedMatch] = await tx
        .update(tennisMatchesTable)
        .set({ status: score.isComplete ? "complete" : "in_progress" })
        .where(eq(tennisMatchesTable.id, match.id))
        .returning();

      return { match: updatedMatch, points };
    });

    if ("error" in record) {
      if (record.error === "private") {
        res.status(404).json({ error: "Match not found" });
        return;
      }
      res.status(404).json({
        error:
          record.error === "not_found"
            ? "Match not found"
            : "There is no point to undo",
      });
      return;
    }

    res.json(
      UndoLatestPointResponse.parse({
        ...toMatchRecord(record.match, record.points),
        isOwner: true,
      }),
    );
  },
);

router.get("/matches/:id/insights", async (req, res): Promise<void> => {
  const params = GetMatchInsightsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await fetchMatch(params.data.id, getUserId(req));
  if (!result) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  const codeStats = new Map<
    string,
    { count: number; trackedWon: number; opponentWon: number }
  >();
  let trackedPointsWon = 0;
  let opponentPointsWon = 0;
  let firstServeFaults = 0;
  let servicePointsWon = 0;
  let returnPointsWon = 0;

  for (const point of result.points) {
    const winner = point.winner as PlayerSide;
    if (winner === "tracked") trackedPointsWon += 1;
    else opponentPointsWon += 1;
    if (point.firstServeFault) firstServeFaults += 1;
    if (winner === "tracked" && point.server === "tracked") {
      servicePointsWon += 1;
    }
    if (winner === "tracked" && point.server === "opponent") {
      returnPointsWon += 1;
    }
    if (point.endingCode) {
      const stats = codeStats.get(point.endingCode) ?? {
        count: 0,
        trackedWon: 0,
        opponentWon: 0,
      };
      stats.count += 1;
      if (winner === "tracked") stats.trackedWon += 1;
      else stats.opponentWon += 1;
      codeStats.set(point.endingCode, stats);
    }
  }

  const insights = {
    pointCount: result.points.length,
    trackedPointsWon,
    opponentPointsWon,
    firstServeFaults,
    codes: [...codeStats.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, stats]) => ({ code, ...stats })),
    returnPointsWon,
    servicePointsWon,
  };

  res.json(GetMatchInsightsResponse.parse(insights));
});

router.get("/matches/:id/shares", async (req, res): Promise<void> => {
  const params = ListMatchSharesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = getUserId(req);
  const [match] = await db
    .select({ id: tennisMatchesTable.id })
    .from(tennisMatchesTable)
    .where(
      and(
        eq(tennisMatchesTable.id, params.data.id),
        eq(tennisMatchesTable.ownerId, userId),
      ),
    );
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const shares = await db
    .select()
    .from(tennisMatchSharesTable)
    .where(eq(tennisMatchSharesTable.matchId, match.id))
    .orderBy(tennisMatchSharesTable.createdAt);
  res.json(
    ListMatchSharesResponse.parse(
      shares.map((share) => ({
        id: share.id,
        email: share.inviteEmail,
        createdAt: share.createdAt.toISOString(),
      })),
    ),
  );
});

router.post("/matches/:id/shares", async (req, res): Promise<void> => {
  const params = CreateMatchShareParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = CreateMatchShareBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = getUserId(req);
  const [match] = await db
    .select({ id: tennisMatchesTable.id })
    .from(tennisMatchesTable)
    .where(
      and(
        eq(tennisMatchesTable.id, params.data.id),
        eq(tennisMatchesTable.ownerId, userId),
      ),
    );
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  const email = normalizeInviteEmail(body.data.email);
  const [share] = await db
    .insert(tennisMatchSharesTable)
    .values({ matchId: match.id, inviteEmail: email, createdBy: userId })
    .onConflictDoUpdate({
      target: [
        tennisMatchSharesTable.matchId,
        tennisMatchSharesTable.inviteEmail,
      ],
      set: { createdBy: userId },
    })
    .returning();
  res.status(201).json(
    CreateMatchShareResponse.parse({
      id: share.id,
      email: share.inviteEmail,
      createdAt: share.createdAt.toISOString(),
    }),
  );
});

router.delete(
  "/matches/:id/shares/:shareId",
  async (req, res): Promise<void> => {
    const params = DeleteMatchShareParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const userId = getUserId(req);
    const deleted = await db
      .delete(tennisMatchSharesTable)
      .where(
        and(
          eq(tennisMatchSharesTable.matchId, params.data.id),
          eq(tennisMatchSharesTable.id, params.data.shareId),
          exists(
            db
              .select({ id: tennisMatchesTable.id })
              .from(tennisMatchesTable)
              .where(
                and(
                  eq(tennisMatchesTable.id, tennisMatchSharesTable.matchId),
                  eq(tennisMatchesTable.ownerId, userId),
                ),
              ),
          ),
        ),
      )
      .returning({ id: tennisMatchSharesTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Match or viewer not found" });
      return;
    }
    res.sendStatus(204);
  },
);

  return router;
}

const router = createMatchesRouter();

export default router;
