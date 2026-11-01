export class IntegrationError extends Error {
  code: string;
  constructor(code: string, message: string, cause?: unknown);
}

export function toIntegrationError(error: unknown): IntegrationError;
export function publish<T>(listeners: Set<(value: T) => unknown>, value: T): void;
