import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Home, RotateCcw, Frown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TournamentResultCardProps {
  won: boolean;
  round: number;
  tournamentName: string;
  onContinue: () => void;
}

const TournamentResultCard = ({ won, round, tournamentName, onContinue }: TournamentResultCardProps) => {
  const navigate = useNavigate();
  
  const getTitle = () => {
    if (round === 3) {
      return won ? '🏆 TURNUVA ŞAMPİYONU' : 'Final Maçı';
    }
    
    return won ? 'Tebrikler!' : 'Maalesef';
  };
  
  const getDescription = () => {
    if (round === 1) {
      return won 
        ? 'Çeyrek finali geçtiniz! Yarı finale yükseldiniz.' 
        : 'Çeyrek finalde elendiniz. Turnuva sayfasına yönlendiriliyorsunuz.';
    } else if (round === 2) {
      return won 
        ? 'Yarı finali geçtiniz! Finale yükseldiniz.' 
        : 'Yarı finalde elendiniz. Turnuva sayfasına yönlendiriliyorsunuz.';
    } else {
      return won 
        ? 'Tebrikler! Turnuva şampiyonu oldunuz.' 
        : 'Final maçını kaybettiniz. Turnuva sayfasına yönlendiriliyorsunuz.';
    }
  };
  
  const getButtonText = () => {
    if (won && round < 3) {
      return 'Sonraki Tura Geç';
    } else {
      return 'Turnuva Sayfasına Dön';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              {won ? (
                <Trophy className="w-20 h-20 text-yellow-500" />
              ) : (
                <Frown className="w-20 h-20 text-blue-500" />
              )}
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">
            {getTitle()}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-3">
            <p className="text-xl font-bold text-primary">
              {getDescription()}
            </p>
            <p className="text-muted-foreground">
              {tournamentName}
            </p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={onContinue}
              className="w-full font-semibold py-3"
              size="lg"
            >
              {won && round < 3 ? (
                <Trophy className="w-5 h-5 mr-2" />
              ) : (
                <RotateCcw className="w-5 h-5 mr-2" />
              )}
              {getButtonText()}
            </Button>
            
            <Button 
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full font-semibold py-3"
              size="lg"
            >
              <Home className="w-5 h-5 mr-2" />
              Ana Sayfaya Dön
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentResultCard;