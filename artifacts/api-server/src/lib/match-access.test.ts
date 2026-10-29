import assert from "node:assert/strict";
import test from "node:test";
import { canReadMatch } from "./match-access";

test("the owner can read their match", () => {
  assert.equal(canReadMatch("owner-1", "owner-1", [], []), true);
});

test("a different account cannot read an unshared match", () => {
  assert.equal(canReadMatch("owner-1", "viewer-2", ["viewer@example.com"], []), false);
});

test("an explicitly invited verified email can read the match", () => {
  assert.equal(
    canReadMatch("owner-1", "viewer-2", [" Viewer@Example.com "], ["viewer@example.com"]),
    true,
  );
});

test("an unverified or unrelated account remains denied", () => {
  assert.equal(
    canReadMatch("owner-1", "viewer-2", ["viewer@example.com"], ["coach@example.com"]),
    false,
  );
});
