// components/TourStep.tsx
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface TourStepProps {
  target: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const TourStep = ({
  target,
  title,
  description,
  position = 'top',
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  isFirst,
  isLast
}: TourStepProps) => {
  const targetRef = useRef<Element | null>(null);

  useEffect(() => {
    // Target elementini bul
    targetRef.current = document.querySelector(target);
    
    if (targetRef.current) {
      // Elementi highlight et
      targetRef.current.classList.add('onboarding-highlight');
      
      // Scroll into view
      targetRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
    }

    return () => {
      // Cleanup
      if (targetRef.current) {
        targetRef.current.classList.remove('onboarding-highlight');
      }
    };
  }, [target]);

  const getPositionStyles = () => {
    if (!targetRef.current) return {};

    const rect = targetRef.current.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    switch (position) {
      case 'top':
        return {
          top: rect.top + scrollTop - 10,
          left: rect.left + scrollLeft + rect.width / 2,
          transform: 'translateX(-50%) translateY(-100%)'
        };
      case 'bottom':
        return {
          top: rect.bottom + scrollTop + 10,
          left: rect.left + scrollLeft + rect.width / 2,
          transform: 'translateX(-50%)'
        };
      case 'left':
        return {
          top: rect.top + scrollTop + rect.height / 2,
          left: rect.left + scrollLeft - 10,
          transform: 'translateX(-100%) translateY(-50%)'
        };
      case 'right':
        return {
          top: rect.top + scrollTop + rect.height / 2,
          left: rect.right + scrollLeft + 10,
          transform: 'translateY(-50%)'
        };
      default:
        return {};
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[998]" />
      
      {/* Highlight element */}
      {targetRef.current && (
        <div
          className="fixed z-[997] border-2 border-yellow-400 rounded-lg shadow-2xl shadow-yellow-400/50 animate-pulse"
          style={{
            top: targetRef.current.getBoundingClientRect().top + window.pageYOffset,
            left: targetRef.current.getBoundingClientRect().left + window.pageXOffset,
            width: targetRef.current.getBoundingClientRect().width,
            height: targetRef.current.getBoundingClientRect().height,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[999] min-w-[300px] max-w-[400px]"
        style={getPositionStyles()}
      >
        <Card className="bg-white/95 backdrop-blur-md border-2 border-yellow-400 shadow-2xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-lg text-gray-900">{title}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="h-6 w-6 p-0 hover:bg-gray-200"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-gray-700 text-sm mb-3">{description}</p>
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                {currentStep + 1} / {totalSteps}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between p-4 pt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrev}
              disabled={isFirst}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Geri
            </Button>
            <Button
              onClick={onNext}
              size="sm"
              className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {isLast ? 'Tamamla' : 'İleri'}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </Button>
          </CardFooter>
        </Card>

        {/* Arrow */}
        <div
          className={`absolute w-4 h-4 bg-yellow-400 transform rotate-45 border-2 border-yellow-400 ${
            position === 'top' ? 'bottom-0 translate-y-1/2' :
            position === 'bottom' ? 'top-0 -translate-y-1/2' :
            position === 'left' ? 'right-0 translate-x-1/2' :
            'left-0 -translate-x-1/2'
          }`}
          style={{
            [position === 'top' ? 'bottom' : 
             position === 'bottom' ? 'top' :
             position === 'left' ? 'right' : 'left']: '-8px'
          }}
        />
      </div>
    </>
  );
};
