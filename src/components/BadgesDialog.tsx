import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Award, Lock } from 'lucide-react';

interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earned_at?: string;
}

interface BadgesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badges: BadgeData[];
}

export const BadgesDialog = ({ open, onOpenChange, badges }: BadgesDialogProps) => {
  const earnedBadges = badges.filter(b => b.earned);
  const lockedBadges = badges.filter(b => !b.earned);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            Rozetler
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Kazanılan Rozetler */}
            {earnedBadges.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">
                  Kazanılan Rozetler ({earnedBadges.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {earnedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="p-4 rounded-lg border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-4xl">{badge.icon}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-foreground mb-1">{badge.name}</h4>
                          <p className="text-sm text-muted-foreground">{badge.description}</p>
                          {badge.earned_at && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              {new Date(badge.earned_at).toLocaleDateString('tr-TR')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kilitli Rozetler */}
            {lockedBadges.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-muted-foreground">
                  Kilitli Rozetler ({lockedBadges.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {lockedBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className="p-4 rounded-lg border border-border bg-muted/30 opacity-60"
                    >
                      <div className="flex items-start gap-3">
                        <div className="relative">
                          <div className="text-4xl grayscale">{badge.icon}</div>
                          <Lock className="w-4 h-4 absolute -top-1 -right-1 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-muted-foreground mb-1">{badge.name}</h4>
                          <p className="text-sm text-muted-foreground">{badge.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
