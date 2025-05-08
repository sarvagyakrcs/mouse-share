import { Hono } from 'hono';
import { validator } from 'hono/validator'
import { loginSchema, registerSchema } from '../lib/schemas/auth';
import { createUser } from '@/lib/actions/auth/create-user';
import { loginUser } from '@/lib/actions/auth/login-user';

export const authRoutes = new Hono();

authRoutes.get('/', (c) => {
  return c.json({ message: 'Auth routes' });
});

authRoutes.post('/login',validator("json", (value, c) => {
    const result = loginSchema.safeParse(value);
    if (!result.success) {
        return c.json({ error: 'Invalid request', details: result.error.flatten().fieldErrors }, 400);
    }
    return result.data;
}), async (c) => {
  const { email, password } = await c.req.json();
  try {
    const result = await loginUser({ email, password });
    return c.json({ message: result.message, token: result.token });
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to login', details: error }, 500);
  }
});

authRoutes.post('/register',validator("json", (value, c) => {
    const result = registerSchema.safeParse(value);
    if (!result.success) {
        return c.json({ error: 'Invalid request', details: result.error.flatten().fieldErrors }, 400);
    }
    return result.data;
}), async (c) => {
    const { email, password, name } = await c.req.json();
    try {
        const result = await createUser({ email, password, name });
        return c.json({ message: result.message });
    } catch (error) {
        console.error(error);
        return c.json({ error: 'Failed to create user', details: error }, 500);
    }
});