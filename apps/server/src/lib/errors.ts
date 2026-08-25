export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function err(statusCode: number, code: string, message: string): AppError {
  return new AppError(statusCode, code, message);
}
