import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error details (but don't expose to client in production)
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  if (isDevelopment) {
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: 'code' in err ? err.code : undefined,
      statusCode: 'statusCode' in err ? err.statusCode : undefined,
    });
  } else {
    // In production, only log error message without stack trace
    console.error('Error:', err.message);
  }

  // Determine status code
  const statusCode = 'statusCode' in err && err.statusCode 
    ? err.statusCode 
    : 500;

  // Don't expose internal error details in production
  const message = isDevelopment 
    ? err.message 
    : statusCode >= 500 
      ? 'Internal server error' 
      : err.message;

  res.status(statusCode).json({
    error: message,
    ...(isDevelopment && 'code' in err && err.code ? { code: err.code } : {}),
  });
};

