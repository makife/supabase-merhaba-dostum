import { useEffect, useState } from "react";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ChevronRight, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const OnboardingTutorial = () => {
  const { showOnboarding, currentStep, steps, nextStep, skipOnboarding, startDemoGame } = useOnboarding();
  const [highlightPosition, setHighlightPosition] = useState<DOMRect | null>(null);

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  useEffect(() => {
    if (!showOnboarding || !currentStepData?.targetSelector) {
      setHighlightPosition(null);
      return;
    }

    // Target elementi bul ve konumunu al
    const targetElement = document.querySelector(currentStepData.targetSelector);
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      setHighlightPosition(rect);

      // Element'e scroll yap
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [showOnboarding, currentStep, currentStepData]);

  if (!showOnboarding) return null;

  const getCardPosition = () => {
    if (!highlightPosition) return {};

    const position = currentStepData.position || "bottom";
    const padding = 16;
    const cardWidth = 360; // max-w-md yaklaşık genişliği
    const cardHeight = 200; // tahmini card yüksekliği
    
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let style: any = {};

    switch (position) {
      case "top":
        style = {
          top: Math.max(padding, highlightPosition.top - cardHeight - padding),
          left: highlightPosition.left + highlightPosition.width / 2,
          transform: "translateX(-50%)",
        };
        // Viewport dışına taşma kontrolü
        if (style.top < padding) style.top = highlightPosition.bottom + padding;
        break;
      case "bottom":
        style = {
          top: highlightPosition.bottom + padding,
          left: highlightPosition.left + highlightPosition.width / 2,
          transform: "translateX(-50%)",
        };
        // Viewport dışına taşma kontrolü
        if (style.top + cardHeight > viewportHeight - padding) {
          style.top = Math.max(padding, highlightPosition.top - cardHeight - padding);
        }
        break;
      case "left":
        style = {
          top: highlightPosition.top + highlightPosition.height / 2,
          left: Math.max(padding, highlightPosition.left - cardWidth - padding),
          transform: "translateY(-50%)",
        };
        // Viewport dışına taşma kontrolü
        if (style.left < padding) style = {
          top: highlightPosition.bottom + padding,
          left: highlightPosition.left + highlightPosition.width / 2,
          transform: "translateX(-50%)",
        };
        break;
      case "right":
        style = {
          top: highlightPosition.top + highlightPosition.height / 2,
          left: highlightPosition.right + padding,
          transform: "translateY(-50%)",
        };
        // Viewport dışına taşma kontrolü
        if (style.left + cardWidth > viewportWidth - padding) {
          style = {
            top: highlightPosition.bottom + padding,
            left: highlightPosition.left + highlightPosition.width / 2,
            transform: "translateX(-50%)",
          };
        }
        break;
      default:
        return {};
    }

    // Sol-sağ taşma kontrolü
    const effectiveLeft = style.transform?.includes("translateX(-50%)") 
      ? style.left - cardWidth / 2 
      : style.left;
    
    if (effectiveLeft < padding) {
      style.left = cardWidth / 2 + padding;
    } else if (effectiveLeft + cardWidth > viewportWidth - padding) {
      style.left = viewportWidth - cardWidth / 2 - padding;
    }

    return style;
  };

  return (
    <>
      {/* Dark overlay - body overflow'u da kontrol et */}
      <div 
        className="fixed inset-0 bg-black/60 z-[9998]" 
        onClick={skipOnboarding}
        style={{ position: 'fixed' }}
      />

      {/* Highlight overlay - tüm elementler için ışık parlaması efekti */}
      {highlightPosition && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: highlightPosition.top + highlightPosition.height / 2,
            left: highlightPosition.left + highlightPosition.width / 2,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* Ana parlama */}
          <div 
            className="absolute inset-0"
            style={{
              width: highlightPosition.width + 80,
              height: highlightPosition.height + 80,
              background: "radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, hsl(var(--primary) / 0.2) 30%, transparent 70%)",
              filter: "blur(20px)",
              transform: "translate(-50%, -50%)",
              left: "50%",
              top: "50%",
            }}
          />
          {/* İkincil parlama */}
          <div 
            className="absolute inset-0"
            style={{
              width: highlightPosition.width + 120,
              height: highlightPosition.height + 120,
              background: "radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, hsl(var(--primary) / 0.1) 20%, transparent 50%)",
              filter: "blur(30px)",
              transform: "translate(-50%, -50%)",
              left: "50%",
              top: "50%",
            }}
          />
          {/* Dış hale */}
          <div 
            className="absolute inset-0"
            style={{
              width: highlightPosition.width + 160,
              height: highlightPosition.height + 160,
              background: "radial-gradient(circle, hsl(var(--primary) / 0.15) 0%, transparent 40%)",
              filter: "blur(40px)",
              transform: "translate(-50%, -50%)",
              left: "50%",
              top: "50%",
            }}
          />
        </div>
      )}

      {/* Tutorial card */}
      <Card
        className={cn(
          "fixed z-[10000] w-[90vw] max-w-md shadow-2xl",
          highlightPosition ? "absolute" : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        )}
        style={highlightPosition ? getCardPosition() : {}}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl mb-2">{currentStepData.title}</CardTitle>
              <CardDescription className="text-base">{currentStepData.description}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={skipOnboarding} className="shrink-0 ml-2">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between gap-3">
            {/* Progress indicators */}
            <div className="flex gap-1.5">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    index === currentStep ? "w-8 bg-primary" : "w-2 bg-muted",
                  )}
                />
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {!isLastStep && (
                <Button variant="outline" size="sm" onClick={skipOnboarding}>
                  Atla
                </Button>
              )}
              
              {isLastStep ? (
                <Button size="sm" onClick={startDemoGame} className="gap-2">
                  <PlayCircle className="h-4 w-4" />
                  Başla
                </Button>
              ) : (
                <Button size="sm" onClick={nextStep} className="gap-2">
                  İleri
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
