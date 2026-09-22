import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_request, _response, next) =>
  next(new AppError(404, 'Resource not found'));

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;
  if (error instanceof ZodError) {
    response.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request data', details: error.flatten() } });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status = error.code === 'P2025' ? 404 : error.code === 'P2002' ? 409 : 400;
    const code = status === 404 ? 'NOT_FOUND' : status === 409 ? 'CONFLICT' : 'INVALID_DATABASE_OPERATION';
    response.status(status).json({ ok: false, error: { code, message: 'Database operation failed' } });
    return;
  }
  const status = error instanceof AppError ? error.status : 500;
  if (status >= 500) {
    request.log?.error({
      event: 'request_failed',
      errorType: error instanceof Error ? error.name : typeof error,
      errorCode: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
    }, 'Request failed');
  }
  const safeMessage = error instanceof AppError
    ? error.message
    : status === 413
      ? 'Request body is too large'
      : status >= 500
        ? 'Something went wrong'
        : 'Invalid request';
  response.status(status).json({
    ok: false,
    error: {
      code: error instanceof AppError && error.code
        ? error.code
        : status === 413
          ? 'PAYLOAD_TOO_LARGE'
          : status >= 500
            ? 'INTERNAL_ERROR'
            : 'REQUEST_ERROR',
      message: safeMessage,
    },
  });
};
