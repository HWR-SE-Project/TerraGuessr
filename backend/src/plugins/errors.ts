/**
 * Shared domain-error base (ADR-0009). Every error the API surface raises on
 * purpose extends `AppError` so the global handler (errorHandler.ts) can map
 * `statusCode` to the HTTP status and the optional `code` to a stable
 * machine-readable code in the error envelope.
 *
 * Modules used to hand-roll near-identical `Error` subclasses, each carrying a
 * different field name (`appCode`, `code`, `statusCode`) that the global
 * handler only partially understood. One base type keeps the envelope uniform:
 * a provider failure is `{ code, message }` in singleplayer and lobbies alike.
 */
export class AppError extends Error {
  public constructor(
    public readonly statusCode: number,
    message: string,
    /** Stable machine-readable code surfaced in the API error envelope. */
    public readonly code?: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
