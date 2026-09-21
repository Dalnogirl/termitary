import { fileURLToPath } from 'node:url';

/**
 * Absolute, because a production server refuses a relative DATABASE_URL. The
 * directory itself is made and emptied by the web server command, which is the
 * only place that runs once and runs first.
 */
export const PROD_DATA_DIR = fileURLToPath(new URL('./.tmp/', import.meta.url));
