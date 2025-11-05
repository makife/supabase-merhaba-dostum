// components/FinalStep.tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface FinalStepProps {
  title: string;
  description: string;
  skipText: string;
  actionText: string;
  onSkip: () => void;
  onAction: () => void;
}

export const FinalStep = ({
  title,
  description,
  skipText,
  actionText,
  onSkip,
  onAction
}: FinalStepProps) => {
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[998]" />
      
      {/* Final Step Card */}
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/95 backdrop-blur-md border-2 border-yellow-400 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl text-gray-900">{title}</CardTitle>
          </CardHeader>
          <CardContent className="text-center pb-6">
            <p className="text-gray-700 text-lg leading-relaxed">
              {description}
            </p>
            <div className="mt-4 flex justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center animate-bounce">
                <span className="text-2xl">🎮</span>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={onSkip}
              className="flex-1 border-2 border-gray-300 hover:border-gray-400"
            >
              {skipText}
            </Button>
            <Button
              onClick={onAction}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3"
            >
              {actionText}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
};
