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
  const [trail, setTrail] = useState<{ x: number; y: number; id: number; size: number; color: string }[]>([]);

  const cometColors = ["#FFD700", "#FFA500", "#FF8C00", "#FF6347", "#FFFF00"];

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
        
        // Yoğun kuyruk parçacıkları
        const currentPos = positions[prev];
        const newTrailParticles = Array.from({ length: 40 }, (_, i) => ({
          x: currentPos.x + (Math.random() - 0.5) * 40,
          y: currentPos.y + (Math.random() - 0.5) * 40,
          id: trailId++,
          size: 4 + Math.random() * 12,
          color: cometColors[Math.floor(Math.random() * cometColors.length)],
        }));
        setTrail(t => [...t, ...newTrailParticles].slice(-150));
        
        return next;
      });
    }, 350);

    return () => clearInterval(interval);
  }, [positions]);

  if (positions.length === 0) return null;

  const currentPos = positions[Math.min(currentIndex, positions.length - 1)];

  return (
    <>
      {/* Yoğun kuyruk parçacıkları */}
      {trail.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ scale: 1.5, opacity: 1 }}
          animate={{ scale: 0, opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute pointer-events-none rounded-full"
          style={{ 
            left: particle.x, 
            top: particle.y,
            width: particle.size,
            height: particle.size,
            background: particle.color,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
          }}
        />
      ))}

      {/* Ana kuyruklu yıldız */}
      <motion.div
        className="absolute pointer-events-none z-50"
        animate={{
          x: currentPos?.x || 0,
          y: currentPos?.y || 0,
        }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
      >
        {/* Çok katmanlı ışık halesi */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 120,
            height: 120,
            left: -60,
            top: -60,
            background: "radial-gradient(circle, rgba(255,215,0,0.9) 0%, rgba(255,165,0,0.6) 30%, rgba(255,69,0,0.3) 60%, transparent 80%)",
          }}
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.8, 1, 0.8],
          }}
          transition={{
            duration: 0.3,
            repeat: Infinity,
          }}
        />
        
        {/* İkinci hale katmanı */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 80,
            height: 80,
            left: -40,
            top: -40,
            background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,215,0,0.8) 40%, transparent 70%)",
          }}
          animate={{
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 0.2,
            repeat: Infinity,
          }}
        />
        
        {/* Yoğun kuyruk ışınları */}
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: -20 - i * 10,
              top: -3 + (Math.sin(i * 0.5) * 6),
              width: 30 + i * 8,
              height: 6 - i * 0.3,
              background: `linear-gradient(90deg, rgba(255,${220 - i * 12},${50 - i * 3},${1 - i * 0.05}) 0%, transparent 100%)`,
              borderRadius: "3px",
              filter: "blur(2px)",
            }}
            animate={{
              opacity: [0.6, 1, 0.6],
              scaleX: [0.9, 1.3, 0.9],
            }}
            transition={{
              duration: 0.2,
              repeat: Infinity,
              delay: i * 0.03,
            }}
          />
        ))}
        
        {/* Merkez parlak nokta */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 24,
            height: 24,
            left: -12,
            top: -12,
            background: "radial-gradient(circle, #FFFFFF 0%, #FFD700 50%, #FFA500 100%)",
            boxShadow: "0 0 30px #FFD700, 0 0 60px #FFA500, 0 0 90px #FF6347",
          }}
          animate={{
            scale: [1, 1.4, 1],
          }}
          transition={{
            duration: 0.15,
            repeat: Infinity,
          }}
        />
        
        {/* Yoğun kıvılcımlar */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={`spark-${i}`}
            className="absolute rounded-full"
            style={{
              width: 4 + Math.random() * 6,
              height: 4 + Math.random() * 6,
              background: cometColors[i % cometColors.length],
              boxShadow: `0 0 8px ${cometColors[i % cometColors.length]}`,
            }}
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{
              opacity: [1, 0],
              scale: [1, 0],
              x: [-30, -80 - Math.random() * 40],
              y: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 80],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.05,
            }}
          />
        ))}
      </motion.div>
      
      {/* Hedef pozisyonlarda büyük patlama efekti */}
      {positions.slice(0, currentIndex + 1).map((pos, i) => (
        <motion.div
          key={`burst-${i}`}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="absolute pointer-events-none"
          style={{ left: pos.x - 40, top: pos.y - 40 }}
        >
          <div 
            className="w-20 h-20 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,215,0,0.8) 30%, rgba(255,165,0,0.4) 60%, transparent 80%)",
            }}
          />
        </motion.div>
      ))}

      {/* Patlama halkaları */}
      {positions.slice(0, currentIndex + 1).map((pos, i) => (
        <motion.div
          key={`ring-${i}`}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="absolute pointer-events-none rounded-full border-4 border-yellow-400"
          style={{ 
            left: pos.x - 30, 
            top: pos.y - 30,
            width: 60,
            height: 60,
            boxShadow: "0 0 20px rgba(255,215,0,0.8)",
          }}
        />
      ))}
    </>
  );
};

