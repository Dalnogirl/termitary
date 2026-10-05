export type UntimedControl = { readonly kind: 'untimed' };
export type CorrespondenceControl = {
  readonly kind: 'correspondence';
  readonly daysPerMove: 1 | 3;
};
export type RealtimeControl = {
  readonly kind: 'realtime';
  readonly initialMs: number;
  readonly incrementMs: number;
};

export type TimeControl = UntimedControl | CorrespondenceControl | RealtimeControl;

export const TIME_CONTROL_PRESETS = [
  { kind: 'untimed' },
  { kind: 'correspondence', daysPerMove: 1 },
  { kind: 'correspondence', daysPerMove: 3 },
  { kind: 'realtime', initialMs: 5 * 60_000, incrementMs: 3_000 },
  { kind: 'realtime', initialMs: 15 * 60_000, incrementMs: 10_000 },
] as const satisfies readonly TimeControl[];
