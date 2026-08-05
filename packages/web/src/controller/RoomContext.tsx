import type { Color } from '@hive/engine';
import { type ReactNode, createContext, useContext } from 'react';

export type RoomContextValue = {
  // null in hot-seat (this client controls both sides). In a network game,
  // this is the color the local player is assigned to.
  readonly myColor: Color | null;
};

const RoomContext = createContext<RoomContextValue | null>(null);

type Props = {
  readonly myColor: Color | null;
  readonly children: ReactNode;
};

export const RoomProvider = ({ myColor, children }: Props) => (
  <RoomContext.Provider value={{ myColor }}>{children}</RoomContext.Provider>
);

export const useRoomContext = (): RoomContextValue => {
  const ctx = useContext(RoomContext);
  if (ctx === null) {
    throw new Error('useRoomContext must be used inside <RoomProvider>');
  }
  return ctx;
};