// Yoğun Duman Efekti - Değiştir jokeri için
const IntenseSmokeEffect = ({ positions }: { positions: { x: number; y: number }[] }) => {
  const smokeColors = [
    "rgba(80,80,80,0.9)",
    "rgba(100,100,100,0.8)",
    "rgba(120,120,120,0.7)",
    "rgba(60,60,60,0.85)",
    "rgba(140,140,140,0.6)",
  ];

  const smokeParticles = useMemo(() => {
    return positions.flatMap((pos, posIndex) => 
      Array.from({ length: 50 }, (_, i) => ({
        id: `${posIndex}-${i}`,
        x: pos.x + (Math.random() - 0.5) * 50,
        y: pos.y,
        delay: posIndex * 0.08 + i * 0.02,
        size: 20 + Math.random() * 40,
        duration: 1.2 + Math.random() * 0.6,
        offsetX: (Math.random() - 0.5) * 100,
        offsetY: -50 - Math.random() * 100,
        color: smokeColors[Math.floor(Math.random() * smokeColors.length)],
        blur: 4 + Math.random() * 8,
      }))
    );
  }, [positions]);

  return (
    <>
      {/* Merkez parlama patlaması */}
      {positions.map((pos, i) => (
        <motion.div
          key={`flash-${i}`}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 5, opacity: 0 }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="absolute pointer-events-none"
          style={{ left: pos.x - 40, top: pos.y - 40 }}
        >
          <div 
            className="w-20 h-20 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(200,200,200,0.6) 40%, transparent 70%)",
            }}
          />
        </motion.div>
      ))}

      {/* İkinci dalga patlama */}
      {positions.map((pos, i) => (
        <motion.div
          key={`flash2-${i}`}
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 0.4, delay: i * 0.08 + 0.1 }}
          className="absolute pointer-events-none"
          style={{ left: pos.x - 25, top: pos.y - 25 }}
        >
          <div 
            className="w-12 h-12 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(180,180,180,0.9) 0%, rgba(100,100,100,0.5) 60%, transparent 80%)",
            }}
          />
        </motion.div>
      ))}

      {/* Yoğun duman parçacıkları */}
      {smokeParticles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ 
            scale: 0.2, 
            opacity: 0,
            x: particle.x,
            y: particle.y,
          }}
          animate={{
            scale: [0.2, 2, 2.5],
            opacity: [0, 0.9, 0],
            x: particle.x + particle.offsetX,
            y: particle.y + particle.offsetY,
            rotate: [0, Math.random() * 180],
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
              background: `radial-gradient(circle, ${particle.color} 0%, transparent 70%)`,
              filter: `blur(${particle.blur}px)`,
            }}
          />
        </motion.div>
      ))}

      {/* Ekstra büyük duman bulutları */}
      {positions.map((pos, i) => (
        Array.from({ length: 5 }).map((_, j) => (
          <motion.div
            key={`cloud-${i}-${j}`}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{
              scale: [0.3, 3, 4],
              opacity: [0, 0.7, 0],
              y: [0, -60 - j * 20, -120 - j * 30],
              x: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 80],
            }}
            transition={{
              duration: 1.5,
              delay: i * 0.1 + j * 0.1,
              ease: "easeOut",
            }}
            className="absolute pointer-events-none"
            style={{ left: pos.x - 50, top: pos.y - 50 }}
          >
            <div 
              className="w-24 h-24 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(90,90,90,0.8) 0%, rgba(50,50,50,0.4) 50%, transparent 70%)",
                filter: "blur(12px)",
              }}
            />
          </motion.div>
        ))
      ))}

      {/* Duman halkaları */}
      {positions.map((pos, i) => (
        <motion.div
          key={`ring-${i}`}
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 1, delay: i * 0.1 }}
          className="absolute pointer-events-none rounded-full"
          style={{ 
            left: pos.x - 40, 
            top: pos.y - 40,
            width: 80,
            height: 80,
            border: "3px solid rgba(150,150,150,0.6)",
            filter: "blur(2px)",
          }}
        />
      ))}
    </>
  );
};

