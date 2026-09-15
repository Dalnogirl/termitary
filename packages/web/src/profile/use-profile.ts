import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileDto } from '@termitary/protocol';
import { fetchProfile, updateProfileName } from '../network/profile-api.js';

export type ProfileView =
  | { readonly status: 'loading' }
  | { readonly status: 'missing' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly profile: ProfileDto };

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : 'unknown error';

const profileKey = (userId: string) => ['profile', userId];

export const useProfile = (userId: string): ProfileView => {
  const query = useQuery({
    queryKey: profileKey(userId),
    queryFn: () => fetchProfile(userId),
    enabled: userId !== '',
  });

  // A disabled query never resolves, so an absent id is answered here rather
  // than left as a permanent 'loading'.
  if (userId === '') return { status: 'missing' };
  if (query.data === null) return { status: 'missing' };
  if (query.data !== undefined) return { status: 'ready', profile: query.data };
  if (query.isLoading || query.error === null) return { status: 'loading' };
  return { status: 'error', message: describe(query.error) };
};

export type RenameProfile = {
  /** False when the server refused the name, which leaves `error` set. */
  readonly rename: (name: string) => Promise<boolean>;
  readonly isSaving: boolean;
  /** The server's own rejection copy, or null while the field is unjudged. */
  readonly error: string | null;
  readonly reset: () => void;
};

export const useRenameProfile = (userId: string): RenameProfile => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: updateProfileName,
    // The response is the whole profile, so the page updates without a refetch.
    // Archived rows are left alone: they carry the name the game snapshotted.
    onSuccess: (profile) => queryClient.setQueryData(profileKey(userId), profile),
  });

  return {
    rename: (name: string) =>
      mutation
        .mutateAsync(name)
        .then(() => true)
        .catch(() => false),
    isSaving: mutation.isPending,
    error: mutation.error === null ? null : describe(mutation.error),
    reset: () => mutation.reset(),
  };
};
