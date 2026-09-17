import type { AuthProvidersDto } from '@termitary/protocol';
import { getApiUrl } from './url.js';

// No credentials: this is the one endpoint the server leaves ungated, because
// /signin is the page with no session to send.
export const fetchAuthProviders = async (): Promise<AuthProvidersDto> => {
  const res = await fetch(`${getApiUrl()}/auth/providers`);
  if (!res.ok) throw new Error(`GET /auth/providers returned ${res.status}`);
  return (await res.json()) as AuthProvidersDto;
};
