import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface ParticlePosition {
  row: number;
  col: number;
}

interface JokerParticleEffectsProps {
  type: "degistir" | "fisilida" | "senyaz" | null;
  positions: ParticlePosition[];
  gridRef?: React.RefObject<HTMLDivElement>;
  onComplete?: () => void;
}

// Yıldız parçacığı - Fısılda jokeri için
const StarParticle = ({ x, y, delay }: { x: number; y: number; delay: number }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0, x, y }}
    animate={{
      scale: [0, 1.5, 1, 1.2, 0],
      opacity: [0, 1, 1, 1, 0],
      rotate: [0, 180, 360],
    }}
    transition={{
      duration: 0.8,
      delay,
      ease: "easeOut",
    }}
    className="absolute pointer-events-none z-50"
    style={{ left: x, top: y }}
  >
    <span className="text-2xl filter drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]">⭐</span>
  </motion.div>
);

// Yıldız izi - Fısılda jokeri için harfler arası gezen yıldız
const StarTrail = ({ positions, cellSize }: { positions: { x: number; y: number }[]; cellSize: number }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (positions.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= positions.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [positions.length]);

  if (positions.length === 0) return null;

  return (
    <>
      {/* Ana yıldız */}
      <motion.div
        className="absolute pointer-events-none z-50"
        animate={{
          x: positions[currentIndex]?.x || 0,
          y: positions[currentIndex]?.y || 0,
        }}
        transition={{
          duration: 0.4,
          ease: "easeInOut",
        }}
      >
        <motion.span
          className="text-3xl filter drop-shadow-[0_0_12px_rgba(255,215,0,1)]"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.3, 1],
          }}
          transition={{
            rotate: { duration: 1, repeat: Infinity, ease: "linear" },
            scale: { duration: 0.5, repeat: Infinity },
          }}
        >
          ⭐
        </motion.span>
      </motion.div>

      {/* Yıldız izi parçacıkları */}
      {positions.slice(0, currentIndex + 1).map((pos, i) => (
        <motion.div
          key={i}
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="absolute pointer-events-none"
          style={{ left: pos.x, top: pos.y }}
        >
          <span className="text-lg text-yellow-300">✨</span>
        </motion.div>
      ))}
    </>
  );
};

// Duman parçacığı - Değiştir jokeri için
const SmokeParticle = ({ x, y, delay }: { x: number; y: number; delay: number }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0, y: y + 20 }}
    animate={{
      scale: [0, 1.5, 2, 2.5],
      opacity: [0, 0.6, 0.4, 0],
      y: [y + 20, y - 10, y - 30, y - 50],
      x: [x, x + (Math.random() - 0.5) * 30, x + (Math.random() - 0.5) * 50],
    }}
    transition={{
      duration: 1.2,
      delay,
      ease: "easeOut",
    }}
    className="absolute pointer-events-none z-50"
    style={{ left: x }}
  >
    <div className="w-8 h-8 rounded-full bg-gradient-to-t from-gray-600/60 to-gray-400/40 blur-sm" />
  </motion.div>
);

// Duman bulutu - Değiştir jokeri için
const SmokeCloud = ({ positions }: { positions: { x: number; y: number }[] }) => (
  <>
    {positions.map((pos, i) => (
      <div key={i}>
        {/* Çoklu duman parçacıkları */}
        {[0, 0.1, 0.2, 0.3].map((delay, j) => (
          <SmokeParticle key={j} x={pos.x + (Math.random() - 0.5) * 20} y={pos.y} delay={delay + i * 0.15} />
        ))}
        {/* Puf efekti */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: [0, 1.5, 0],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 0.6,
            delay: i * 0.15,
          }}
          className="absolute pointer-events-none z-50"
          style={{ left: pos.x - 15, top: pos.y - 15 }}
        >
          <div className="w-12 h-12 rounded-full bg-gradient-radial from-white/60 to-transparent" />
        </motion.div>
      </div>
    ))}
  </>
);

