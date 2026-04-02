// utils/errors.ts
import { NextApiResponse } from 'next';

export enum ErrorCode {
  Unauthorized = 'UNAUTHORIZED',
  NotFound = 'NOT_FOUND',
  InvalidInput = 'INVALID_INPUT',
  MethodNotAllowed = 'METHOD_NOT_ALLOWED',
  InternalServerError = 'INTERNAL_SERVER_ERROR',
}

interface ApiError {
  code: ErrorCode;
  message: string;
  details?: any;
}

export function sendError(
  res: NextApiResponse,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: any
) {
  res.status(statusCode).json({
    error: {
      code,
      message,
      details,
    },
  });
}
