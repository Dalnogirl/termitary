declare const writeOp: unique symbol;

/**
 * One store's share of a write that has to land together with another
 * store's. Opaque on purpose: only the adapter that built it knows how to run
 * it, and it runs only inside `UnitOfWork.commit`.
 */
export type WriteOp = { readonly [writeOp]: true };

export type UnitOfWork = {
  /**
   * Applies every op or none of them. Whatever an op throws, the commit
   * throws, so a lost compare-and-swap still reaches the caller as
   * `ConcurrentModificationError`.
   */
  commit(ops: readonly WriteOp[]): Promise<void>;
};
