import React, { useState, useEffect, useCallback, useRef } from "react";
import { Timer, RotateCcw, Trophy, ArrowLeft, Type } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GameState {
  board: number[];
  emptyIndex: number;
  moves: number;
  timeLeft: number;
  isRunning: boolean;
  isCompleted: boolean;
  difficulty: 3 | 4;
  targetWord: string; // Hedef kelimeyi tutmak için
}

const PuzzleGamePage: React.FC = () => {
  const navigate = useNavigate();

  // Kelime listelerini hafızada tutmak için ref kullanıyoruz
  const wordsRef = useRef<{ 8: string[]; 15: string[] }>({ 8: [], 15: [] });
  const [isWordsLoaded, setIsWordsLoaded] = useState(false);

  const [gameState, setGameState] = useState<GameState>({
    board: [],
    emptyIndex: 8,
    moves: 0,
    timeLeft: 60,
    isRunning: false,
    isCompleted: false,
    difficulty: 3,
    targetWord: "",
  });

  const [bestTimes, setBestTimes] = useState<{ 3: number | null; 4: number | null }>({
    3: null,
    4: null,
  });

  // Kelimeleri wordlist.txt dosyasından çekme
  useEffect(() => {
    const fetchWords = async () => {
      try {
        const response = await fetch("/wordlist.txt");
        const text = await response.text();
        const allWords = text.split("\n").map((w) => w.trim().toLocaleUpperCase("tr-TR"));

        // Kelimeleri uzunluklarına göre ayır
        const words8 = allWords.filter((w) => w.length === 8);
        const words15 = allWords.filter((w) => w.length === 15);

        // Eğer dosya boşsa veya okunamadıysa fallback (yedek) kelimeler
        if (words8.length === 0) words8.push("PORTAKAL", "BİLGİSAY", "ÇEKİRDEK");
        if (words15.length === 0) words15.push("AFYONKARAHİSARL", "KAHRAMANMARAŞLI");

        wordsRef.current = { 8: words8, 15: words15 };
        setIsWordsLoaded(true);
      } catch (error) {
        console.error("Kelime listesi yüklenemedi:", error);
        // Hata durumunda yedek kelimeler
        wordsRef.current = {
          8: ["PORTAKAL", "TEKNOLOJ"],
          15: ["PROGRAMLAMACISI"],
        };
        setIsWordsLoaded(true);
      }
    };

    fetchWords();
  }, []);

  const initializeBoard = useCallback((difficulty: 3 | 4) => {
    if (!wordsRef.current[8].length && !wordsRef.current[15].length) return;

    const size = difficulty * difficulty;

    // Rastgele kelime seçimi
    const wordList = difficulty === 3 ? wordsRef.current[8] : wordsRef.current[15];
    const randomWord = wordList[Math.floor(Math.random() * wordList.length)];

    // Çözülmüş tahtayı oluştur (1'den N'e kadar sıralı, sonuncusu 0/boş)
    let board = Array.from({ length: size - 1 }, (_, i) => i + 1);
    board.push(0); // Son kare boş

    let emptyIndex = size - 1;
    let movesToShuffle = difficulty === 3 ? 100 : 300; // Zorluğa göre karıştırma sayısı

    // Tahtayı geçerli hamleler yaparak karıştır (Böylece oyun her zaman çözülebilir olur)
    let previousIndex = -1;
    for (let i = 0; i < movesToShuffle; i++) {
      const possibleMoves = [];
      const row = Math.floor(emptyIndex / difficulty);
      const col = emptyIndex % difficulty;

      if (row > 0) possibleMoves.push(emptyIndex - difficulty); // Yukarı
      if (row < difficulty - 1) possibleMoves.push(emptyIndex + difficulty); // Aşağı
      if (col > 0) possibleMoves.push(emptyIndex - 1); // Sol
      if (col < difficulty - 1) possibleMoves.push(emptyIndex + 1); // Sağ

      // Bir önceki hamleyi geri almamak için filtrele (titreşimi önler)
      const validMoves = possibleMoves.filter((idx) => idx !== previousIndex);

      if (validMoves.length > 0) {
        const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];

        // Swap işlemi
        [board[emptyIndex], board[randomMove]] = [board[randomMove], board[emptyIndex]];
        previousIndex = emptyIndex;
        emptyIndex = randomMove;
      }
    }

    const timeLimit = difficulty === 3 ? 120 : 180;

    setGameState({
      board,
      emptyIndex,
      moves: 0,
      timeLeft: timeLimit,
      isRunning: false,
      isCompleted: false,
      difficulty,
      targetWord: randomWord,
    });
  }, []);

  // Kelimeler yüklendiğinde oyunu başlat
  useEffect(() => {
    if (isWordsLoaded) {
      initializeBoard(gameState.difficulty);
    }
  }, [isWordsLoaded]);

  const isValidMove = (index: number, emptyIndex: number, difficulty: number) => {
    const row = Math.floor(index / difficulty);
    const col = index % difficulty;
    const emptyRow = Math.floor(emptyIndex / difficulty);
    const emptyCol = emptyIndex % difficulty;

    return (Math.abs(row - emptyRow) === 1 && col === emptyCol) || (Math.abs(col - emptyCol) === 1 && row === emptyRow);
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
      setGameState((prev) => ({ ...prev, isRunning: true }));
    }

    // Check if puzzle is solved
    const isSolved = newBoard.every((value, i) => {
      if (i === newBoard.length - 1) return value === 0;
      return value === i + 1;
    });

    if (isSolved) {
      const finalTime = (gameState.difficulty === 3 ? 120 : 180) - gameState.timeLeft;
      const currentBest = bestTimes[gameState.difficulty];

      if (!currentBest || finalTime < currentBest) {
        setBestTimes((prev) => ({ ...prev, [gameState.difficulty]: finalTime }));
        localStorage.setItem(`bestTime${gameState.difficulty}`, finalTime.toString());
      }

      setGameState((prev) => ({
        ...prev,
        board: newBoard,
        emptyIndex: newEmptyIndex,
        moves: newMoves,
        isCompleted: true,
        isRunning: false,
      }));
    } else {
      setGameState((prev) => ({
        ...prev,
        board: newBoard,
        emptyIndex: newEmptyIndex,
        moves: newMoves,
      }));
    }
  };

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState.isRunning && gameState.timeLeft > 0) {
      interval = setInterval(() => {
        setGameState((prev) => {
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
    const best3 = localStorage.getItem("bestTime3");
    const best4 = localStorage.getItem("bestTime4");
    setBestTimes({
      3: best3 ? parseInt(best3) : null,
      4: best4 ? parseInt(best4) : null,
    });
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimeProgress = () => {
    const totalTime = gameState.difficulty === 3 ? 120 : 180;
    return (gameState.timeLeft / totalTime) * 100;
  };

  // Sayısal değeri (1-15) kelimenin ilgili harfine (0-14 index) çevirir
  const getLetterForTile = (number: number) => {
    if (number === 0) return "";
    // number 1 ise targetWord[0], number 2 ise targetWord[1]...
    return gameState.targetWord[number - 1] || "?";
  };

  if (!isWordsLoaded) {
    return <div className="min-h-screen bg-indigo-900 flex items-center justify-center text-white">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4">
      <div className="max-w-md mx-auto">
        {/* Geri Dön Butonu */}
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Geri Dön
          </button>
        </div>

        {/* Başlık */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            Kelime Puzzle
          </h1>
          <div className="flex justify-center items-center gap-4 text-white/80">
            <div className="flex items-center gap-1">
              <Timer size={16} />
              <span className="text-sm">Hamle: {gameState.moves}</span>
            </div>
            {bestTimes[gameState.difficulty] && (
              <div className="flex items-center gap-1">
                <Trophy size={16} className="text-yellow-400" />
                <span className="text-sm">Rekor: {bestTimes[gameState.difficulty]}s</span>
              </div>
            )}
          </div>
        </div>

        {/* HEDEF KELİME GÖSTERGESİ */}
        <div className="mb-6 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
          <div className="text-center">
            <div className="text-white/60 text-xs uppercase mb-1 flex items-center justify-center gap-1">
              <Type size={12} />
              Hedef Kelime
            </div>
            <div className="text-2xl font-bold text-white tracking-widest font-mono">{gameState.targetWord}</div>
          </div>
        </div>

        {/* Timer Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/80 text-sm">Süre</span>
            <span className={`text-sm font-mono ${gameState.timeLeft <= 10 ? "text-red-400" : "text-white"}`}>
              {formatTime(gameState.timeLeft)}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ${
                gameState.timeLeft <= 10 ? "bg-red-500" : "bg-gradient-to-r from-green-400 to-blue-500"
              }`}
              style={{ width: `${getTimeProgress()}%` }}
            />
          </div>
        </div>

        {/* Game Board */}
        <div className="mb-6">
          <div
            className="grid gap-2 p-4 bg-black/20 rounded-2xl backdrop-blur-sm"
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
                  aspect-square rounded-lg font-bold text-2xl transition-all duration-200 transform
                  flex items-center justify-center relative
                  ${
                    number === 0
                      ? "bg-transparent"
                      : `bg-gradient-to-br from-cyan-400 to-purple-500 text-white shadow-lg
                       hover:scale-105 active:scale-95 border-2 border-white/20
                       ${
                         isValidMove(index, gameState.emptyIndex, gameState.difficulty)
                           ? "hover:shadow-cyan-400/50 cursor-pointer"
                           : "cursor-not-allowed opacity-70"
                       }`
                  }
                `}
              >
                {number !== 0 && (
                  <>
                    {/* Ana Harf */}
                    {getLetterForTile(number)}

                    {/* Yardımcı küçük sayı (opsiyonel - sıralamayı kolaylaştırmak için sağ altta silik numara) */}
                    {/* <span className="absolute bottom-1 right-1 text-[10px] opacity-40 font-normal">
                      {number}
                    </span> */}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Game Status */}
        {gameState.isCompleted && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-400/30 rounded-xl text-center">
            <div className="text-green-400 font-bold text-lg mb-1">🎉 Harika!</div>
            <div className="text-white font-semibold mb-1">"{gameState.targetWord}"</div>
            <div className="text-white/80 text-sm">kelimesini {gameState.moves} hamlede tamamladın!</div>
          </div>
        )}

        {gameState.timeLeft === 0 && !gameState.isCompleted && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-xl text-center">
            <div className="text-red-400 font-bold text-lg mb-1">⏰ Süre Bitti!</div>
            <div className="text-white mb-1">Aranan kelime: {gameState.targetWord}</div>
            <div className="text-white/80 text-sm">Yeniden deneyin!</div>
          </div>
        )}

        {/* Controls */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={() => initializeBoard(3)}
              className={`flex-1 py-3 px-2 rounded-xl font-semibold transition-all text-sm ${
                gameState.difficulty === 3
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              8 Harfli (3x3)
            </button>
            <button
              onClick={() => initializeBoard(4)}
              className={`flex-1 py-3 px-2 rounded-xl font-semibold transition-all text-sm ${
                gameState.difficulty === 4
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              15 Harfli (4x4)
            </button>
          </div>

          <button
            onClick={() => initializeBoard(gameState.difficulty)}
            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw size={20} />
            Yeni Kelime Getir
          </button>
        </div>
      </div>
    </div>
  );
};

export default PuzzleGamePage;
