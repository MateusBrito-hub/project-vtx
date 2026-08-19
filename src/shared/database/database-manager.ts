import { Client } from 'pg'

export async function createClientDatabase(clientName: string) {
    const dbName = `vtx_${clientName.toLowerCase().replace(/\s+/g, '_')}`

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