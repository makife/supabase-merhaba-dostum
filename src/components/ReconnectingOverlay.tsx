/**
 * Reconnecting Overlay Component
 * Bağlantı yeniden kurulurken sayfanın üzerine yarı saydam overlay ekler
 * Sayfa unmount olmaz, kullanıcı nerede kaldığını görür
 */
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

interface ReconnectingOverlayProps {
  isVisible: boolean;
  status?: "connecting" | "reconnecting" | "restoring";
  message?: string;
}

export function ReconnectingOverlay({ 
  isVisible, 
  status = "reconnecting",
  message 
}: ReconnectingOverlayProps) {
  const statusConfig = {
    connecting: {
      icon: Wifi,
      text: "Bağlanılıyor...",
      color: "text-blue-400",
    },
    reconnecting: {
      icon: RefreshCw,
      text: "Yeniden bağlanılıyor...",
      color: "text-yellow-400",
    },
    restoring: {
      icon: WifiOff,
      text: "Bağlantı geri yükleniyor...",
      color: "text-orange-400",
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          style={{ pointerEvents: "all" }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="flex flex-col items-center space-y-4 p-8 rounded-2xl bg-background/90 border border-border shadow-2xl"
          >
            {/* Animated Icon */}
            <div className="relative">
              <motion.div
                animate={{ rotate: status === "reconnecting" ? 360 : 0 }}
                transition={{ 
                  duration: 1.5, 
                  repeat: status === "reconnecting" ? Infinity : 0,
                  ease: "linear"
                }}
              >
                <Icon className={`w-12 h-12 ${config.color}`} />
              </motion.div>
              
              {/* Pulsing ring */}
              <motion.div
                className={`absolute inset-0 rounded-full border-2 ${config.color.replace("text-", "border-")}`}
                animate={{ 
                  scale: [1, 1.4, 1],
                  opacity: [0.5, 0, 0.5]
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </div>

            {/* Status Text */}
            <p className={`text-lg font-medium ${config.color}`}>
              {message || config.text}
            </p>

            {/* Sub text */}
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Lütfen bekleyin, oyununuz güvenli bir şekilde korunuyor
            </p>

            {/* Progress dots */}
            <div className="flex space-x-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className={`w-2 h-2 rounded-full ${config.color.replace("text-", "bg-")}`}
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{ 
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
