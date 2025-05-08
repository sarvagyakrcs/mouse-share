import { Hono } from 'hono'
import { authRoutes } from './routes/auth'

export type Env = {
  DATABASE_URL: string;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Env }>()

app.route('/auth', authRoutes)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})


export default app
