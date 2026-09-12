export type UserStore = {
  /**
   * Display names for the ids that still exist. A deleted account is absent
   * from the map rather than reported as a missing name.
   */
  namesOf(ids: readonly string[]): Promise<ReadonlyMap<string, string>>;
};
