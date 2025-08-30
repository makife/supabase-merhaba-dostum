// TournamentCountdown.tsx (güncellenmiş)
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

interface TournamentCountdownProps {
  duration: number;
  title: string;
  description: string;
  onComplete: () => void;
  showProgress?: boolean;
}

const TournamentCountdown = ({ 
  duration, 
  title, 
  description, 
  onComplete,
  showProgress = true 
}: TournamentCountdownProps) => {
  const [countdown, setCountdown] = useState(duration);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onComplete();
    }
  }, [countdown, onComplete]);

  // Calculate progress percentage
  const progress = ((duration - countdown) / duration) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary">
        <CardHeader>
          <CardTitle className="flex items-center justify-center text-center">
            <Clock className="w-5 h-5 mr-2" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="text-6xl font-bold text-primary">{countdown}</div>
            <div className="text-lg">{description}</div>
            
            {showProgress && (
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all duration-1000" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            )}
            
            <div className="text-sm text-muted-foreground">
              Hazır olun!
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentCountdown;