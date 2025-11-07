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

    switch (position) {
      case "top":
        return {
          top: highlightPosition.top - 200 - padding,
          left: highlightPosition.left + highlightPosition.width / 2,
          transform: "translateX(-50%)",
        };
      case "bottom":
        return {
          top: highlightPosition.bottom + padding,
          left: highlightPosition.left + highlightPosition.width / 2,
          transform: "translateX(-50%)",
        };
      case "left":
        return {
          top: highlightPosition.top + highlightPosition.height / 2,
          left: highlightPosition.left - 350 - padding,
          transform: "translateY(-50%)",
        };
      case "right":
        return {
          top: highlightPosition.top + highlightPosition.height / 2,
          left: highlightPosition.right + padding,
          transform: "translateY(-50%)",
        };
      default:
        return {};
    }
  };

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/60 z-[9998] animate-fade-in" onClick={skipOnboarding} />

      {/* Highlight overlay - clickable background'u keser */}
      {highlightPosition && (
        <div
          className="fixed z-[9999] pointer-events-none animate-pulse"
          style={{
            top: highlightPosition.top - 8,
            left: highlightPosition.left - 8,
            width: highlightPosition.width + 16,
            height: highlightPosition.height + 16,
            border: "3px solid hsl(var(--primary))",
            borderRadius: "12px",
            boxShadow: "0 0 0 4px hsl(var(--primary) / 0.3), 0 0 20px hsl(var(--primary) / 0.5)",
          }}
        />
      )}

      {/* Tutorial card */}
      <Card
        className={cn(
          "fixed z-[10000] w-[90vw] max-w-md animate-scale-in shadow-2xl",
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
