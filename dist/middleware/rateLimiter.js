"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = exports.apiRateLimiter = exports.loginRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Rate limiter for login endpoint (stricter)
exports.loginRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per windowMs
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        });
    },
});
// Rate limiter for general API endpoints
exports.apiRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute (much more generous)
    message: 'Muitas requisições. Tente novamente em alguns segundos.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Muitas requisições. Tente novamente em alguns segundos.',
        });
    },
});
// Rate limiter for creation endpoints (POST)
exports.createRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 creation requests per minute
    message: 'Muitas requisições de criação. Tente novamente em alguns segundos.',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Muitas requisições de criação. Tente novamente em alguns segundos.',
        });
    },
});