// Sparkle parçacığı - Sen Yaz jokeri için
const SparkleParticle = ({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{
      scale: [0, 1, 0],
      opacity: [0, 1, 0],
      rotate: [0, 180, 360],
    }}
    transition={{
      duration: 0.8,
      delay,
      ease: "easeOut",
    }}
    className="absolute pointer-events-none z-50"
    style={{ left: x, top: y }}
  >
    <span className={`text-xl filter ${color}`}>✦</span>
  </motion.div>
);

// Sen Yaz efekti - Sıralı sparkle patlamaları
const SenYazEffect = ({ positions }: { positions: { x: number; y: number }[] }) => {
  const colors = [
    "drop-shadow-[0_0_8px_rgba(59,130,246,0.8)] text-blue-400",
    "drop-shadow-[0_0_8px_rgba(168,85,247,0.8)] text-purple-400",
    "drop-shadow-[0_0_8px_rgba(236,72,153,0.8)] text-pink-400",
    "drop-shadow-[0_0_8px_rgba(34,197,94,0.8)] text-green-400",
    "drop-shadow-[0_0_8px_rgba(234,179,8,0.8)] text-yellow-400",
  ];

  return (
    <>
      {positions.map((pos, i) => (
        <div key={i}>
          {/* Merkez patlaması */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: [0, 2, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 0.5,
              delay: i * 0.4,
            }}
            className="absolute pointer-events-none z-50"
            style={{ left: pos.x - 10, top: pos.y - 10 }}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-radial from-purple-400/80 to-transparent" />
          </motion.div>

          {/* Dağılan parçacıklar */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, j) => {
            const rad = (angle * Math.PI) / 180;
            const distance = 25;
            const px = pos.x + Math.cos(rad) * distance;
            const py = pos.y + Math.sin(rad) * distance;
            return (
              <SparkleParticle
                key={j}
                x={px}
                y={py}
                delay={i * 0.4 + 0.1}
                color={colors[(i + j) % colors.length]}
              />
            );
          })}

          {/* Yazı efekti - kalem çizgisi */}
          <motion.div
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 0.6,
              delay: i * 0.4,
            }}
            className="absolute pointer-events-none z-50"
            style={{ left: pos.x - 5, top: pos.y - 5 }}
          >
            <span className="text-lg filter drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]">✍️</span>
          </motion.div>
        </div>
      ))}
    </>
  );
};

export const JokerParticleEffects = ({
  type,
  positions,
  gridRef,
  onComplete,
}: JokerParticleEffectsProps) => {
  const [pixelPositions, setPixelPositions] = useState<{ x: number; y: number }[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!type || positions.length === 0) {
      setIsActive(false);
      return;
    }

    // Grid cell boyutunu hesapla (yaklaşık)
    const cellSize = gridRef?.current 
      ? gridRef.current.offsetWidth / 4 
      : 70;
    
    const gridRect = gridRef?.current?.getBoundingClientRect();
    const offsetX = gridRect?.left || 0;
    const offsetY = gridRect?.top || 0;

    // Grid pozisyonlarını piksel pozisyonlarına çevir
    const newPositions = positions.map((pos) => ({
      x: pos.col * cellSize + cellSize / 2,
      y: pos.row * cellSize + cellSize / 2,
    }));

    setPixelPositions(newPositions);
    setIsActive(true);

    // Efekt tamamlandığında callback
    const duration = type === "fisilida" 
      ? positions.length * 500 + 1000 
      : type === "senyaz" 
        ? positions.length * 400 + 1000 
        : 1500;

    const timeout = setTimeout(() => {
      setIsActive(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timeout);
  }, [type, positions, gridRef, onComplete]);

  if (!isActive || pixelPositions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
      <AnimatePresence>
        {type === "fisilida" && (
          <StarTrail positions={pixelPositions} cellSize={70} />
        )}
        
        {type === "degistir" && (
          <SmokeCloud positions={pixelPositions} />
        )}
        
        {type === "senyaz" && (
          <SenYazEffect positions={pixelPositions} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default JokerParticleEffects;
