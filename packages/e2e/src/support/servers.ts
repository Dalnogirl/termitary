import { type ChildProcess, spawn } from 'node:child_process';

export type SpawnedServer = {
  readonly url: string;
  readonly stop: () => void;
};

const HEALTH_TIMEOUT_MS = 30_000;

// A server already on the port answers /health as readily as ours would, so the
// child dying is what separates "still booting" from "never coming up". Without
// this, a leaked server from an earlier run passes for the one we just spawned.
const waitForHealth = async (child: ChildProcess, url: string): Promise<void> => {
  let exited: string | null = null;
  child.once('exit', (code, signal) => {
    exited = `exited with ${signal ?? code}`;
  });
  child.once('error', (err) => {
    exited = err.message;
  });

  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited !== null) throw new Error(`${url} never came up: the server ${exited}`);
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${url} never became healthy`);
};

/**
 * A second game server, for the one thing a running one cannot show: how it
 * behaves configured differently. `env` is read once at import, so a different
 * origin means a different process.
 */
export const startServer = async (
  port: number,
  env: Record<string, string>,
): Promise<SpawnedServer> => {
  const child = spawn('pnpm', ['--filter', '@termitary/server', 'start:e2e'], {
    env: {
      ...process.env,
      PORT: String(port),
      BETTER_AUTH_URL: `http://localhost:${port}`,
      ...env,
    },
    stdio: 'ignore',
  });
  const url = `http://localhost:${port}`;
  try {
    await waitForHealth(child, url);
  } catch (err) {
    // Nothing else holds this child yet, so a throw here would leak it and the
    // next run would find the port taken.
    child.kill();
    throw err;
  }
  return { url, stop: () => child.kill() };
};
