// test/cors.test.ts

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../src/shared/database/prisma', () => ({
    prisma: {},
}))

import { app } from '../src/app'
import {
    getAllowedOrigins,
    isOriginAllowed,
    getCorsOptions,
} from '../src/shared/config/cors'

describe('CORS Policy Middleware (TASK 03)', () => {
    const originalEnv = process.env

    beforeEach(() => {
        process.env = { ...originalEnv }
    })

    afterEach(() => {
        process.env = originalEnv
    })

    describe('Funções utilitárias de CORS', () => {
        it('deve retornar origens de desenvolvimento por padrão quando em ambiente não-produção', () => {
            delete process.env.CORS_ALLOWED_ORIGINS
            process.env.NODE_ENV = 'development'

            const origins = getAllowedOrigins()
            expect(origins).toContain('http://localhost:3000')
            expect(origins).toContain('http://localhost:5173')
        })

        it('deve carregar origens personalizadas da variável CORS_ALLOWED_ORIGINS', () => {
            process.env.CORS_ALLOWED_ORIGINS =
                'https://admin.meusite.com, https://app.meusite.com '

            const origins = getAllowedOrigins()
            expect(origins).toEqual([
                'https://admin.meusite.com',
                'https://app.meusite.com',
            ])
        })

        it('deve retornar lista vazia em produção se CORS_ALLOWED_ORIGINS não estiver configurado', () => {
            delete process.env.CORS_ALLOWED_ORIGINS
            process.env.NODE_ENV = 'production'

            const origins = getAllowedOrigins()
            expect(origins).toEqual([])
        })

        it('deve considerar válida requisição sem header Origin', () => {
            expect(isOriginAllowed(undefined, ['http://localhost:3000'])).toBe(
                true
            )
        })

        it('deve validar corretamente se a origem está na whitelist', () => {
            const whitelist = ['http://localhost:3000', 'https://meusite.com']
            expect(isOriginAllowed('http://localhost:3000', whitelist)).toBe(
                true
            )
            expect(isOriginAllowed('https://evil.com', whitelist)).toBe(false)
        })
    })

    describe('Integração HTTP com o Express (app)', () => {
        it('deve permitir requisição de origem autorizada e retornar cabeçalho Access-Control-Allow-Origin', async () => {
            process.env.CORS_ALLOWED_ORIGINS = 'http://trusted-domain.com'

            const response = await request(app)
                .get('/health')
                .set('Origin', 'http://trusted-domain.com')

            expect(response.status).toBe(200)
            expect(response.headers['access-control-allow-origin']).toBe(
                'http://trusted-domain.com'
            )
            expect(response.body).toEqual({ status: 'running' })
        })

        it('deve bloquear requisição de origem não autorizada com HTTP 403 Forbidden', async () => {
            process.env.CORS_ALLOWED_ORIGINS = 'http://trusted-domain.com'

            const response = await request(app)
                .get('/health')
                .set('Origin', 'http://unauthorized-attacker.com')

            expect(response.status).toBe(403)
            expect(response.body).toEqual({
                error: 'Origem não permitida pela política de CORS.',
            })
            expect(
                response.headers['access-control-allow-origin']
            ).toBeUndefined()
        })

        it('deve permitir requisições sem cabeçalho Origin (CLI, curl, mobile)', async () => {
            const response = await request(app).get('/health')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ status: 'running' })
        })

        it('deve responder preflight OPTIONS com sucesso para origem autorizada', async () => {
            process.env.CORS_ALLOWED_ORIGINS = 'http://trusted-domain.com'

            const response = await request(app)
                .options('/health')
                .set('Origin', 'http://trusted-domain.com')
                .set('Access-Control-Request-Method', 'POST')
                .set('Access-Control-Request-Headers', 'Content-Type')

            expect(response.status).toBe(204)
            expect(response.headers['access-control-allow-origin']).toBe(
                'http://trusted-domain.com'
            )
            expect(
                response.headers['access-control-allow-methods']
            ).toBeDefined()
        })

        it('deve bloquear preflight OPTIONS para origem não autorizada com HTTP 403', async () => {
            process.env.CORS_ALLOWED_ORIGINS = 'http://trusted-domain.com'

            const response = await request(app)
                .options('/health')
                .set('Origin', 'http://malicious-preflight.com')
                .set('Access-Control-Request-Method', 'POST')

            expect(response.status).toBe(403)
            expect(response.body).toEqual({
                error: 'Origem não permitida pela política de CORS.',
            })
        })

        it('deve respeitar a flag CORS_CREDENTIALS=true quando ativada', async () => {
            process.env.CORS_ALLOWED_ORIGINS = 'http://trusted-domain.com'
            process.env.CORS_CREDENTIALS = 'true'

            const response = await request(app)
                .get('/health')
                .set('Origin', 'http://trusted-domain.com')

            expect(response.status).toBe(200)
            expect(
                response.headers['access-control-allow-credentials']
            ).toBe('true')
        })
    })
})
