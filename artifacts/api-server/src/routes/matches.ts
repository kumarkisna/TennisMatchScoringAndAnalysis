import { createHash, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { db, tennisMatchesTable, tennisPointsTable } from "@workspace/db";
import {
  CreateMatchBody,
  CreateMatchResponse,
  GetMatchInsightsParams,
  GetMatchInsightsResponse,
  GetMatchParams,
  GetMatchResponse,
  ListMatchesResponse,
  RecordPointBody,
  RecordPointParams,
  RecordPointResponse,
  UndoLatestPointParams,
  UndoLatestPointResponse,
} from "@workspace/api-zod";
import {
  calculateScore,
  getPointContext,
  toMatchRecord,
  type PlayerSide,
} from "../lib/tennis-scoring";

const router: IRouter = Router();

async function fetchMatch(matchId: string) {
  const [match] = await db
    .select()
    .from(tennisMatchesTable)
    .where(eq(tennisMatchesTable.id, matchId));

  if (!match) return null;

  const points = await db
    .select()
    .from(tennisPointsTable)
    .where(eq(tennisPointsTable.matchId, matchId))
    .orderBy(tennisPointsTable.sequenceNumber);

  return { match, points };
}

function hashSyncToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function matchesSyncToken(
  storedHash: string | null,
  suppliedToken: string | undefined,
): boolean {
  if (!storedHash || !suppliedToken) return false;
  const expectedHash = Buffer.from(storedHash, "hex");
  const suppliedHash = Buffer.from(hashSyncToken(suppliedToken), "hex");
  return (
    expectedHash.length === suppliedHash.length &&
    timingSafeEqual(expectedHash, suppliedHash)
  );
}

function hasDeviceSyncAccess(
  req: Request,
  match: { syncTokenHash: string | null },
): boolean {
  return (
    !match.syncTokenHash ||
    matchesSyncToken(match.syncTokenHash, req.get("x-match-sync-token"))
  );
}

router.get("/matches", async (req, res): Promise<void> => {
  const matches = await db
    .select()
    .from(tennisMatchesTable)
    .where(isNull(tennisMatchesTable.syncTokenHash))
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
  const [match] = await db
    .insert(tennisMatchesTable)
    .values({
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

  const record = toMatchRecord(match, []);
  res.status(201).json(CreateMatchResponse.parse(record));
});

router.get("/matches/:id", async (req, res): Promise<void> => {
  const params = GetMatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await fetchMatch(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  if (!hasDeviceSyncAccess(req, result.match)) {
    res.status(404).json({ error: "Match not found" });
    return;
  }

  res.json(GetMatchResponse.parse(toMatchRecord(result.match, result.points)));
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

  const record = await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(tennisMatchesTable)
      .where(eq(tennisMatchesTable.id, params.data.id))
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
    RecordPointResponse.parse(toMatchRecord(record.match, record.points)),
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

    const record = await db.transaction(async (tx) => {
      const [match] = await tx
        .select()
        .from(tennisMatchesTable)
        .where(eq(tennisMatchesTable.id, params.data.id))
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
      UndoLatestPointResponse.parse(toMatchRecord(record.match, record.points)),
    );
  },
);

router.get("/matches/:id/insights", async (req, res): Promise<void> => {
  const params = GetMatchInsightsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const result = await fetchMatch(params.data.id);
  if (!result) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  if (!hasDeviceSyncAccess(req, result.match)) {
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

export default router;
