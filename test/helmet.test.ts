// test/helmet.test.ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../src/app'

describe('Helmet Security Headers (TASK 05)', () => {
    it('deve incluir os cabeçalhos de segurança essenciais nas respostas', async () => {
        const res = await request(app).get('/health')

        expect(res.status).toBe(200)
        
        // Verifica a presença dos cabeçalhos do Helmet
        expect(res.headers['x-content-type-options']).toBe('nosniff')
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN')
        expect(res.headers['strict-transport-security']).toBeDefined()
        
        // Garante que o Express não expõe sua stack
        expect(res.headers['x-powered-by']).toBeUndefined()
    })
})