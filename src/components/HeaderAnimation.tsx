import { useState, useEffect } from 'react';

interface AnimatedLetter {
  id: number;
  letter: string;
  x: number;
  y: number;
  color: string;
  font: string;
  dx: number;
  dy: number;
  rotation: number;
  rotationSpeed: number;
}

export const HeaderAnimation = () => {
  const [animatedLetters, setAnimatedLetters] = useState<AnimatedLetter[]>([]);

  const letters = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';
  const colors = [
    'text-primary/60',
    'text-secondary/60', 
    'text-accent/60',
    'text-muted-foreground/40',
    'text-purple-500/60',
    'text-blue-500/60',
    'text-green-500/60',
    'text-yellow-500/60'
  ];
  const fonts = ['font-fredoka', 'font-comfortaa', 'font-righteous', 'font-bungee', 'font-orbitron'];

  useEffect(() => {
    const interval = setInterval(() => {
      const newLetter: AnimatedLetter = {
        id: Date.now() + Math.random(),
        letter: letters[Math.floor(Math.random() * letters.length)],
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        font: fonts[Math.floor(Math.random() * fonts.length)],
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 2
      };
      
      setAnimatedLetters(prev => [...prev.slice(-20), newLetter]);
    }, 800);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const moveInterval = setInterval(() => {
      setAnimatedLetters(prev => 
        prev.map(letter => ({
          ...letter,
          x: letter.x + letter.dx,
          y: letter.y + letter.dy,
          rotation: letter.rotation + letter.rotationSpeed
        })).filter(letter => 
          letter.x >= -5 && letter.x <= 105 && 
          letter.y >= -5 && letter.y <= 105
        )
      );
    }, 50);

    return () => clearInterval(moveInterval);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {animatedLetters.map((letter) => (
        <div
          key={letter.id}
          className={`absolute text-2xl md:text-3xl font-bold ${letter.color} ${letter.font} transition-all duration-500`}
          style={{
            left: `${letter.x}%`,
            top: `${letter.y}%`,
            transform: `rotate(${letter.rotation}deg)`,
            textShadow: '0 0 8px currentColor',
            opacity: 0.7,
            zIndex: 1
          }}
        >
          {letter.letter}
        </div>
      ))}
    </div>
  );
};