import { z } from 'zod'

export const emptyBodySchema = z
    .object({})
    .strict()