import { Client } from 'pg'

export async function createClientDatabase(clientName: string) {

    const safeName = clientName
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, "")

    if(!safeName) {
        throw new Error("Nome de cliente inválido para criação de banco de dados")
    }

    const dbName = `vtx_${safeName}`.substring(0,63)

    const client = new Client({
        connectionString: process.env.DATABASE_URL?.replace(/\/[^/]+$/, '/postgres')
    })

    await client.connect()

    try {
        await client.query(`CREATE DATABASE ${dbName}`)
        console.log(`Banco ${dbName} criado com sucesso`)
    } catch (error: any) {
        if (error.code === '42P04') {
            console.log(`Banco ${dbName} já existe`)
        } else {
            throw error
        }
    } finally {
        await client.end()
    }

    return dbName
}