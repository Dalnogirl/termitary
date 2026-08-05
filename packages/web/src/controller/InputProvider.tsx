import { type ReactNode, createContext, useContext, useMemo } from 'react';
import { type InputHandlers, createInputHandlers } from './input.js';
import type { Controller } from './port.js';
import { useRoomContext } from './RoomContext.js';

const InputContext = createContext<InputHandlers | null>(null);

type Props = {
  readonly controller: Controller;
  readonly children: ReactNode;
};

export const InputProvider = ({ controller, children }: Props) => {
  // InputProvider must be rendered inside a RoomProvider — myColor gates
  // input handling so the off-turn / off-color clicks no-op.
  const { myColor } = useRoomContext();
  const handlers = useMemo(
    () => createInputHandlers(controller, myColor),
    [controller, myColor],
  );
  return <InputContext.Provider value={handlers}>{children}</InputContext.Provider>;
};

export const useInputHandlers = (): InputHandlers => {
  const ctx = useContext(InputContext);
  if (ctx === null) {
    throw new Error('useInputHandlers must be used inside <InputProvider>');
  }
  return ctx;
};
