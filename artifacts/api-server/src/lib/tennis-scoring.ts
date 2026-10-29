import type { TennisMatch, TennisPoint } from "@workspace/db";

export type PlayerSide = "tracked" | "opponent";
export type TennisPointCode =
  | "A"
  | "F"
  | "B"
  | "V"
  | "O"
  | "P"
  | "N"
  | "L"
  | "W"
  | "D"
  | "FE";

export interface ScoreState {
  trackedGames: number;
  opponentGames: number;
  trackedPoints: string;
  opponentPoints: string;
  trackedTiebreakPoints: number;
  opponentTiebreakPoints: number;
  nextServer: PlayerSide;
  isTiebreak: boolean;
  isComplete: boolean;
  winner: PlayerSide | null;
}

export interface PointRecord {
  id: string;
  sequenceNumber: number;
  setNumber: number;
  gameNumber: number;
  server: PlayerSide;
  isTiebreak: boolean;
  winner: PlayerSide;
  endingCode: TennisPointCode | null;
  firstServeFault: boolean;
  createdAt: string;
}

export interface MatchRecord {
  id: string;
  matchDate: string;
  event: string | null;
  round: string | null;
  setNumber: number;
  trackedPlayer: string;
  opponent: string;
  chairCoach: string | null;
  surface: "Hard" | "Clay" | "Grass" | "Carpet" | "Other";
  firstServer: PlayerSide;
  status: "in_progress" | "complete";
  score: ScoreState;
  points: PointRecord[];
  createdAt: string;
  updatedAt: string;
}

const opposite = (side: PlayerSide): PlayerSide =>
  side === "tracked" ? "opponent" : "tracked";

const pointLabel = (trackedPoints: number, opponentPoints: number, side: PlayerSide): string => {
  const own = side === "tracked" ? trackedPoints : opponentPoints;
  const other = side === "tracked" ? opponentPoints : trackedPoints;

  if (own >= 3 && other >= 3) {
    if (own === other) return "40";
    return own > other ? "AD" : "40";
  }

  return ["0", "15", "30", "40"][own] ?? "40";
};

export function getGameServer(
  firstServer: PlayerSide,
  gameNumber: number,
): PlayerSide {
  return gameNumber % 2 === 1 ? firstServer : opposite(firstServer);
}

export function getTiebreakServer(
  firstServer: PlayerSide,
  tiebreakPointCount: number,
): PlayerSide {
  if (tiebreakPointCount === 0) return firstServer;
  const serviceBlock = Math.ceil(tiebreakPointCount / 2);
  return serviceBlock % 2 === 1 ? opposite(firstServer) : firstServer;
}

export function getPointContext(
  match: Pick<TennisMatch, "firstServer">,
  points: Pick<TennisPoint, "isTiebreak">[],
  score: ScoreState,
): { gameNumber: number; server: PlayerSide; isTiebreak: boolean } {
  const gameNumber = score.trackedGames + score.opponentGames + 1;
  const isTiebreak =
    !score.isComplete &&
    score.trackedGames === 6 &&
    score.opponentGames === 6;

  if (isTiebreak) {
    const tiebreakPointCount = points.filter((point) => point.isTiebreak).length;
    return {
      gameNumber,
      server: getTiebreakServer(
        match.firstServer as PlayerSide,
        tiebreakPointCount,
      ),
      isTiebreak: true,
    };
  }

  return {
    gameNumber,
    server: getGameServer(match.firstServer as PlayerSide, gameNumber),
    isTiebreak: false,
  };
}

export function calculateScore(
  match: Pick<TennisMatch, "firstServer">,
  points: Pick<TennisPoint, "winner" | "isTiebreak">[],
): ScoreState {
  let trackedGames = 0;
  let opponentGames = 0;
  let trackedGamePoints = 0;
  let opponentGamePoints = 0;
  let trackedTiebreakPoints = 0;
  let opponentTiebreakPoints = 0;
  let winner: PlayerSide | null = null;

  for (const point of points) {
    const pointWinner = point.winner as PlayerSide;

    if (point.isTiebreak) {
      if (pointWinner === "tracked") trackedTiebreakPoints += 1;
      else opponentTiebreakPoints += 1;

      if (
        Math.max(trackedTiebreakPoints, opponentTiebreakPoints) >= 7 &&
        Math.abs(trackedTiebreakPoints - opponentTiebreakPoints) >= 2
      ) {
        if (trackedTiebreakPoints > opponentTiebreakPoints) {
          trackedGames = 7;
          opponentGames = 6;
          winner = "tracked";
        } else {
          trackedGames = 6;
          opponentGames = 7;
          winner = "opponent";
        }
      }
      continue;
    }

    if (pointWinner === "tracked") trackedGamePoints += 1;
    else opponentGamePoints += 1;

    if (
      Math.max(trackedGamePoints, opponentGamePoints) >= 4 &&
      Math.abs(trackedGamePoints - opponentGamePoints) >= 2
    ) {
      if (trackedGamePoints > opponentGamePoints) trackedGames += 1;
      else opponentGames += 1;

      trackedGamePoints = 0;
      opponentGamePoints = 0;

      if (
        (trackedGames >= 6 && trackedGames - opponentGames >= 2) ||
        (opponentGames >= 6 && opponentGames - trackedGames >= 2)
      ) {
        winner = trackedGames > opponentGames ? "tracked" : "opponent";
      }
    }
  }

  const isComplete = winner !== null;
  const isTiebreak =
    !isComplete && trackedGames === 6 && opponentGames === 6;
  const gameNumber = trackedGames + opponentGames + 1;
  const nextServer = isTiebreak
    ? getTiebreakServer(
        match.firstServer as PlayerSide,
        trackedTiebreakPoints + opponentTiebreakPoints,
      )
    : getGameServer(match.firstServer as PlayerSide, gameNumber);

  return {
    trackedGames,
    opponentGames,
    trackedPoints: isTiebreak
      ? String(trackedTiebreakPoints)
      : pointLabel(trackedGamePoints, opponentGamePoints, "tracked"),
    opponentPoints: isTiebreak
      ? String(opponentTiebreakPoints)
      : pointLabel(trackedGamePoints, opponentGamePoints, "opponent"),
    trackedTiebreakPoints,
    opponentTiebreakPoints,
    nextServer,
    isTiebreak,
    isComplete,
    winner,
  };
}

export function toPointRecord(point: TennisPoint): PointRecord {
  return {
    id: point.id,
    sequenceNumber: point.sequenceNumber,
    setNumber: point.setNumber,
    gameNumber: point.gameNumber,
    server: point.server as PlayerSide,
    isTiebreak: point.isTiebreak,
    winner: point.winner as PlayerSide,
    endingCode: point.endingCode as TennisPointCode | null,
    firstServeFault: point.firstServeFault,
    createdAt: point.createdAt.toISOString(),
  };
}

export function toMatchRecord(
  match: TennisMatch,
  points: TennisPoint[],
): MatchRecord {
  const score = calculateScore(match, points);
  return {
    id: match.id,
    matchDate: match.matchDate,
    event: match.event,
    round: match.round,
    setNumber: match.setNumber,
    trackedPlayer: match.trackedPlayer,
    opponent: match.opponent,
    chairCoach: match.chairCoach,
    surface: match.surface as MatchRecord["surface"],
    firstServer: match.firstServer as PlayerSide,
    status: score.isComplete ? "complete" : "in_progress",
    score,
    points: points.map(toPointRecord),
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
  };
}
