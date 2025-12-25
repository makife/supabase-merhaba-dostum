import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";

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

// Kuyruklu Yıldız Efekti - Fısılda jokeri için
const CometTrail = ({ positions, cellSize }: { positions: { x: number; y: number }[]; cellSize: number }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [trail, setTrail] = useState<{ x: number; y: number; id: number }[]>([]);

  useEffect(() => {
    if (positions.length === 0) return;
    
    let trailId = 0;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= positions.length) {
          clearInterval(interval);
          return prev;
        }
        
        // Kuyruk parçacıkları ekle
        const currentPos = positions[prev];
        const newTrailParticles = Array.from({ length: 15 }, (_, i) => ({
          x: currentPos.x + (Math.random() - 0.5) * 20,
          y: currentPos.y + (Math.random() - 0.5) * 20,
          id: trailId++,
        }));
        setTrail(t => [...t, ...newTrailParticles].slice(-60));
        
        return next;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [positions]);

  if (positions.length === 0) return null;

  const currentPos = positions[Math.min(currentIndex, positions.length - 1)];

  return (
    <>
      {/* Kuyruk parçacıkları */}
      {trail.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute pointer-events-none"
          style={{ left: particle.x, top: particle.y }}
        >
          <span className="text-yellow-300 text-sm">✦</span>
        </motion.div>
      ))}

      {/* Ana kuyruklu yıldız */}
      <motion.div
        className="absolute pointer-events-none z-50"
        animate={{
          x: currentPos?.x || 0,
          y: currentPos?.y || 0,
        }}
        transition={{
          duration: 0.35,
          ease: "easeInOut",
        }}
      >
        {/* Işık halesi */}
        <motion.div
          className="absolute -inset-8 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,215,0,0.6) 0%, rgba(255,165,0,0.3) 40%, transparent 70%)",
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
          }}
        />
        
        {/* Kuyruk ışınları */}
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: -15 - i * 8,
              top: -2,
              width: 20 + i * 5,
              height: 4,
              background: `linear-gradient(90deg, rgba(255,${200 - i * 20},0,${0.8 - i * 0.1}) 0%, transparent 100%)`,
              borderRadius: "2px",
              filter: "blur(1px)",
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
              scaleX: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 0.3,
              repeat: Infinity,
              delay: i * 0.05,
            }}
          />
        ))}
        
        {/* Ana yıldız */}
        <motion.span
          className="text-4xl filter drop-shadow-[0_0_20px_rgba(255,215,0,1)]"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.2, 1],
          }}
          transition={{
            rotate: { duration: 0.5, repeat: Infinity, ease: "linear" },
            scale: { duration: 0.3, repeat: Infinity },
          }}
        >
          ⭐
        </motion.span>
        
        {/* Kıvılcımlar */}
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={`spark-${i}`}
            className="absolute"
            style={{
              left: -10 - Math.random() * 30,
              top: (Math.random() - 0.5) * 20,
            }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{
              opacity: [1, 0],
              scale: [1, 0],
              x: [-20, -50],
              y: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 50],
            }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          >
            <span className="text-yellow-200 text-xs">✧</span>
          </motion.div>
        ))}
      </motion.div>
      
      {/* Hedef pozisyonlarda patlama efekti */}
      {positions.slice(0, currentIndex + 1).map((pos, i) => (
        <motion.div
          key={`burst-${i}`}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="absolute pointer-events-none"
          style={{ left: pos.x - 20, top: pos.y - 20 }}
        >
          <div 
            className="w-10 h-10 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,215,0,0.8) 0%, rgba(255,165,0,0.4) 50%, transparent 70%)",
            }}
          />
        </motion.div>
      ))}
    </>
  );
};

