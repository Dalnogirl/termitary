import { Toaster, toast } from 'sonner';

type NotifyOptions = {
  readonly id?: string;
  readonly description?: string;
  readonly duration?: number;
  readonly action?: { readonly label: string; readonly onClick: () => void };
};

export type Notifier = {
  readonly error: (message: string, options?: NotifyOptions) => void;
  readonly info: (message: string, options?: NotifyOptions) => void;
};

export const notifier: Notifier = {
  error: (message, options) => {
    toast.error(message, options);
  },
  info: (message, options) => {
    toast(message, options);
  },
};

export const silentNotifier: Notifier = {
  error: () => {},
  info: () => {},
};

export const Notifications = () => <Toaster theme="dark" richColors closeButton />;
