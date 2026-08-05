import type { IncomingHttpHeaders } from 'node:http';
import type { Auth } from './better-auth.js';

// Pure-fabrication seam: cookie/header → userId. Both the WS preValidation
// hook and the REST preHandler consume this; switching auth lib or to JWT
// mode changes only this module.
export const getUserIdFromHeaders = async (
  auth: Auth,
  headers: IncomingHttpHeaders,
): Promise<string | null> => {
  const session = await auth.api.getSession({ headers: toHeaders(headers) });
  return session?.user.id ?? null;
};

const toHeaders = (h: IncomingHttpHeaders): Headers => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(h)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.append(key, String(value));
    }
  }
  return headers;
};
