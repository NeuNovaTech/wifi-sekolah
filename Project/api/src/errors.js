export class AppError extends Error {
  constructor(message, status = 400, errors = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.errors = errors;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
