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
}

const GameGrid = memo<GameGridProps>(({ 
  gameGrid, 
  selectedLetters, 
  highlightedLetters,
  isJokerActive,
  onLetterClick, 
  currentWord,
  className 
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
      "w-12 h-12 sm:w-16 sm:h-16 text-lg sm:text-xl font-bold rounded-lg transition-all duration-200 border-2",
      "hover:scale-105 active:scale-95",
      selected
        ? "bg-primary text-primary-foreground border-primary shadow-lg scale-105"
        : highlighted && isJokerActive
        ? "bg-yellow-200 border-yellow-400 text-yellow-800 animate-pulse"
        : "bg-background border-border hover:border-primary/50 hover:bg-accent"
    );
  }, [isLetterSelected, isLetterHighlighted, isJokerActive]);

  // Memoized grid rendering
  const renderedGrid = useMemo(() => {
    return gameGrid.map((row, rowIndex) => (
      <div key={rowIndex} className="flex gap-2 justify-center">
        {row.map((letter, colIndex) => {
          const buttonClass = getLetterButtonClass(rowIndex, colIndex, letter);
          
          return (
            <Button
              key={`${rowIndex}-${colIndex}`}
              variant="outline"
              onClick={() => onLetterClick(rowIndex, colIndex, letter)}
              className={buttonClass}
              disabled={!letter} // Empty letters are disabled
            >
              {letter}
            </Button>
          );
        })}
      </div>
    ));
  }, [gameGrid, getLetterButtonClass, onLetterClick]);

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
    <div className={cn("flex flex-col items-center space-y-4", className)}>
      {wordPreview}
      <div className="flex flex-col gap-2">
        {renderedGrid}
      </div>
    </div>
  );
});

GameGrid.displayName = "GameGrid";

export default GameGrid;