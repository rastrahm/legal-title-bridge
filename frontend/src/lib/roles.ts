/**
 * Role gating for operador / verificador actions (buttons enabled from on-chain roles).
 */

export type OperatorRole =
  | "issuer"
  | "operator"
  | "courtExecutor"
  | "guardian"
  | "none";

export type VerifierRole = "verifier" | "attestor" | "none";

export interface RoleFlags {
  issuer: boolean;
  operator: boolean;
  courtExecutor: boolean;
  guardian: boolean;
  verifier: boolean;
  attestor: boolean;
}

export const EMPTY_ROLES: RoleFlags = {
  issuer: false,
  operator: false,
  courtExecutor: false,
  guardian: false,
  verifier: false,
  attestor: false,
};

export function canIssue(roles: RoleFlags): boolean {
  return roles.issuer;
}

export function canPause(roles: RoleFlags): boolean {
  return roles.guardian || roles.operator;
}

export function canCourtOrder(roles: RoleFlags): boolean {
  return roles.courtExecutor;
}

export function canReconcile(roles: RoleFlags): boolean {
  return roles.operator || roles.courtExecutor;
}

export function canSignIdentity(roles: RoleFlags): boolean {
  return roles.verifier;
}

export function canSignAttestation(roles: RoleFlags): boolean {
  return roles.attestor;
}
