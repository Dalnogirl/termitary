/**
 * The logging port. Structurally a subset of pino, so the pino instance is its
 * own adapter and Fastify's `app.log` satisfies it directly — including the
 * no-op logger Fastify installs when logging is off, which is what keeps tests
 * quiet without a fake.
 */
export type LogFn = (fields: Record<string, unknown>, msg: string) => void;

export type Logger = {
  readonly info: LogFn;
  readonly warn: LogFn;
  readonly error: LogFn;
};
