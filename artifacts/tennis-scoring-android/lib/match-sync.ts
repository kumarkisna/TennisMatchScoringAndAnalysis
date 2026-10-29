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
const activeSyncs = new Map<string, { promise: Promise<void>; rerun: boolean }>();

export function requestMatchSync(userId: string): Promise<void> {
  if (!userId) return Promise.reject(new Error('A signed-in account is required to sync matches.'));
  const active = activeSyncs.get(userId);
  if (active) {
    active.rerun = true;
    return active.promise;
  }

  const entry = { promise: Promise.resolve(), rerun: false };
  entry.promise = (async () => {
    do {
      entry.rerun = false;
      await syncPendingMatches(userId);
    } while (entry.rerun);
  })().finally(() => {
    activeSyncs.delete(userId);
  });
  activeSyncs.set(userId, entry);
  return entry.promise;
}

async function syncPendingMatches(userId: string): Promise<void> {
  const network = await Network.getNetworkStateAsync();
  if (network.isConnected !== true || network.isInternetReachable === false) return;

  const matches = await listSyncableLocalMatches(userId);
  for (const match of matches) {
    try {
      await syncOneMatch(match, userId);
    } catch {
      await setLocalSyncError(
        match.id,
        userId,
        'Sync paused. Your local score is safe.',
      );
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

async function syncOneMatch(initialMatch: LocalMatch, userId: string): Promise<void> {
  let match = await getLocalMatch(initialMatch.id, userId);
  if (!match || match.syncStatus === 'local_only') return;

  const syncToken = match.syncToken ?? Crypto.randomUUID();
  const remote = await syncDeviceMatch(toSyncMatchBody(match, syncToken));
  await saveLocalSyncIdentity(match.id, syncToken, remote.id, userId);

  const requestOptions = {
    headers: { 'X-Match-Sync-Token': syncToken },
  };

  match = await getLocalMatch(match.id, userId);
  if (!match) return;

  let remotePointCount = remote.pointCount;
  for (const pointId of match.pendingPointDeletes) {
    const deleted = await deleteSyncedDevicePoint(remote.id, pointId, requestOptions);
    remotePointCount = deleted.pointCount;
    await markLocalPointDeletesSynced(match.id, [pointId], userId);
  }

  match = await getLocalMatch(match.id, userId);
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
      userId,
    );
  }

  await markLocalPointsSynced(match.id, [], userId);
}