// Yoğun Duman Efekti - Değiştir jokeri için
const IntenseSmokeEffect = ({ positions }: { positions: { x: number; y: number }[] }) => {
  const smokeParticles = useMemo(() => {
    return positions.flatMap((pos, posIndex) => 
      Array.from({ length: 20 }, (_, i) => ({
        id: `${posIndex}-${i}`,
        x: pos.x + (Math.random() - 0.5) * 30,
        y: pos.y,
        delay: posIndex * 0.1 + i * 0.03,
        size: 15 + Math.random() * 25,
        duration: 1 + Math.random() * 0.5,
        offsetX: (Math.random() - 0.5) * 60,
        offsetY: -30 - Math.random() * 60,
      }))
    );
  }, [positions]);

  return (
    <>
      {/* Merkez patlama */}
      {positions.map((pos, i) => (
        <motion.div
          key={`flash-${i}`}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
          className="absolute pointer-events-none"
          style={{ left: pos.x - 20, top: pos.y - 20 }}
        >
          <div 
            className="w-10 h-10 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(200,200,200,0.5) 50%, transparent 70%)",
            }}
          />
        </motion.div>
      ))}

      {/* Duman parçacıkları */}
      {smokeParticles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ 
            scale: 0.3, 
            opacity: 0,
            x: particle.x,
            y: particle.y,
          }}
          animate={{
            scale: [0.3, 1.5, 2],
            opacity: [0, 0.7, 0],
            x: particle.x + particle.offsetX,
            y: particle.y + particle.offsetY,
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: "easeOut",
          }}
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0 }}
        >
          <div 
            className="rounded-full"
            style={{
              width: particle.size,
              height: particle.size,
              background: `radial-gradient(circle, rgba(120,120,120,0.8) 0%, rgba(80,80,80,0.4) 50%, transparent 70%)`,
              filter: "blur(3px)",
            }}
          />
        </motion.div>
      ))}

      {/* Büyük duman bulutları */}
      {positions.map((pos, i) => (
        <motion.div
          key={`cloud-${i}`}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: [0.5, 2.5, 3],
            opacity: [0, 0.5, 0],
            y: [0, -40, -80],
          }}
          transition={{
            duration: 1.2,
            delay: i * 0.15,
            ease: "easeOut",
          }}
          className="absolute pointer-events-none"
          style={{ left: pos.x - 30, top: pos.y - 30 }}
        >
          <div 
            className="w-16 h-16 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(100,100,100,0.6) 0%, rgba(60,60,60,0.3) 60%, transparent 80%)",
              filter: "blur(8px)",
            }}
          />
        </motion.div>
      ))}

      {/* Puf emoji efekti */}
      {positions.map((pos, i) => (
        <motion.div
          key={`puff-${i}`}
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{
            scale: [0, 1.5, 0],
            opacity: [0, 1, 0],
            rotate: [0, 180],
            y: [0, -20],
          }}
          transition={{
            duration: 0.8,
            delay: i * 0.12,
          }}
          className="absolute pointer-events-none z-50"
          style={{ left: pos.x - 15, top: pos.y - 15 }}
        >
          <span className="text-3xl">💨</span>
        </motion.div>
      ))}
    </>
  );
};

