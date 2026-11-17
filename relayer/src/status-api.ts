export const STATUS_API_ALLOWED_METHODS = ['GET'] as const;
export type StatusApiAllowedMethod = (typeof STATUS_API_ALLOWED_METHODS)[number];

export function getStatusApiAllowedMethods(): readonly StatusApiAllowedMethod[] {
  return STATUS_API_ALLOWED_METHODS;
}
