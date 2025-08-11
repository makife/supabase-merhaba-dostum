// src/pages/TestMatchmakingPage.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useNewMatchmaking } from '@/contexts/NewMatchmakingContext';
import { useWordValidation } from '@/hooks/useWordValidation';
import { ArrowLeft, Clock, Target, Trophy, Users, Bot, Send, Trash2 } from 'lucide-react';

const TestMatchmakingPage = () => {
  const { state, startSearching, cancelSearch, updateScore, submitWord, leaveGame, resetToIdle } = useNewMatchmaking();
  const { validateWord, isValidating } = useWordValidation();
  
  // Local game state for UI
  const [selectedLetters, setSelectedLetters] = useState<{letter: string, row: number, col: number}[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [localPlayerScore, setLocalPlayerScore] = useState(0);

  // ========================
  // UI HANDLERS
  // ========================

  const handleLetterClick = (letter: string, row: number, col: number) => {
    const isSelected = selectedLetters.some(s => s.row === row && s.col === col);
    
    if (isSelected) {
      const newSelected = selectedLetters.filter(s => !(s.row === row && s.col === col));
      setSelectedLetters(newSelected);
      setCurrentWord(newSelected.map(s => s.letter).join(''));
    } else {
      const newSelected = [...selectedLetters, { letter, row, col }];
      setSelectedLetters(newSelected);
      setCurrentWord(newSelected.map(s => s.letter).join(''));
    }
  };

  const clearWord = () => {
    setSelectedLetters([]);
    setCurrentWord('');
  };

  const handleSubmitWord = async () => {
    if (currentWord.length < 3) return;

    // Validate word first
    const result = await validateWord(currentWord);
    
    if (result.isValid) {
      // Submit to matchmaking system
      const success = await submitWord(currentWord);
      
      if (success) {
        // Update local score
        const newScore = localPlayerScore + result.points;
        setLocalPlayerScore(newScore);
        
        // Update in matchmaking system
        await updateScore(newScore);
        
        clearWord();
      }
    }
  };

  const handleStartSearch = (gameType: 'timed' | 'score') => {
    // Reset local game state
    setLocalPlayerScore(0);
    clearWord();
    startSearching(gameType);
  };

  // ========================
  // RENDER FUNCTIONS
  // ========================

  const renderStatus = () => {
    switch (state.status) {
      case 'idle':
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-center">🆕 Yeni Matchmaking Sistemi</h2>
            <p className="text-center text-muted-foreground">Test için hazır</p>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={() => handleStartSearch('timed')}
                className="h-20 flex flex-col space-y-2"
              >
                <Clock className="w-6 h-6" />
                <span>Zamana Karşı</span>
              </Button>
              <Button 
                onClick={() => handleStartSearch('score')}
                className="h-20 flex flex-col space-y-2"
                variant="outline"
              >
                <Target className="w-6 h-6" />
                <span>Puana Karşı</span>
              </Button>
            </div>
          </div>
        );

      case 'searching':
        return (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <div className="w-20 h-20 bg-primary rounded-full mx-auto flex items-center justify-center animate-pulse">
                <Users className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Oyuncu Aranıyor...</h2>
              <p className="text-muted-foreground">Rakip bulunması bekleniyor</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Arama süresi: {state.queueTime}s</span>
                <span>Tahmini: {state.estimatedWait}s</span>
              </div>
              <Progress value={(state.queueTime / 30) * 100} className="h-2" />
            </div>

            <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
              30 saniye sonra AI rakip ile oyun başlayacak
            </div>

            <Button onClick={cancelSearch} variant="outline">
              Aramayı İptal Et
            </Button>
          </div>
        );

      case 'matched':
        return (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center animate-bounce">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-green-600">Eşleşme Bulundu!</h2>
            <p>Oyun yükleniyor...</p>
          </div>
        );

      case 'in_game':
        return renderGame();

      case 'error':
        return (
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-red-600">Hata</h2>
            <p className="text-red-600">{state.error}</p>
            <Button onClick={resetToIdle}>Ana Menüye Dön</Button>
          </div>
        );

      default:
        return <div>Bilinmeyen durum</div>;
    }
  };

  const renderGame = () => {
    const isAI = state.currentRoom?.player2_id === 'ai-player';
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={leaveGame}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Çıkış
          </Button>
          <div className="flex items-center gap-2">
            {isAI ? <Bot className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            <span className="text-sm font-medium">
              {isAI ? 'AI Rakip' : 'Gerçek Oyuncu'}
            </span>
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Siz</p>
              <p className="text-2xl font-bold">{localPlayerScore}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Rakip</p>
              <p className="text-2xl font-bold">{state.opponentScore}</p>
            </CardContent>
          </Card>
        </div>

        {/* Current Word Input */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Input 
                value={currentWord} 
                readOnly 
                placeholder="Kelime oluştur..."
                className="text-xl font-mono text-center"
              />
              <Badge variant="secondary">
                {currentWord.length}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Game Grid */}
        {state.gameGrid.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-4 gap-3">
                {state.gameGrid.map((row, rowIndex) =>
                  row.map((letter, colIndex) => {
                    const isSelected = selectedLetters.some(s => s.row === rowIndex && s.col === colIndex);
                    const selectionOrder = selectedLetters.findIndex(s => s.row === rowIndex && s.col === colIndex);
                    return (
                      <Button
                        key={`${rowIndex}-${colIndex}`}
                        className={`h-16 text-xl font-bold relative ${
                          isSelected ? 'bg-primary text-primary-foreground' : ''
                        }`}
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() => handleLetterClick(letter, rowIndex, colIndex)}
                      >
                        {letter}
                        {isSelected && selectionOrder >= 0 && (
                          <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {selectionOrder + 1}
                          </span>
                        )}
                      </Button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            onClick={clearWord}
            disabled={selectedLetters.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Sil
          </Button>
          <Button 
            onClick={handleSubmitWord}
            disabled={currentWord.length < 3 || isValidating}
          >
            <Send className="w-4 h-4 mr-2" />
            {isValidating ? 'Kontrol...' : 'Gönder'}
          </Button>
        </div>

        {/* Used Words */}
        {state.usedWords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Kullanılan Kelimeler ({state.usedWords.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {state.usedWords.slice(-10).map((word, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {word}
                  </Badge>
                ))}
                {state.usedWords.length > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{state.usedWords.length - 10} daha
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Info */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <div>Status: {state.status}</div>
            <div>Room ID: {state.currentRoom?.id?.slice(-8) || 'N/A'}</div>
            <div>Game Type: {state.currentRoom?.game_type || 'N/A'}</div>
            <div>Is AI: {isAI ? 'Yes' : 'No'}</div>
            <div>Grid Size: {state.gameGrid.length}x{state.gameGrid[0]?.length || 0}</div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ========================
  // MAIN RENDER
  // ========================

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="p-6">
            {renderStatus()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestMatchmakingPage;
