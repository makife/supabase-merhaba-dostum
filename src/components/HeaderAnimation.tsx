import React, { useRef, useEffect } from "react";

interface Letter {
  x: number;
  y: number;
  dx: number;
  dy: number;
  char: string;
  color: string;
  font: string;
  rotation: number;
  rotationSpeed: number;
  age: number;
  maxAge: number;
}

const HeaderAnimationCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = 120; // header yüksekliği

    const letters = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ".split("");
    const colors = [
      "rgba(147, 51, 234, 0.6)", // mor
      "rgba(59, 130, 246, 0.6)", // mavi
      "rgba(34, 197, 94, 0.6)",  // yeşil
      "rgba(234, 179, 8, 0.6)",  // sarı
      "rgba(168, 85, 247, 0.6)", // lila
      "rgba(239, 68, 68, 0.6)"   // kırmızı
    ];
    const fonts = ["Fredoka", "Comfortaa", "Righteous", "Bungee", "Orbitron"];

    const floating: Letter[] = [];

    // Yeni harf oluştur
    const createLetter = () => {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        dx: (Math.random() - 0.5) * 1.5,
        dy: (Math.random() - 0.5) * 1.5,
        char: letters[Math.floor(Math.random() * letters.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        font: fonts[Math.floor(Math.random() * fonts.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 4,
        age: 0,
        maxAge: 120 + Math.random() * 60
      };
    };

    // Başlangıç harfleri
    for (let i = 0; i < 30; i++) {
      floating.push(createLetter());
    }

    let frameId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      floating.forEach((f, i) => {
        f.x += f.dx;
        f.y += f.dy;
        f.rotation += f.rotationSpeed;
        f.age++;

        // opacity ayarı
        let opacity = 0.8;
        const fadeIn = f.maxAge * 0.2;
        const fadeOutStart = f.maxAge * 0.7;
        if (f.age < fadeIn) {
          opacity = (f.age / fadeIn) * 0.8;
        } else if (f.age > fadeOutStart) {
          opacity = ((f.maxAge - f.age) / (f.maxAge - fadeOutStart)) * 0.8;
        }

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate((f.rotation * Math.PI) / 180);
        ctx.font = `bold 24px ${f.font}, sans-serif`;
        ctx.fillStyle = f.color.replace("0.6", opacity.toString());
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 8;
        ctx.fillText(f.char, 0, 0);
        ctx.restore();

        if (
          f.x < -50 ||
          f.x > canvas.width + 50 ||
          f.y < -50 ||
          f.y > canvas.height + 50 ||
          f.age > f.maxAge
        ) {
          floating[i] = createLetter();
        }
      });

      frameId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default HeaderAnimationCanvas;
