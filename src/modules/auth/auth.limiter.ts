// src/modules/auth/auth.limiter.ts

import rateLimit from 'express-rate-limit'

const windowMinutes = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES) || 15
const maxAttempts = Number(process.env.AUTH_RATE_LIMIT_MAX) || 5

export const loginRateLimiter = rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit: maxAttempts,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: {
        error: `Muitas tentativas de login. Tente novamente em ${windowMinutes} minutos.`,
    },
    statusCode: 429,
})
