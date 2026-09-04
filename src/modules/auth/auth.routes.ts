// src/modules/auth/auth.routes.ts

import { Router } from 'express'
import { login } from './auth.controller'
import { loginRateLimiter } from './auth.limiter'

const router = Router()

router.post('/login', loginRateLimiter, login)

export default router