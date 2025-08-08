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
  age: number;
  maxAge: number;
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
        dx: (Math.random() - 0.5) * 1.2,
        dy: (Math.random() - 0.5) * 1.2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 6,
        age: 0,
        maxAge: 120 + Math.random() * 60
      };
      
      setAnimatedLetters(prev => [...prev.slice(-25), newLetter]);
    }, 400);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const moveInterval = setInterval(() => {
      setAnimatedLetters(prev => 
        prev.map(letter => ({
          ...letter,
          x: letter.x + letter.dx,
          y: letter.y + letter.dy,
          rotation: letter.rotation + letter.rotationSpeed,
          age: letter.age + 1
        })).filter(letter => 
          letter.x >= -10 && letter.x <= 110 && 
          letter.y >= -10 && letter.y <= 110 && 
          letter.age < letter.maxAge
        )
      );
    }, 30);

    return () => clearInterval(moveInterval);
  }, []);

  const getOpacity = (age: number, maxAge: number) => {
    const fadeInDuration = maxAge * 0.2;
    const fadeOutStart = maxAge * 0.7;
    
    if (age < fadeInDuration) {
      return (age / fadeInDuration) * 0.8;
    } else if (age > fadeOutStart) {
      return ((maxAge - age) / (maxAge - fadeOutStart)) * 0.8;
    }
    return 0.8;
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {animatedLetters.map((letter) => (
        <div
          key={letter.id}
          className={`absolute text-2xl md:text-3xl font-bold ${letter.color} ${letter.font} transition-opacity duration-300`}
          style={{
            left: `${letter.x}%`,
            top: `${letter.y}%`,
            transform: `rotate(${letter.rotation}deg)`,
            textShadow: '0 0 8px currentColor',
            opacity: getOpacity(letter.age, letter.maxAge),
            zIndex: 1
          }}
        >
          {letter.letter}
        </div>
      ))}
    </div>
  );
};