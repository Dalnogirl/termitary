import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { getApiUrl } from './url.js';

// The only module that knows better-auth exists on the client, mirroring
// ws/identity.ts on the server. The SDK attaches credentials itself, so the
// manual `credentials: 'include'` in rooms-api/seeks-api is not needed
// for these calls.
export const authClient = createAuthClient({
  baseURL: `${getApiUrl()}/auth`,
  plugins: [emailOTPClient()],
});

export const { useSession, signOut } = authClient;
