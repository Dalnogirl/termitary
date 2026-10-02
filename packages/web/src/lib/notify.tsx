import { Toaster, toast } from 'sonner';

export type Notifier = {
  readonly error: (message: string) => void;
  readonly info: (message: string, options?: { readonly id?: string }) => void;
};

export const notifier: Notifier = {
  error: (message) => {
    toast.error(message);
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
