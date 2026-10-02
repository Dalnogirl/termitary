import { useQuery } from '@tanstack/react-query';
import type { AuthProviderId } from '@termitary/protocol';
import { fetchAuthProviders } from './auth-providers-api.js';

// A deployment without credentials returns an empty list and the page is the
// email form it was before. A failed fetch is the same thing: no buttons.
export const useAuthProviders = (): readonly AuthProviderId[] => {
  const query = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: fetchAuthProviders,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });
  return query.data?.providers ?? [];
};
