import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';

const describe = (error: unknown): string => {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
};

// Both links are full page loads. Whatever threw left the tree in a state this
// boundary cannot reason about, so a client-side navigation out of it is a
// guess; a reload is not.
export const RouteError = () => {
  const error = useRouteError();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-dvh w-dvw flex-col items-center justify-center gap-6 bg-background px-6 text-foreground">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-lg font-semibold">This page hit an error</h1>
        <p className="max-w-md font-mono text-xs text-muted-foreground break-words">
          {describe(error)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => window.location.reload()}>Reload</Button>
        <Button variant="secondary" asChild>
          <a href="/lobby">Back to lobby</a>
        </Button>
      </div>
    </div>
  );
};
