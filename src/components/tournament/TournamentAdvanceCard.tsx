import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Sparkles } from 'lucide-react';

interface TournamentAdvanceCardProps {
  nextRound: string;
  onContinue: () => void;
}

const TournamentAdvanceCard = ({ nextRound, onContinue }: TournamentAdvanceCardProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <Trophy className="w-16 h-16 text-primary" />
              <Sparkles className="w-6 h-6 text-yellow-500 absolute -top-2 -right-2 animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            🎉 Tebrikler!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-2">
            <p className="text-lg font-semibold">
              {nextRound} çıkmaya hak kazandınız!
            </p>
            <p className="text-muted-foreground">
              Turnuva sayfasına yönlendiriliyorsunuz...
            </p>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-lg"></div>
            <Button 
              onClick={onContinue}
              className="relative w-full font-semibold py-3"
              size="lg"
            >
              <Trophy className="w-5 h-5 mr-2" />
              Devam Et
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentAdvanceCard;
