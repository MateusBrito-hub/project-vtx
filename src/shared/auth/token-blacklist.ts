// src/shared/auth/token-blacklist.ts

// Armazena token -> timestamp de expiração (milissegundos)
const tokenBlacklist = new Map<string, number>()

/**
 * Registra um token JWT na blacklist até o término do seu tempo de vida.
 * @param token JWT a ser revogado
 * @param ttlMs Tempo de retenção em milissegundos (padrão: 15 minutos)
 */
export function revokeToken(token: string, ttlMs: number = 15 * 60 * 1000): void {
    const expiresAt = Date.now() + ttlMs
    tokenBlacklist.set(token, expiresAt)
}

/**
 * Verifica se um token foi revogado.
 * Remove automaticamente tokens expirados da memória.
 */
export function isTokenRevoked(token: string): boolean {
    const expiresAt = tokenBlacklist.get(token)
    if (!expiresAt) return false

    // Se já passou do tempo de vida, limpa da memória
    if (Date.now() > expiresAt) {
        tokenBlacklist.delete(token)
        return false
    }

    return true
}

/**
 * Limpa toda a blacklist (utilitário para suítes de testes automatizados).
 */
export function clearTokenBlacklist(): void {
    tokenBlacklist.clear()
}