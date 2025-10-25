import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle } from 'lucide-react';

interface ReportMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  messageType: 'global' | 'private';
  reportedUserId: string;
  reportedUsername: string;
}

type ReportReason = 'spam' | 'harassment' | 'inappropriate_content' | 'hate_speech' | 'violence' | 'other';

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: 'spam', label: 'Spam', description: 'Tekrarlayan veya istenmeyen mesajlar' },
  { value: 'harassment', label: 'Taciz', description: 'Rahatsız edici veya tehdit içeren içerik' },
  { value: 'inappropriate_content', label: 'Uygunsuz İçerik', description: 'Argo, küfür veya müstehcen içerik' },
  { value: 'hate_speech', label: 'Nefret Söylemi', description: 'Ayrımcılık veya nefret içeren ifadeler' },
  { value: 'violence', label: 'Şiddet', description: 'Şiddet teşvik eden içerik' },
  { value: 'other', label: 'Diğer', description: 'Yukarıdakilerden farklı bir sebep' },
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

    // Rate limit kontrolü
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <span>Mesajı Bildir</span>
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold">{reportedUsername}</span> kullanıcısının mesajını bildiriyorsunuz
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Bildirme Nedeni</Label>
            <RadioGroup value={reason} onValueChange={(value) => setReason(value as ReportReason)}>
              {REPORT_REASONS.map((item) => (
                <div key={item.value} className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem value={item.value} id={item.value} />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor={item.value} className="font-medium cursor-pointer">
                      {item.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Açıklama (Opsiyonel)</Label>
            <Textarea
              id="description"
              placeholder="Ek bilgi vermek isterseniz buraya yazabilirsiniz..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/500</p>
          </div>

          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">
              ⚠️ Yanlış veya kötü niyetli raporlar hesabınıza yaptırım uygulanmasına sebep olabilir.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} variant="destructive">
            {isSubmitting ? 'Gönderiliyor...' : 'Rapor Gönder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
