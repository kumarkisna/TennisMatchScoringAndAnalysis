export type ScoreProgressSide = 'tracked' | 'opponent';

export interface PointScoreProgress {
  trackedScore: string;
  opponentScore: string;
}

interface PointWinner {
  winner: ScoreProgressSide;
}

function standardPointScore(ownPoints: number, otherPoints: number): string {
  if (ownPoints >= 3 && otherPoints >= 3) {
    if (ownPoints > otherPoints) return 'AD';
    return '40';
  }

  return ['0', '15', '30', '40'][ownPoints] ?? '40';
}

export function getStandardPointProgress(
  points: readonly PointWinner[],
): PointScoreProgress[] {
  let trackedPoints = 0;
  let opponentPoints = 0;

  return points.map(({ winner }) => {
    if (winner === 'tracked') trackedPoints += 1;
    else opponentPoints += 1;

    const trackedWonGame =
      trackedPoints >= 4 && trackedPoints - opponentPoints >= 2;
    const opponentWonGame =
      opponentPoints >= 4 && opponentPoints - trackedPoints >= 2;

    return {
      trackedScore: trackedWonGame
        ? 'GAME'
        : standardPointScore(trackedPoints, opponentPoints),
      opponentScore: opponentWonGame
        ? 'GAME'
        : standardPointScore(opponentPoints, trackedPoints),
    };
  });
}

export function getTiebreakPointProgress(
  points: readonly PointWinner[],
): PointScoreProgress[] {
  let trackedPoints = 0;
  let opponentPoints = 0;

  return points.map(({ winner }) => {
    if (winner === 'tracked') trackedPoints += 1;
    else opponentPoints += 1;

    return {
      trackedScore: String(trackedPoints),
      opponentScore: String(opponentPoints),
    };
  });
}
