import type { HexCoord } from '@termitary/engine';
import { type StateCreator, createStore } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * A mark explaining why the board refuses something. Explanation, not
 * position, so it lives beside the game rather than in it.
 */
export type Annotation =
  | { readonly kind: 'pinned'; readonly at: HexCoord }
  | { readonly kind: 'blocked'; readonly at: HexCoord }
  | { readonly kind: 'gate'; readonly between: readonly [HexCoord, HexCoord] };

export type AnnotationState = {
  readonly annotations: readonly Annotation[];
};

type AnnotationActions = {
  readonly setAnnotations: (annotations: readonly Annotation[]) => void;
  /** Whoever sets annotations clears them, or they outlive the page onto the next board. */
  readonly clearAnnotations: () => void;
};

export type AnnotationStore = AnnotationState & AnnotationActions;

const initializer: StateCreator<AnnotationStore, [['zustand/devtools', never]]> = (set) => ({
  annotations: [],
  setAnnotations: (annotations) => set({ annotations }, false, 'setAnnotations'),
  clearAnnotations: () => set({ annotations: [] }, false, 'clearAnnotations'),
});

export const annotationStore = createStore<AnnotationStore>()(
  devtools(initializer, { name: 'termitary-annotations', enabled: import.meta.env.DEV }),
);
