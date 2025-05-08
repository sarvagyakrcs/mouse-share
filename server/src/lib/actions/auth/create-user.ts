import { db } from "@/db";
import { users } from "@/db/schema/user";
import type { RegisterSchema } from "@/lib/schemas/auth";

export const createUser = async (user: RegisterSchema) => {
    try {
        const { email, password, name } = user;
    
        await db.insert(users).values({
            email,
            password,
            name,
        })
    
        return {
            success: true,
            message: "User created successfully",
        }
    } catch (error) {
        console.error('User creation error:', error);
        throw error instanceof Error ? error : new Error(`Failed to create user: ${String(error)}`);
    }
}