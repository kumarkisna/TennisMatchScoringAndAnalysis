import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import {
  deleteSyncedDevicePoint,
  syncDeviceMatch,
  syncDevicePoints,
} from '@workspace/api-client-react';
import {
  getLocalMatch,
  getLocalSetHistory,
  listSyncableLocalMatches,
  markLocalPointDeletesSynced,
  markLocalPointsSynced,
  saveLocalSyncIdentity,
  setLocalSyncError,
  type LocalMatch,
} from '@/lib/local-matches';

const MAX_POINTS_PER_BATCH = 100;
let activeSync: Promise<void> | null = null;
let syncRequestedAgain = false;

export function requestMatchSync(): Promise<void> {
  if (activeSync) {
    syncRequestedAgain = true;
    return activeSync;
  }

  activeSync = (async () => {
    do {
      syncRequestedAgain = false;
      await syncPendingMatches();
    } while (syncRequestedAgain);
  })().finally(() => {
    const shouldRunAgain = syncRequestedAgain;
    syncRequestedAgain = false;
    activeSync = null;
    if (shouldRunAgain) void requestMatchSync();
  });
  return activeSync;
}

async function syncPendingMatches(): Promise<void> {
  const network = await Network.getNetworkStateAsync();
  if (network.isConnected !== true || network.isInternetReachable === false) return;

  const matches = await listSyncableLocalMatches();
  for (const match of matches) {
    try {
      await syncOneMatch(match);
    } catch {
      await setLocalSyncError(match.id, 'Sync paused. Your local score is safe.');
    }
  }
}

function toSyncMatchBody(match: LocalMatch, syncToken: string) {
  return {
    clientMatchId: match.id,
    syncToken,
    matchDate: match.matchDate,
    event: match.event,
    round: match.round,
    setNumber: match.setNumber,
    trackedPlayer: match.trackedPlayer,
    opponent: match.opponent,
    chairCoach: match.chairCoach,
    surface: match.surface,
    firstServer: match.firstServer,
    status: match.matchStatus,
  };
}

async function syncOneMatch(initialMatch: LocalMatch): Promise<void> {
  let match = await getLocalMatch(initialMatch.id);
  if (!match || match.syncStatus === 'local_only') return;

  const syncToken = match.syncToken ?? Crypto.randomUUID();
  const remote = await syncDeviceMatch(toSyncMatchBody(match, syncToken));
  await saveLocalSyncIdentity(match.id, syncToken, remote.id);

  const requestOptions = {
    headers: { 'X-Match-Sync-Token': syncToken },
  };

  match = await getLocalMatch(match.id);
  if (!match) return;

  let remotePointCount = remote.pointCount;
  for (const pointId of match.pendingPointDeletes) {
    const deleted = await deleteSyncedDevicePoint(remote.id, pointId, requestOptions);
    remotePointCount = deleted.pointCount;
    await markLocalPointDeletesSynced(match.id, [pointId]);
  }

  match = await getLocalMatch(match.id);
  if (!match) return;

  const orderedPoints = getLocalSetHistory(match).flatMap((set) => set.points);
  if (remotePointCount > orderedPoints.length) {
    throw new Error('The remote point log is ahead of the local match.');
  }

  const pending = orderedPoints
    .map((point, index) => ({
      point,
      sequenceNumber: index + 1,
    }))
    .filter(({ point }) => point.syncStatus === 'pending');

  for (let index = 0; index < pending.length; index += MAX_POINTS_PER_BATCH) {
    const batch = pending.slice(index, index + MAX_POINTS_PER_BATCH);
    const response = await syncDevicePoints(
      remote.id,
      {
        points: batch.map(({ point, sequenceNumber }) => ({
          idempotencyKey: point.id,
          sequenceNumber,
          setNumber: point.setNumber,
          gameNumber: point.gameNumber,
          server: point.server,
          isTiebreak: point.isTiebreak,
          winner: point.winner,
          endingCode: point.endingCode,
          firstServeFault: point.firstServeFault,
        })),
      },
      requestOptions,
    );

    const lastSequence = batch[batch.length - 1]?.sequenceNumber ?? 0;
    if (response.nextSequence <= lastSequence) {
      throw new Error('The server did not confirm the full point batch.');
    }
    await markLocalPointsSynced(
      match.id,
      batch.map(({ point }) => point.id),
    );
  }

  await markLocalPointsSynced(match.id, []);
}
