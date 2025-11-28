import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Rate limiter for login endpoint (stricter)
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per windowMs
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    });
  },
});

// Rate limiter for general API endpoints
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute (much more generous)
  message: 'Muitas requisições. Tente novamente em alguns segundos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Muitas requisições. Tente novamente em alguns segundos.',
    });
  },
});

// Rate limiter for creation endpoints (POST)
export const createRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 creation requests per minute
  message: 'Muitas requisições de criação. Tente novamente em alguns segundos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Muitas requisições de criação. Tente novamente em alguns segundos.',
    });
  },
});

