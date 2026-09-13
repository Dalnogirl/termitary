/** An account's display data. `name` is generated on first sign-in, never empty. */
export type Profile = {
  readonly userId: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/**
 * Display names live in `profiles`, not on better-auth's `user` row. Nothing
 * reads `user.name` (always `''`) or `user.image` (never written); this port
 * is the only way to a name.
 */
export type UserStore = {
  /**
   * Display names for the ids that still exist. A deleted account is absent
   * from the map rather than reported as a missing name.
   */
  namesOf(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;

  /** Null for an account with no profile, which sign-in is what repairs. */
  get(userId: string): Promise<Profile | null>;

  /**
   * Write a profile with a generated name unless the account already has one.
   * Called on every sign-in, so it is an insert that usually does nothing.
   */
  ensure(userId: string, now: Date): Promise<Profile>;

  /** Null when the account is gone, so a rename cannot resurrect a profile. */
  rename(userId: string, name: string, now: Date): Promise<Profile | null>;
};
