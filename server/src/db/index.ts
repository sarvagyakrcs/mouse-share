import { drizzle } from 'drizzle-orm/node-postgres';
import * as user from './schema/user';

export const db = drizzle(process.env.DATABASE_URL!, {
    schema: {
        ...user
    }
});