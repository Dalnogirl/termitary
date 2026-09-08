import type { Config } from 'drizzle-kit';

export default {
  dialect: 'sqlite',
  schema: './src/adapters/db/{auth-schema,schema}.ts',
  out: './migrations',
} satisfies Config;
