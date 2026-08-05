import { useEffect, useState } from 'react';
import { createStore, useStore } from 'zustand';
import {
  INITIAL_ROOM_STATE,
  type RoomController,
  type RoomState,
  createRoomController,
} from './room.js';

export type RoomConnection = RoomState & {
  readonly controller: RoomController | null;
  readonly leave: () => void;
};

// Reads as INITIAL_ROOM_STATE forever; used by useStore on first render
// before the effect creates the real controller. Keeps the hook's call
// signature stable (useStore needs a store argument, not undefined).
const FALLBACK_STORE = createStore<RoomState>(() => INITIAL_ROOM_STATE);

// Lifecycle-only wrapper around RoomController: creates it on mount,
// disposes on unmount, and projects its store into React. All protocol
// wiring lives in createRoomController — there are no client.on(...)
// calls in this file by design.
export const useRoomConnection = (roomId: string | undefined): RoomConnection => {
  const [controller, setController] = useState<RoomController | null>(null);

  useEffect(() => {
    if (roomId === undefined || roomId.length === 0) return;
    const c = createRoomController({ roomId });
    setController(c);
    return () => {
      c.dispose();
      setController(null);
    };
  }, [roomId]);

  const store = controller?.store ?? FALLBACK_STORE;
  const status = useStore(store, (s) => s.status);
  const myColor = useStore(store, (s) => s.myColor);
  const errorMsg = useStore(store, (s) => s.errorMsg);

  return {
    status,
    myColor,
    errorMsg,
    controller,
    leave: () => controller?.leave(),
  };
};
