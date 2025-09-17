import React, { useState, useEffect, useCallback } from 'react';
import { Timer, RotateCcw, Trophy, Settings } from 'lucide-react';

interface GameState {
  board: number[];
  emptyIndex: number;
  moves: number;
  timeLeft: number;
  isRunning: boolean;
  isCompleted: boolean;
  difficulty: 3 | 4;
}

const PuzzleGame: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    board: [],
    emptyIndex: 8,
    moves: 0,
    timeLeft: 60,
    isRunning: false,
    isCompleted: false,
    difficulty: 3
  });
  
  const [bestTimes, setBestTimes] = useState<{3: number | null, 4: number | null}>({
    3: null,
    4: null
  });

  const initializeBoard = useCallback((difficulty: 3 | 4) => {
    const size = difficulty * difficulty;
    const board = Array.from({ length: size - 1 }, (_, i) => i + 1);
    board.push(0); // Empty space
    
    // Shuffle the board
    for (let i = board.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [board[i], board[j]] = [board[j], board[i]];
    }
    
    const emptyIndex = board.indexOf(0);
    const timeLimit = difficulty === 3 ? 60 : 120;
    
    setGameState({
      board,
      emptyIndex,
      moves: 0,
      timeLeft: timeLimit,
      isRunning: false,
      isCompleted: false,
      difficulty
    });
  }, []);

  const isValidMove = (index: number, emptyIndex: number, difficulty: number) => {
    const row = Math.floor(index / difficulty);
    const col = index % difficulty;
    const emptyRow = Math.floor(emptyIndex / difficulty);
    const emptyCol = emptyIndex % difficulty;
    
    return (
      (Math.abs(row - emptyRow) === 1 && col === emptyCol) ||
      (Math.abs(col - emptyCol) === 1 && row === emptyRow)
    );
  };

  const makeMove = (index: number) => {
    if (gameState.isCompleted || !isValidMove(index, gameState.emptyIndex, gameState.difficulty)) {
      return;
    }

    const newBoard = [...gameState.board];
    [newBoard[index], newBoard[gameState.emptyIndex]] = [newBoard[gameState.emptyIndex], newBoard[index]];
    
    const newEmptyIndex = index;
    const newMoves = gameState.moves + 1;
    
    if (!gameState.isRunning) {
      setGameState(prev => ({ ...prev, isRunning: true }));
    }
    
    // Check if puzzle is solved
    const isSolved = newBoard.every((value, i) => {
      if (i === newBoard.length - 1) return value === 0;
      return value === i + 1;
    });
    
    if (isSolved) {
      const finalTime = gameState.difficulty === 3 ? 60 - gameState.timeLeft : 120 - gameState.timeLeft;
      const currentBest = bestTimes[gameState.difficulty];
      
      if (!currentBest || finalTime < currentBest) {
        setBestTimes(prev => ({ ...prev, [gameState.difficulty]: finalTime }));
        localStorage.setItem(`bestTime${gameState.difficulty}`, finalTime.toString());
      }
      
      setGameState(prev => ({
        ...prev,
        board: newBoard,
        emptyIndex: newEmptyIndex,
        moves: newMoves,
        isCompleted: true,
        isRunning: false
      }));
    } else {
      setGameState(prev => ({
        ...prev,
        board: newBoard,
        emptyIndex: newEmptyIndex,
        moves: newMoves
      }));
    }
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState.isRunning && gameState.timeLeft > 0) {
      interval = setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 1) {
            return { ...prev, timeLeft: 0, isRunning: false };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState.isRunning, gameState.timeLeft]);

  // Load best times from localStorage
  useEffect(() => {
    const best3 = localStorage.getItem('bestTime3');
    const best4 = localStorage.getItem('bestTime4');
    setBestTimes({
      3: best3 ? parseInt(best3) : null,
      4: best4 ? parseInt(best4) : null
    });
  }, []);

  // Initialize board on mount
  useEffect(() => {
    initializeBoard(gameState.difficulty);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeProgress = () => {
    const totalTime = gameState.difficulty === 3 ? 60 : 120;
    return (gameState.timeLeft / totalTime) * 100;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            Sliding Puzzle
          </h1>
          <div className="flex justify-center items-center gap-4 text-white/80">
            <div className="flex items-center gap-1">
              <Timer size={16} />
              <span className="text-sm">Moves: {gameState.moves}</span>
            </div>
            {bestTimes[gameState.difficulty] && (
              <div className="flex items-center gap-1">
                <Trophy size={16} className="text-yellow-400" />
                <span className="text-sm">{bestTimes[gameState.difficulty]}s</span>
              </div>
            )}
          </div>
        </div>

        {/* Timer Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/80 text-sm">Time</span>
            <span className={`text-sm font-mono ${gameState.timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
              {formatTime(gameState.timeLeft)}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ${
                gameState.timeLeft <= 10 ? 'bg-red-500' : 'bg-gradient-to-r from-green-400 to-blue-500'
              }`}
              style={{ width: `${getTimeProgress()}%` }}
            />
          </div>
        </div>

        {/* Game Board */}
        <div className="mb-6">
          <div
            className={`grid gap-2 p-4 bg-black/20 rounded-2xl backdrop-blur-sm`}
            style={{
              gridTemplateColumns: `repeat(${gameState.difficulty}, 1fr)`,
            }}
          >
            {gameState.board.map((number, index) => (
              <button
                key={index}
                onClick={() => makeMove(index)}
                disabled={gameState.isCompleted || gameState.timeLeft === 0}
                className={`
                  aspect-square rounded-lg font-bold text-xl transition-all duration-200 transform
                  ${number === 0
                    ? 'bg-transparent'
                    : `bg-gradient-to-br from-cyan-400 to-purple-500 text-white shadow-lg
                       hover:scale-105 active:scale-95 border-2 border-white/20
                       ${isValidMove(index, gameState.emptyIndex, gameState.difficulty) 
                         ? 'hover:shadow-cyan-400/50 cursor-pointer' 
                         : 'cursor-not-allowed opacity-70'}`
                  }
                `}
              >
                {number !== 0 && number}
              </button>
            ))}
          </div>
        </div>

        {/* Game Status */}
        {gameState.isCompleted && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-400/30 rounded-xl text-center">
            <div className="text-green-400 font-bold text-lg mb-1">🎉 Tebrikler!</div>
            <div className="text-white/80 text-sm">
              {gameState.moves} hamle ile {gameState.difficulty === 3 ? 60 - gameState.timeLeft : 120 - gameState.timeLeft} saniyede tamamladın!
            </div>
          </div>
        )}

        {gameState.timeLeft === 0 && !gameState.isCompleted && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-xl text-center">
            <div className="text-red-400 font-bold text-lg mb-1">⏰ Süre Bitti!</div>
            <div className="text-white/80 text-sm">Yeniden deneyin!</div>
          </div>
        )}

        {/* Controls */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={() => initializeBoard(3)}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                gameState.difficulty === 3
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              Kolay (3x3)
            </button>
            <button
              onClick={() => initializeBoard(4)}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                gameState.difficulty === 4
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              Zor (4x4)
            </button>
          </div>
          
          <button
            onClick={() => initializeBoard(gameState.difficulty)}
            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw size={20} />
            Yeniden Başla
          </button>
        </div>
      </div>
    </div>
  );
};

export default PuzzleGame;
