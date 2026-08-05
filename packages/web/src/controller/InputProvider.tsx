import { type ReactNode, createContext, useContext, useMemo } from 'react';
import { type InputHandlers, createInputHandlers } from './input.js';
import type { Controller } from './port.js';

const InputContext = createContext<InputHandlers | null>(null);

type Props = {
  readonly controller: Controller;
  readonly children: ReactNode;
};

export const InputProvider = ({ controller, children }: Props) => {
  const handlers = useMemo(() => createInputHandlers(controller), [controller]);
  return <InputContext.Provider value={handlers}>{children}</InputContext.Provider>;
};

export const useInputHandlers = (): InputHandlers => {
  const ctx = useContext(InputContext);
  if (ctx === null) {
    throw new Error('useInputHandlers must be used inside <InputProvider>');
  }
  return ctx;
};
