import assert from "node:assert/strict";
import test from "node:test";
import {
  claimLegacyMatchOwnership,
  hashSyncToken,
  type LegacyMatchClaimCandidate,
  type LegacyMatchClaimUpdate,
} from "./legacy-match-recovery";
import { LEGACY_UNASSIGNED_OWNER_ID } from "@workspace/db/schema";

const syncToken = "old-device-match-sync-token-7fda4e9a";
const legacyMatch: LegacyMatchClaimCandidate = {
  id: "match-legacy-1",
  ownerId: LEGACY_UNASSIGNED_OWNER_ID,
  syncTokenHash: hashSyncToken(syncToken),
};

test("a matching device credential can claim one legacy match", async () => {
  let assignedOwner: string | null = null;
  const recovered = await claimLegacyMatchOwnership(
    legacyMatch,
    "user-owner",
    syncToken,
    async (update) => {
      assignedOwner = update.newOwnerId;
      return true;
    },
  );

  assert.equal(recovered, true);
  assert.equal(assignedOwner, "user-owner");
});

test("invalid or unavailable credentials do not reach the ownership update", async () => {
  let updateCalled = false;
  const updateOwnerIfUnchanged = async () => {
    updateCalled = true;
    return true;
  };

  const invalidToken = await claimLegacyMatchOwnership(
    legacyMatch,
    "user-attacker",
    "incorrect-device-token-7fda4e9a",
    updateOwnerIfUnchanged,
  );
  const missingCredential = await claimLegacyMatchOwnership(
    { ...legacyMatch, syncTokenHash: null },
    "user-attacker",
    syncToken,
    updateOwnerIfUnchanged,
  );
  const alreadyOwned = await claimLegacyMatchOwnership(
    { ...legacyMatch, ownerId: "user-owner" },
    "user-attacker",
    syncToken,
    updateOwnerIfUnchanged,
  );

  assert.equal(invalidToken, false);
  assert.equal(missingCredential, false);
  assert.equal(alreadyOwned, false);
  assert.equal(updateCalled, false);
});

test("competing valid claims allow only one atomic owner transfer", async () => {
  let currentOwner = LEGACY_UNASSIGNED_OWNER_ID;
  const updateOwnerIfUnchanged = async (update: LegacyMatchClaimUpdate) => {
    if (
      currentOwner !== update.expectedOwnerId ||
      update.expectedSyncTokenHash !== legacyMatch.syncTokenHash
    ) {
      return false;
    }
    currentOwner = update.newOwnerId;
    return true;
  };

  const claims = await Promise.all([
    claimLegacyMatchOwnership(
      legacyMatch,
      "user-first",
      syncToken,
      updateOwnerIfUnchanged,
    ),
    claimLegacyMatchOwnership(
      legacyMatch,
      "user-second",
      syncToken,
      updateOwnerIfUnchanged,
    ),
  ]);

  assert.deepEqual(claims.sort(), [false, true]);
  assert.ok(currentOwner === "user-first" || currentOwner === "user-second");
});
