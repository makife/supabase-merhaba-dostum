import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Flag, ShieldAlert, MessageSquareWarning, Skull, Flame, Megaphone, HelpCircle, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  messageType: 'global' | 'private';
  reportedUserId: string;
  reportedUsername: string;
}

type ReportReason = 'spam' | 'harassment' | 'inappropriate_content' | 'hate_speech' | 'violence' | 'other';

const REPORT_REASONS: { value: ReportReason; label: string; icon: React.ReactNode }[] = [
  { value: 'spam', label: 'Spam', icon: <Megaphone className="w-4 h-4" /> },
  { value: 'harassment', label: 'Taciz', icon: <ShieldAlert className="w-4 h-4" /> },
  { value: 'inappropriate_content', label: 'Uygunsuz İçerik', icon: <MessageSquareWarning className="w-4 h-4" /> },
  { value: 'hate_speech', label: 'Nefret Söylemi', icon: <Flame className="w-4 h-4" /> },
  { value: 'violence', label: 'Şiddet', icon: <Skull className="w-4 h-4" /> },
  { value: 'other', label: 'Diğer', icon: <HelpCircle className="w-4 h-4" /> },
];

export function ReportMessageDialog({
  isOpen,
  onClose,
  messageId,
  messageType,
  reportedUserId,
  reportedUsername,
}: ReportMessageDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason>('spam');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Rapor göndermek için giriş yapmalısınız');
      return;
    }

    try {
      const { data: canReport } = await supabase
        .rpc('check_report_rate_limit', { p_user_id: user.id });

      if (!canReport) {
        toast.error('Çok fazla rapor gönderdiniz. Lütfen daha sonra tekrar deneyin.');
        return;
      }
    } catch (error) {
      console.error('Rate limit check error:', error);
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('message_reports')
        .insert({
          message_id: messageId,
          message_type: messageType,
          reporter_id: user.id,
          reported_user_id: reportedUserId,
          reason: reason,
          description: description.trim() || null,
        });

      if (error) {
        if (error.code === '23505') {
          toast.info('Bu mesajı zaten raporladınız');
        } else {
          throw error;
        }
        return;
      }

      toast.success(`${reportedUsername} kullanıcısının mesajı bildirildi`, {
        description: 'Raporunuz incelemeye alındı. Teşekkür ederiz.',
        icon: '✅',
      });

      onClose();
      setReason('spam');
      setDescription('');
    } catch (error) {
      console.error('Error reporting message:', error);
      toast.error('Rapor gönderilirken hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[92vw] max-w-[400px] rounded-2xl border-destructive/10 bg-background/95 backdrop-blur-md p-0 gap-0 overflow-hidden shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 flex-shrink-0">
              <Flag className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold">Mesajı Bildir</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                <span className="font-semibold text-foreground">{reportedUsername}</span> adlı kullanıcı
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* Reason chips */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Bildirme Nedeni</p>
            <div className="grid grid-cols-2 gap-1.5">
              {REPORT_REASONS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setReason(item.value)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border",
                    reason === item.value
                      ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Açıklama (Opsiyonel)</p>
            <Textarea
              placeholder="Ek bilgi ekleyebilirsiniz..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              className="text-sm resize-none rounded-xl border-muted-foreground/15 focus-visible:ring-destructive/30"
            />
            <p className="text-[10px] text-muted-foreground text-right mt-1">{description.length}/500</p>
          </div>

          {/* Warning */}
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            ⚠️ Yanlış veya kötü niyetli raporlar hesabınıza yaptırım uygulanmasına sebep olabilir.
          </p>

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-xl h-10 text-sm"
            >
              <X className="w-4 h-4 mr-1" />
              Vazgeç
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              variant="destructive"
              className="flex-1 rounded-xl h-10 text-sm"
            >
              <Send className="w-4 h-4 mr-1" />
              {isSubmitting ? 'Gönderiliyor...' : 'Bildir'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
