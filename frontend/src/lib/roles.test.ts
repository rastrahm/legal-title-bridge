import { describe, expect, it } from "vitest";

import {
  EMPTY_ROLES,
  canCourtOrder,
  canIssue,
  canPause,
  canReconcile,
  canSignAttestation,
  canSignIdentity,
} from "./roles";

describe("roles", () => {
  it("gates actions by role flags", () => {
    expect(canIssue(EMPTY_ROLES)).toBe(false);
    expect(canIssue({ ...EMPTY_ROLES, issuer: true })).toBe(true);
    expect(canPause({ ...EMPTY_ROLES, guardian: true })).toBe(true);
    expect(canPause({ ...EMPTY_ROLES, operator: true })).toBe(true);
    expect(canCourtOrder({ ...EMPTY_ROLES, courtExecutor: true })).toBe(true);
    expect(canReconcile({ ...EMPTY_ROLES, operator: true })).toBe(true);
    expect(canReconcile({ ...EMPTY_ROLES, courtExecutor: true })).toBe(true);
    expect(canSignIdentity({ ...EMPTY_ROLES, verifier: true })).toBe(true);
    expect(canSignAttestation({ ...EMPTY_ROLES, attestor: true })).toBe(true);
  });
});
