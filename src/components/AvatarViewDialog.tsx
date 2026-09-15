import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

interface AvatarViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarUrl: string;
  username: string;
}

export const AvatarViewDialog = ({
  open,
  onOpenChange,
  avatarUrl,
  username,
}: AvatarViewDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden rounded-full bg-transparent border-none shadow-none">
        <div className="relative w-full aspect-square rounded-full overflow-hidden">
          <img
            src={avatarUrl}
            alt={username}
            className="w-full h-full object-cover"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
