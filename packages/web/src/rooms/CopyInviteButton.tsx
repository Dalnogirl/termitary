import { Button } from '@/components/ui/button';
import { LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

export const CopyInviteButton = () => {
  const copy = async () => {
    const url = window.location.href;
    try {
      // Undefined outside a secure context, e.g. a phone hitting the dev box over LAN.
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied');
    } catch {
      toast.error('Copying needs https — the link is in the address bar');
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={() => void copy()}>
      <LinkIcon className="size-3.5" />
      Copy invite link
    </Button>
  );
};
