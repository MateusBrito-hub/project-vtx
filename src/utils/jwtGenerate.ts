import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export function generateToken(): string {
    const secretKey = process.env.CORE_SECRET as string;

    if(!secretKey) {
        throw new Error('Secret key not defined in environment variables');
    }

    const token = jwt.sign({}, secretKey, { 
        expiresIn: '24h',
        issuer: 'core', 
    });

    return token;
}