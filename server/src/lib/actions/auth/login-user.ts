import { db } from "@/db";
import { users } from "@/db/schema/user";
import { LoginSchema } from "@/lib/schemas/auth";
import { eq } from "drizzle-orm";
import { sign } from 'hono/jwt'
import { TOKEN_EXPIRATION_TIME } from "@/../config";

export const loginUser = async (userData: LoginSchema) => {
    const { email, password } = userData;
    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
    })

    if (!user) {
        return {
            success: false,
            message: "User not found",
        }
    }

    if (user.password !== password) {
        return {
            success: false,
            message: "Invalid password",
        }
    }

    const tokenPayload = {
        userId: user.id,
        email: user.email,
        name: user.name,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 30 * TOKEN_EXPIRATION_TIME, // in days
    }

    const token = await sign(tokenPayload, process.env.JWT_SECRET!);
    return {
        success: true,
        message: "Login successful",
        token,
    }
}