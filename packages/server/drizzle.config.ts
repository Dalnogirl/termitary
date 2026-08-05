import type { Config } from 'drizzle-kit';

export default {
  dialect: 'sqlite',
  schema: './src/adapters/db/schema.ts',
  out: './migrations',
} satisfies Config;
