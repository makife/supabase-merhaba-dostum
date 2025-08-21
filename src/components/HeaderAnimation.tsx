import React, { useRef, useEffect, useState } from "react";

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

export const HeaderAnimation: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lettersRef = useRef<Letter[]>([]);
  const [theme, setTheme] = useState<"dark" | "light">(
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );

  const colorsByTheme = {
    dark: [
      "rgba(147, 51, 234, 0.6)",
      "rgba(59, 130, 246, 0.6)",
      "rgba(34, 197, 94, 0.6)",
      "rgba(234, 179, 8, 0.6)"
    ],
    light: [
      "rgba(168, 85, 247, 0.6)",
      "rgba(16, 185, 129, 0.6)",
      "rgba(239, 68, 68, 0.6)",
      "rgba(249, 115, 22, 0.6)"
    ]
  };

  const fonts = ["Fredoka", "Comfortaa", "Righteous", "Bungee", "Orbitron"];
  const letters = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ".split("");

  const createLetter = (): Letter => {
    const colorList = colorsByTheme[theme];
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * 120,
      dx: (Math.random() - 0.5) * 1.2,
      dy: (Math.random() - 0.5) * 1.2,
      char: letters[Math.floor(Math.random() * letters.length)],
      color: colorList[Math.floor(Math.random() * colorList.length)],
      font: fonts[Math.floor(Math.random() * fonts.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 4,
      age: 0,
      maxAge: 100 + Math.random() * 50
    };
  };

  // Başlangıç harfleri
  useEffect(() => {
    lettersRef.current = Array.from({ length: 15 }, () => createLetter());
  }, []);

  // Animasyon döngüsü
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = 120;

    let frameId: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      lettersRef.current.forEach((f, i) => {
        f.x += f.dx;
        f.y += f.dy;
        f.rotation += f.rotationSpeed;
        f.age++;

        let opacity = 0.8;
        const fadeIn = f.maxAge * 0.2;
        const fadeOutStart = f.maxAge * 0.7;
        if (f.age < fadeIn) opacity = (f.age / fadeIn) * 0.8;
        else if (f.age > fadeOutStart) opacity = ((f.maxAge - f.age) / (f.maxAge - fadeOutStart)) * 0.8;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate((f.rotation * Math.PI) / 180);
        ctx.font = `bold 24px ${f.font}, sans-serif`;
        ctx.fillStyle = f.color.replace("0.6", opacity.toString());
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 8;
        ctx.fillText(f.char, 0, 0);
        ctx.restore();

        if (f.x < -50 || f.x > canvas.width + 50 || f.y < -50 || f.y > canvas.height + 50 || f.age > f.maxAge) {
          lettersRef.current[i] = createLetter();
        }
      });

      frameId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(frameId);
  }, [theme]);

  // Tema değişimini dinle
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? "dark" : "light");

    mediaQuery.addEventListener("change", handler);

    return () => {
      mediaQuery.removeEventListener("change", handler);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};
