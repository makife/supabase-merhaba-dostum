import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useServerTime } from "@/hooks/useServerTime";
import { useGameTimer } from "@/hooks/useGameTimer";
import { useRandomMatchSync } from "@/hooks/useRandomMatchSync";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

/**
 * Test sayfası - yeni sync sistemini test et
 */
export default function SyncTestPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { serverNow, offset, isReady } = useServerTime();
  const [currentServerTime, setCurrentServerTime] = useState<string>("");

  // Game timer test
  const timer = useGameTimer({
    onTimeUp: () => console.log("TIME UP!"),
    onWarning: (sec) => console.log("WARNING:", sec),
  });

  // Server time display
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      const st = serverNow();
      setCurrentServerTime(new Date(st).toISOString());
    }, 100);

    return () => clearInterval(interval);
  }, [isReady, serverNow]);

  const startTimer = () => {
    const endsAt = Date.now() + 10000; // 10 saniye sonra
    timer.start(endsAt);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Lütfen giriş yapın</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-background">
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="outline" onClick={() => navigate("/")}>
          ← Ana Sayfa
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>🕐 Server Time Sync Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <strong>Ready:</strong> {isReady ? "✅ Evet" : "⏳ Hayır"}
            </div>
            <div>
              <strong>Offset:</strong> {offset}ms
            </div>
            <div>
              <strong>Server Time:</strong> {currentServerTime}
            </div>
            <div>
              <strong>Local Time:</strong> {new Date().toISOString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>⏱️ Game Timer Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-4xl font-mono font-bold text-center">
              {timer.formattedTime}
            </div>
            <div className="text-center text-sm text-muted-foreground">
              {timer.isRunning ? "Running" : "Stopped"}
              {timer.isWarning && " ⚠️ WARNING"}
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={startTimer} disabled={timer.isRunning}>
                Start (10s)
              </Button>
              <Button onClick={() => timer.stop()} disabled={!timer.isRunning}>
                Stop
              </Button>
              <Button onClick={() => timer.reset(120)}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📋 Senkronizasyon Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>• Server time offset hesaplanır (3 sample, en düşük RTT)</p>
            <p>• Timer, endsAt timestamp'ine göre çalışır</p>
            <p>• setInterval ile 200ms'de bir güncellenir</p>
            <p>• Tab arka planda olsa bile doğru süre gösterir</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
