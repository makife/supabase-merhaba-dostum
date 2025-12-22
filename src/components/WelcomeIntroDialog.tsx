import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bot, 
  Users, 
  Trophy, 
  Zap, 
  MessageSquare, 
  Gamepad2, 
  Sparkles, 
  Gift,
  Target,
  Brain,
  Puzzle,
  Dices
} from "lucide-react";

interface WelcomeIntroDialogProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeIntroDialog = ({ open, onClose }: WelcomeIntroDialogProps) => {
  const handleComplete = () => {
    localStorage.setItem("kelimeci-intro-completed", "true");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md max-h-[85vh]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="relative">
              <Sparkles className="w-10 h-10 text-yellow-500 animate-pulse" />
              <Gift className="w-6 h-6 text-primary absolute -bottom-1 -right-1" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Kelimele'ye Hoş Geldin! 🎉
          </DialogTitle>
          <DialogDescription className="text-center">
            Seni aramızda görmekten mutluluk duyuyoruz
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[50vh] pr-4">
          <div className="space-y-4 text-sm">
            {/* Hoşgeldin Joker Hediyesi */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-4">
              <h3 className="font-bold text-primary flex items-center gap-2 mb-2">
                <Gift className="w-5 h-5 text-yellow-500" />
                Hoş Geldin Hediyesi!
              </h3>
              <p className="text-muted-foreground mb-2">
                Sana özel <span className="font-bold text-primary">3'er adet joker</span> hediye ettik:
              </p>
              <ul className="space-y-1 ml-2">
                <li className="flex items-center gap-2">
                  <img src="/degistirIkon.png" alt="Değiştir" className="w-5 h-5" />
                  <span><strong>3x Değiştir Jokeri:</strong> Harfleri yenile</span>
                </li>
                <li className="flex items-center gap-2">
                  <img src="/fisildaIkon.png" alt="Fısılda" className="w-5 h-5" />
                  <span><strong>3x Fısılda Jokeri:</strong> Kelime önerisi al</span>
                </li>
                <li className="flex items-center gap-2">
                  <img src="/senyazIkon.png" alt="Sen Yaz" className="w-5 h-5" />
                  <span><strong>3x Sen Yaz Jokeri:</strong> AI sana kelime yazsın</span>
                </li>
              </ul>
            </div>

            {/* Oyun Modları */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <Gamepad2 className="w-5 h-5" />
                Oyun Modları
              </h3>

              <div className="space-y-2">
                <div className="flex items-start gap-3 p-2 bg-blue-500/10 rounded-lg">
                  <Bot className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-blue-500">Yapay Zekaya Karşı</p>
                    <p className="text-xs text-muted-foreground">
                      AI rakibine karşı antrenman yap! Oyunu öğrenmek için ideal mod.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2 bg-purple-500/10 rounded-lg">
                  <Zap className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-purple-500">Rastgele Eşleşme</p>
                    <p className="text-xs text-muted-foreground">
                      Gerçek oyuncularla eşleş ve rekabet et!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2 bg-green-500/10 rounded-lg">
                  <Users className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-500">Özel Oda</p>
                    <p className="text-xs text-muted-foreground">
                      Arkadaşlarınla özel oda oluştur ve davet et!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2 bg-yellow-500/10 rounded-lg">
                  <Trophy className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-yellow-500">Turnuva</p>
                    <p className="text-xs text-muted-foreground">
                      8 kişilik turnuvalara katıl, şampiyon ol ve ödüller kazan!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sohbet */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-bold text-primary flex items-center gap-2 mb-2">
                <MessageSquare className="w-5 h-5" />
                Sohbet
              </h3>
              <p className="text-muted-foreground text-xs">
                Diğer oyuncularla sohbet et, arkadaşlık kur! Genel sohbet odasında 
                herkesle iletişim kurabilir veya özel mesaj gönderebilirsin.
              </p>
            </div>

            {/* Mini Oyunlar */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-bold text-primary flex items-center gap-2 mb-2">
                <Dices className="w-5 h-5" />
                Mini Oyunlar
              </h3>
              <p className="text-muted-foreground text-xs mb-2">
                Eğlenceli mini oyunlarla vakit geçir ve ödüller kazan:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-xs bg-background/50 p-2 rounded">
                  <Brain className="w-4 h-4 text-pink-500" />
                  <span>Hafıza Oyunu</span>
                </div>
                <div className="flex items-center gap-2 text-xs bg-background/50 p-2 rounded">
                  <Puzzle className="w-4 h-4 text-orange-500" />
                  <span>Puzzle</span>
                </div>
                <div className="flex items-center gap-2 text-xs bg-background/50 p-2 rounded">
                  <Target className="w-4 h-4 text-cyan-500" />
                  <span>Yılan Oyunu</span>
                </div>
                <div className="flex items-center gap-2 text-xs bg-background/50 p-2 rounded">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Ve daha fazlası...</span>
                </div>
              </div>
            </div>

            {/* Günlük Çark */}
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4">
              <h3 className="font-bold text-primary flex items-center gap-2 mb-2">
                🎡 Günlük Çark
              </h3>
              <p className="text-muted-foreground text-xs">
                Her gün çarkı çevir ve sürpriz ödüller kazan! 
                Jokerler, mürekkep ve daha fazlası seni bekliyor.
              </p>
            </div>

            {/* İpucu */}
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <h3 className="font-bold text-primary flex items-center gap-2 mb-2">
                💡 İpucu
              </h3>
              <p className="text-muted-foreground text-xs">
                İlk olarak <strong>"Yapay Zekaya Karşı"</strong> modunda antrenman yapmanı öneriyoruz. 
                Böylece oyunu öğrenip rakiplerine karşı hazır olabilirsin!
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="pt-4 border-t">
          <Button 
            onClick={handleComplete} 
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Hadi Başlayalım!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
