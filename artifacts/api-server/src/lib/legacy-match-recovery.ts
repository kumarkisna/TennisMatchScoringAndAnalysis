import { createHash, timingSafeEqual } from "node:crypto";
import { LEGACY_UNASSIGNED_OWNER_ID } from "@workspace/db/schema";

export interface LegacyMatchClaimCandidate {
  id: string;
  ownerId: string;
  syncTokenHash: string | null;
}

export interface LegacyMatchClaimUpdate {
  matchId: string;
  expectedOwnerId: typeof LEGACY_UNASSIGNED_OWNER_ID;
  expectedSyncTokenHash: string;
  newOwnerId: string;
}

export function hashSyncToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function matchesSyncToken(
  storedHash: string | null,
  suppliedToken: string | undefined,
): boolean {
  if (!storedHash || !suppliedToken || !/^[a-f\d]{64}$/i.test(storedHash)) {
    return false;
  }
  const expectedHash = Buffer.from(storedHash, "hex");
  const suppliedHash = Buffer.from(hashSyncToken(suppliedToken), "hex");
  return timingSafeEqual(expectedHash, suppliedHash);
}

export async function claimLegacyMatchOwnership(
  match: LegacyMatchClaimCandidate | null,
  userId: string,
  syncToken: string,
  updateOwnerIfUnchanged: (update: LegacyMatchClaimUpdate) => Promise<boolean>,
): Promise<boolean> {
  if (
    !match ||
    match.ownerId !== LEGACY_UNASSIGNED_OWNER_ID ||
    !userId ||
    userId === LEGACY_UNASSIGNED_OWNER_ID ||
    !matchesSyncToken(match.syncTokenHash, syncToken)
  ) {
    return false;
  }

  return updateOwnerIfUnchanged({
    matchId: match.id,
    expectedOwnerId: LEGACY_UNASSIGNED_OWNER_ID,
    expectedSyncTokenHash: match.syncTokenHash as string,
    newOwnerId: userId,
  });
}