// Yoğun Sparkle Efekti - Sen Yaz jokeri için
const IntenseSparkleEffect = ({ positions }: { positions: { x: number; y: number }[] }) => {
  const colors = [
    "#3B82F6",   // blue
    "#A855F7",   // purple
    "#EC4899",   // pink
    "#22C55E",   // green
    "#EAB308",   // yellow
    "#EF4444",   // red
    "#06B6D4",   // cyan
    "#F97316",   // orange
  ];

  const sparkles = useMemo(() => {
    return positions.flatMap((pos, posIndex) => 
      Array.from({ length: 40 }, (_, i) => {
        const angle = (i / 40) * Math.PI * 2;
        const distance = 50 + Math.random() * 50;
        return {
          id: `${posIndex}-${i}`,
          startX: pos.x,
          startY: pos.y,
          endX: pos.x + Math.cos(angle) * distance,
          endY: pos.y + Math.sin(angle) * distance,
          delay: posIndex * 0.25 + i * 0.015,
          color: colors[(posIndex + i) % colors.length],
          size: 6 + Math.random() * 10,
        };
      })
    );
  }, [positions]);

  const innerSparkles = useMemo(() => {
    return positions.flatMap((pos, posIndex) => 
      Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        const distance = 25 + Math.random() * 25;
        return {
          id: `inner-${posIndex}-${i}`,
          startX: pos.x,
          startY: pos.y,
          endX: pos.x + Math.cos(angle) * distance,
          endY: pos.y + Math.sin(angle) * distance,
          delay: posIndex * 0.25 + 0.1 + i * 0.02,
          color: "#FFFFFF",
          size: 4 + Math.random() * 6,
        };
      })
    );
  }, [positions]);

  return (
    <>
      {/* Çoklu merkez patlama haleleri */}
      {positions.map((pos, i) => (
        <motion.div
          key={`halo-${i}`}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 6, opacity: 0 }}
          transition={{ duration: 1, delay: i * 0.25 }}
          className="absolute pointer-events-none"
          style={{ left: pos.x - 50, top: pos.y - 50 }}
        >
          <div 
            className="w-24 h-24 rounded-full"
            style={{
              background: `radial-gradient(circle, ${colors[i % colors.length]} 0%, transparent 70%)`,
            }}
          />
        </motion.div>
      ))}

      {/* İkinci hale katmanı */}
      {positions.map((pos, i) => (
        <motion.div
          key={`halo2-${i}`}
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.7, delay: i * 0.25 + 0.1 }}
          className="absolute pointer-events-none"
          style={{ left: pos.x - 35, top: pos.y - 35 }}
        >
          <div 
            className="w-16 h-16 rounded-full"
            style={{
              background: `radial-gradient(circle, rgba(255,255,255,1) 0%, ${colors[(i + 2) % colors.length]} 50%, transparent 80%)`,
            }}
          />
        </motion.div>
      ))}

      {/* Dış halka yıldız patlaması */}
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
            scale: [0, 2, 0],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: 0.7,
            delay: sparkle.delay,
            ease: "easeOut",
          }}
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0 }}
        >
          <div
            className="rounded-full"
            style={{
              width: sparkle.size,
              height: sparkle.size,
              background: sparkle.color,
              boxShadow: `0 0 ${sparkle.size * 2}px ${sparkle.color}, 0 0 ${sparkle.size * 4}px ${sparkle.color}`,
            }}
          />
        </motion.div>
      ))}

      {/* İç halka beyaz parıltılar */}
      {innerSparkles.map((sparkle) => (
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
            duration: 0.5,
            delay: sparkle.delay,
            ease: "easeOut",
          }}
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0 }}
        >
          <div
            className="rounded-full"
            style={{
              width: sparkle.size,
              height: sparkle.size,
              background: sparkle.color,
              boxShadow: `0 0 ${sparkle.size * 3}px ${sparkle.color}`,
            }}
          />
        </motion.div>
      ))}

      {/* Merkez parlak ışık */}
      {positions.map((pos, i) => (
        <motion.div
          key={`center-${i}`}
          initial={{ scale: 0, opacity: 1 }}
          animate={{
            scale: [0, 2, 1.5, 0],
            opacity: [1, 1, 0.8, 0],
          }}
          transition={{
            duration: 0.8,
            delay: i * 0.25,
          }}
          className="absolute pointer-events-none"
          style={{ left: pos.x - 15, top: pos.y - 15 }}
        >
          <div 
            className="w-8 h-8 rounded-full"
            style={{
              background: "radial-gradient(circle, #FFFFFF 0%, rgba(255,255,255,0.5) 50%, transparent 70%)",
              boxShadow: "0 0 30px #FFFFFF, 0 0 60px rgba(255,255,255,0.5)",
            }}
          />
        </motion.div>
      ))}

      {/* Parıltı yağmuru */}
      {positions.map((pos, posIndex) => (
        Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={`glitter-${posIndex}-${i}`}
            initial={{ 
              opacity: 0,
              scale: 0,
              x: pos.x + (Math.random() - 0.5) * 60,
              y: pos.y - 30,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
              y: pos.y + 60,
            }}
            transition={{
              duration: 1,
              delay: posIndex * 0.25 + 0.2 + i * 0.06,
            }}
            className="absolute pointer-events-none"
          >
            <div
              className="rounded-full"
              style={{
                width: 6 + Math.random() * 4,
                height: 6 + Math.random() * 4,
                background: colors[(posIndex + i) % colors.length],
                boxShadow: `0 0 10px ${colors[(posIndex + i) % colors.length]}`,
              }}
            />
          </motion.div>
        ))
      ))}

      {/* Dönen halkalar */}
      {positions.map((pos, i) => (
        <motion.div
          key={`spin-ring-${i}`}
          initial={{ scale: 0, opacity: 0.8, rotate: 0 }}
          animate={{ scale: 3, opacity: 0, rotate: 180 }}
          transition={{ duration: 0.8, delay: i * 0.25 }}
          className="absolute pointer-events-none rounded-full"
          style={{ 
            left: pos.x - 30, 
            top: pos.y - 30,
            width: 60,
            height: 60,
            border: `3px solid ${colors[i % colors.length]}`,
            boxShadow: `0 0 15px ${colors[i % colors.length]}`,
          }}
        />
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
      ? positions.length * 500 + 2000 
      : type === "senyaz" 
        ? positions.length * 400 + 2000 
        : 2500;

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
