import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Home, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TournamentChampionCardProps {
  tournamentName: string;
}

const TournamentChampionCard = ({ tournamentName }: TournamentChampionCardProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <Trophy className="w-20 h-20 text-yellow-500" />
              <div className="absolute inset-0 animate-pulse">
                <Trophy className="w-20 h-20 text-yellow-300" />
              </div>
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">
            🏆 Tebrikler!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-3">
            <p className="text-xl font-bold text-primary">
              Turnuva Şampiyonu Oldunuz!
            </p>
            <p className="text-muted-foreground">
              {tournamentName} turnuvasını kazandınız!
            </p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => navigate('/tournament')}
              className="w-full font-semibold py-3"
              size="lg"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Turnuva Sayfasına Dön
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

export default TournamentChampionCard;