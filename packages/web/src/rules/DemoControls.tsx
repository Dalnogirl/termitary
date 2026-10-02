import { Button } from '@/components/ui/button';
import type { RulesDemo } from './demo.js';
import { useDemoPlayer } from './use-demo-player.js';

export const DemoControls = ({ demo }: { readonly demo: RulesDemo }) => {
  const { mode, tryIt, watch } = useDemoPlayer(demo);

  if (mode === 'watching') {
    return (
      <Button size="sm" onClick={tryIt}>
        Try it
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={tryIt}>
        Reset
      </Button>
      <Button size="sm" variant="ghost" onClick={watch}>
        Watch again
      </Button>
    </div>
  );
};
