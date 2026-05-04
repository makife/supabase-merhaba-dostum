// OPTIMIZED: Separated GameGrid component from GamePage
import React, { memo, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface GameGridProps {
  gameGrid: string[][];
  selectedLetters: {letter: string, row: number, col: number}[];
  highlightedLetters: {row: number, col: number}[];
  isJokerActive: boolean;
  onLetterClick: (row: number, col: number, letter: string) => void;
  currentWord: string;
  className?: string;
  disabled?: boolean;
}

const GameGrid = memo<GameGridProps>(({ 
  gameGrid, 
  selectedLetters, 
  highlightedLetters,
  isJokerActive,
  onLetterClick, 
  currentWord,
  className,
  disabled = false
}) => {
  
  // Memoized helper functions
  const isLetterSelected = useCallback((row: number, col: number) => {
    return selectedLetters.some(letter => letter.row === row && letter.col === col);
  }, [selectedLetters]);

  const isLetterHighlighted = useCallback((row: number, col: number) => {
    return highlightedLetters.some(letter => letter.row === row && letter.col === col);
  }, [highlightedLetters]);

  const getLetterButtonClass = useCallback((row: number, col: number, letter: string) => {
    const selected = isLetterSelected(row, col);
    const highlighted = isLetterHighlighted(row, col);
    
    return cn(
      // NATIVE MOBILE: Daha büyük dokunma alanları ve touch-friendly tasarım
      "w-16 h-16 md:w-20 md:h-20 text-xl md:text-2xl font-bold rounded-xl transition-colors duration-100 border-2",
      // Native mobile touch optimizations - layout shift YOK (yanlış harf basmayı önler)
      "touch-manipulation select-none",
      // Mobile-first shadow and effects
      "shadow-md focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
      disabled && "opacity-50 cursor-not-allowed pointer-events-none",
      selected
        ? "bg-primary text-primary-foreground border-primary"
        : highlighted && isJokerActive
        ? "bg-yellow-200 border-yellow-400 text-yellow-800 animate-pulse shadow-yellow-400/50"
        : "bg-card border-border active:bg-accent"
    );
  }, [isLetterSelected, isLetterHighlighted, isJokerActive, disabled]);

  // Aynı dokunuştan tetiklenen pointerup + click çift seçimini engellemek için kısa kilit
  const lastFireRef = React.useRef<number>(0);

  const handlePress = useCallback((row: number, col: number, letter: string) => {
    if (disabled || !letter) return;
    const now = performance.now();
    if (now - lastFireRef.current < 250) return; // 250ms kilit
    lastFireRef.current = now;
    if (letter && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
    onLetterClick(row, col, letter);
  }, [disabled, onLetterClick]);

  // Native mobile optimized grid rendering
  const renderedGrid = useMemo(() => {
    return gameGrid.map((row, rowIndex) => (
      <div key={rowIndex} className="flex gap-3 md:gap-4 justify-center">
        {row.map((letter, colIndex) => {
          const buttonClass = getLetterButtonClass(rowIndex, colIndex, letter);
          
          return (
            <Button
              key={`${rowIndex}-${colIndex}`}
              variant="outline"
              onPointerUp={(e) => {
                // Asıl tetikleyici: 300ms tap delay yok, hem mouse hem touch
                e.stopPropagation();
                handlePress(rowIndex, colIndex, letter);
              }}
              onClick={(e) => {
                // Yedek: pointer events desteklenmeyen durumlar için
                e.stopPropagation();
                handlePress(rowIndex, colIndex, letter);
              }}
              onTouchMove={(e) => {
                // Swipe gesture'ı engelle (status bar açılmasını önler)
                e.stopPropagation();
              }}
              className={buttonClass}
              disabled={!letter || disabled} // Empty letters or grid disabled
              style={{
                // Native optimization: Prevent text selection and zoom
                WebkitUserSelect: 'none',
                userSelect: 'none',
                WebkitTouchCallout: 'none',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'manipulation',
              }}
            >
              {letter}
            </Button>
          );
        })}
      </div>
    ));
  }, [gameGrid, getLetterButtonClass, handlePress, disabled]);

  // Show current word preview
  const wordPreview = useMemo(() => {
    if (!currentWord) return null;
    
    return (
      <div className="text-center mb-4">
        <div className="inline-flex items-center gap-1 px-3 py-1 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">Kelime:</span>
          <span className="font-mono font-bold text-lg tracking-wider">
            {currentWord}
          </span>
        </div>
      </div>
    );
  }, [currentWord]);

  return (
    <div className={cn("flex flex-col items-center space-y-6 p-4", className)}>
      {wordPreview}
      <div className="flex flex-col gap-3 md:gap-4 mobile-safe">
        {renderedGrid}
      </div>
    </div>
  );
});

GameGrid.displayName = "GameGrid";

export default GameGrid;