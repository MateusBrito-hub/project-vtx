// src/modules/client/client.serializer.ts

/**
 * Sanitiza a entidade Client removendo dados fiscais e PII sensíveis
 * quando a requisição for originada por perfil operacional (OPERATOR).
 */
export function sanitizeClientByRole(client: any, role?: string) {
    if (!client) return client

    // Apenas OPERATOR tem dados PII filtrados; ADMIN e SUPER_ADMIN recebem payload completo
    if (role === 'OPERATOR') {
        const {
            CPF_CNPJ,
            IE,
            IM,
            owner,
            ownerDocument,
            address,
            district,
            complement,
            UF,
            zipCode,
            ...safeClient
        } = client

        return safeClient
    }

    return client
}