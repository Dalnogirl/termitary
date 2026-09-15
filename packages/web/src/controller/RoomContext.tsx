import type { Color } from '@termitary/engine';
import type { OpponentPresence } from '@termitary/protocol';
import { type ReactNode, createContext, useContext } from 'react';

export type RoomContextValue = {
  // null in hot-seat (this client controls both sides). In a network game,
  // this is the color the local player is assigned to.
  readonly myColor: Color | null;
  readonly opponent: OpponentPresence;
};

const RoomContext = createContext<RoomContextValue | null>(null);

type Props = {
  readonly myColor: Color | null;
  // Omitted wherever there is nobody on the other side of a socket: hot-seat,
  // the demo board, a finished game being reviewed.
  readonly opponent?: OpponentPresence;
  readonly children: ReactNode;
};

export const RoomProvider = ({ myColor, opponent = { status: 'empty' }, children }: Props) => (
  <RoomContext.Provider value={{ myColor, opponent }}>{children}</RoomContext.Provider>
);

export const useRoomContext = (): RoomContextValue => {
  const ctx = useContext(RoomContext);
  if (ctx === null) {
    throw new Error('useRoomContext must be used inside <RoomProvider>');
  }
  return ctx;
};
