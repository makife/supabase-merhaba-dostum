// ContactDialog.tsx
// Bunu components/ klasörüne ekleyin

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SendStatus = "idle" | "loading" | "success" | "error";

export const ContactDialog = ({ open, onOpenChange }: ContactDialogProps) => {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          subject: subject.trim(),
          message: message.trim(),
          senderEmail: user?.email ?? "Anonim",
        },
      });

      if (error || data?.error) {
        throw new Error(error?.message || data?.error || "Bilinmeyen hata");
      }

      setStatus("success");
      setSubject("");
      setMessage("");
    } catch (err: any) {
      console.error("Mail gönderilemedi:", err);
      setStatus("error");
      setErrorMsg(err.message ?? "Mail gönderilemedi. Lütfen tekrar deneyin.");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Kısa delay sonra state'i sıfırla (kapanış animasyonu için)
    setTimeout(() => {
      setStatus("idle");
      setSubject("");
      setMessage("");
      setErrorMsg("");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#16213e] border-white/10 text-white max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-cyan-500/20 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-cyan-400" />
            </div>
            İletişim
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Mesajınız doğrudan <span className="text-cyan-400 font-mono text-xs">team@kelimele.site</span> adresine
            iletilecektir.
          </DialogDescription>
        </DialogHeader>

        {/* SUCCESS STATE */}
        {status === "success" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Mesajınız İletildi!</h3>
            <p className="text-sm text-slate-400">En kısa sürede size geri dönüş yapacağız. Teşekkürler 🙏</p>
            <Button
              onClick={handleClose}
              className="mt-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-400/30"
            >
              Kapat
            </Button>
          </div>
        )}

        {/* FORM STATE */}
        {status !== "success" && (
          <div className="space-y-4 pt-2">
            {/* Konu */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Konu</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Örn: Bug raporu, Öneri, Soru..."
                maxLength={100}
                disabled={status === "loading"}
                className="bg-slate-800/60 border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
              />
              <p className="text-xs text-slate-500 text-right">{subject.length}/100</p>
            </div>

            {/* Mesaj */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Mesaj</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mesajınızı buraya yazın..."
                maxLength={1000}
                rows={5}
                disabled={status === "loading"}
                className="bg-slate-800/60 border-white/10 text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 resize-none"
              />
              <p className="text-xs text-slate-500 text-right">{message.length}/1000</p>
            </div>

            {/* Error message */}
            {status === "error" && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-400/20 rounded-lg">
                <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-300">{errorMsg}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleClose}
                disabled={status === "loading"}
                className="flex-1 bg-slate-700/60 hover:bg-slate-700 text-slate-300 border border-white/10"
              >
                İptal
              </Button>
              <Button
                onClick={handleSend}
                disabled={!subject.trim() || !message.trim() || status === "loading"}
                className="flex-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-400/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gönderiliyor...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Gönder
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
