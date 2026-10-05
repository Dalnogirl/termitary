/** The instant a request arrived. Injected so a test can stand a request on either side of a deadline. */
export type TimeDeps = { readonly clock?: () => Date };

export const arrivalOf = (deps: TimeDeps): Date => (deps.clock ?? (() => new Date()))();