// Yoğun Sparkle Efekti - Sen Yaz jokeri için
const IntenseSparkleEffect = ({ positions }: { positions: { x: number; y: number }[] }) => {
  const colors = [
    "rgba(59,130,246,1)",   // blue
    "rgba(168,85,247,1)",   // purple
    "rgba(236,72,153,1)",   // pink
    "rgba(34,197,94,1)",    // green
    "rgba(234,179,8,1)",    // yellow
    "rgba(239,68,68,1)",    // red
  ];

  const sparkles = useMemo(() => {
    return positions.flatMap((pos, posIndex) => 
      Array.from({ length: 24 }, (_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const distance = 40 + Math.random() * 30;
        return {
          id: `${posIndex}-${i}`,
          startX: pos.x,
          startY: pos.y,
          endX: pos.x + Math.cos(angle) * distance,
          endY: pos.y + Math.sin(angle) * distance,
          delay: posIndex * 0.3 + i * 0.02,
          color: colors[(posIndex + i) % colors.length],
          size: 8 + Math.random() * 8,
        };
      })
    );
  }, [positions]);

  return (
    <>
      {/* Merkez patlama halesi */}
      {positions.map((pos, i) => (
        <motion.div
          key={`halo-${i}`}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.8, delay: i * 0.3 }}
          className="absolute pointer-events-none"
          style={{ left: pos.x - 30, top: pos.y - 30 }}
        >
          <div 
            className="w-16 h-16 rounded-full"
            style={{
              background: `radial-gradient(circle, ${colors[i % colors.length]} 0%, transparent 70%)`,
            }}
          />
        </motion.div>
      ))}

      {/* Yıldız patlaması */}
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          initial={{ 
            x: sparkle.startX,
            y: sparkle.startY,
            scale: 0,
            opacity: 1,
          }}
          animate={{
            x: sparkle.endX,
            y: sparkle.endY,
            scale: [0, 1.5, 0],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 0.6,
            delay: sparkle.delay,
            ease: "easeOut",
          }}
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0 }}
        >
          <div
            style={{
              width: sparkle.size,
              height: sparkle.size,
              background: sparkle.color,
              borderRadius: "50%",
              boxShadow: `0 0 ${sparkle.size}px ${sparkle.color}`,
            }}
          />
        </motion.div>
      ))}

      {/* Kalem/yazı efekti */}
      {positions.map((pos, i) => (
        <motion.div
          key={`pen-${i}`}
          initial={{ scale: 0, opacity: 0, y: 20 }}
          animate={{
            scale: [0, 1.5, 1, 0],
            opacity: [0, 1, 1, 0],
            y: [20, 0, -10, -20],
            rotate: [0, -15, 15, 0],
          }}
          transition={{
            duration: 1,
            delay: i * 0.3,
          }}
          className="absolute pointer-events-none z-50"
          style={{ left: pos.x - 15, top: pos.y - 15 }}
        >
          <span className="text-3xl filter drop-shadow-[0_0_10px_rgba(168,85,247,0.8)]">✍️</span>
        </motion.div>
      ))}

      {/* Parıltı yağmuru */}
      {positions.map((pos, posIndex) => (
        Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={`glitter-${posIndex}-${i}`}
            initial={{ 
              opacity: 0,
              scale: 0,
              x: pos.x + (Math.random() - 0.5) * 40,
              y: pos.y - 20,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1, 0],
              y: pos.y + 40,
            }}
            transition={{
              duration: 0.8,
              delay: posIndex * 0.3 + 0.2 + i * 0.08,
            }}
            className="absolute pointer-events-none"
          >
            <span className="text-lg" style={{ color: colors[(posIndex + i) % colors.length] }}>✦</span>
          </motion.div>
        ))
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

    // Grid cell boyutunu hesapla
    const cellSize = gridRef?.current 
      ? gridRef.current.offsetWidth / 4 
      : 70;

    // Grid pozisyonlarını piksel pozisyonlarına çevir
    const newPositions = positions.map((pos) => ({
      x: pos.col * cellSize + cellSize / 2,
      y: pos.row * cellSize + cellSize / 2,
    }));

    setPixelPositions(newPositions);
    setIsActive(true);

    // Efekt tamamlandığında callback
    const duration = type === "fisilida" 
      ? positions.length * 500 + 1500 
      : type === "senyaz" 
        ? positions.length * 400 + 1500 
        : 2000;

    const timeout = setTimeout(() => {
      setIsActive(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timeout);
  }, [type, positions, gridRef, onComplete]);

  if (!isActive || pixelPositions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
      <AnimatePresence>
        {type === "fisilida" && (
          <CometTrail positions={pixelPositions} cellSize={70} />
        )}
        
        {type === "degistir" && (
          <IntenseSmokeEffect positions={pixelPositions} />
        )}
        
        {type === "senyaz" && (
          <IntenseSparkleEffect positions={pixelPositions} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default JokerParticleEffects;
