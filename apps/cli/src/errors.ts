export class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitCode: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
