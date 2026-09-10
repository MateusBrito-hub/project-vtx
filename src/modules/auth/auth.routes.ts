import { Router } from 'express'
import { login, logout } from './auth.controller'
import { loginRateLimiter } from './auth.limiter'
import { authMiddleware } from '../../shared/auth/auth.middleware'

const router = Router()

router.post('/login', loginRateLimiter, login)
router.post('/logout', authMiddleware, logout)

export default router