import React, { useState, useEffect } from "react";
import { ensureImagesLoaded } from "./GameCountdown";
import { preloadHomeIslands } from "@/lib/homeIslandAssets";

const LoadingScreen = ({ onLoadingComplete }) => {
  const [tips, setTips] = useState(["Oyun yükleniyor..."]);
  const [currentTip, setCurrentTip] = useState("");
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("Oyun hazırlanıyor...");
  const [isComplete, setIsComplete] = useState(false);
  const [showErganImage, setShowErganImage] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const loadingSteps = [
    { text: "Oyun hazırlanıyor...", progress: 0 },
    { text: "Harfler yükleniyor...", progress: 15 },
    { text: "Kelimeler kontrol ediliyor...", progress: 30 },
    { text: "Joker kartları hazırlanıyor...", progress: 45 },
    { text: "Geri sayım görselleri yükleniyor...", progress: 55 },
    { text: "Sözlük güncelleniyor...", progress: 70 },
    { text: "Oyun kuralları yükleniyor...", progress: 85 },
    { text: "Son hazırlıklar...", progress: 95 },
    { text: "Tamamlandı!", progress: 100 },
  ];

  useEffect(() => {
    const loadAssets = async () => {
      const ASSET_TIMEOUT = 5000;

      try {
        // Ana sayfa yüzen ada görselleri: açılışta hazırlanır, sonraki
        // ana sayfa dönüşlerinde bekleme olmaz.
        const islandsPromise = Promise.race([
          preloadHomeIslands(),
          new Promise((resolve) => setTimeout(resolve, ASSET_TIMEOUT)),
        ]);

        const countdownPromise = Promise.race([
          ensureImagesLoaded(),
          new Promise((resolve) => setTimeout(resolve, ASSET_TIMEOUT)),
        ]);

        const tipsPromise = Promise.race([
          fetch("/ipucu.txt")
            .then(async (response) => {
              if (response.ok) {
                const text = await response.text();
                const tipsArray = text.split("\n").filter((line) => line.trim() !== "");
                setTips(tipsArray);
                setCurrentTip(tipsArray[Math.floor(Math.random() * tipsArray.length)]);
              }
            })
            .catch((error) => {
              console.warn("İpucu dosyası okunamadı:", error);
              setCurrentTip(tips[0]);
            }),
          new Promise((resolve) => setTimeout(resolve, ASSET_TIMEOUT)),
        ]);

        await Promise.all([countdownPromise, tipsPromise, islandsPromise]);
        console.log("✅ LoadingScreen: All assets preloaded");
      } catch (error) {
        console.warn("Asset yükleme hatası:", error);
      }
    };

    loadAssets();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const failsafeTimer = setTimeout(() => {
      console.log("⚠️ LoadingScreen: Failsafe timeout");
      if (onLoadingComplete) onLoadingComplete();
    }, 15000);

    const erganTimer = setTimeout(() => {
      setShowErganImage(false);
      setShowLoading(true);
    }, 3000);

    const loadingTimer = setTimeout(() => {
      let currentStep = 0;

      const updateStep = () => {
        if (currentStep < loadingSteps.length) {
          const step = loadingSteps[currentStep];
          setProgress(step.progress);
          setLoadingText(step.text);
          currentStep++;

          if (currentStep < loadingSteps.length) {
            setTimeout(updateStep, Math.random() * 500 + 700);
          } else {
            setTimeout(() => {
              setLoadingText("Oyun başlıyor...");
              setIsComplete(true);
              setTimeout(() => {
                clearTimeout(failsafeTimer);
                if (onLoadingComplete) onLoadingComplete();
              }, 1000);
            }, 500);
          }
        }
      };

      updateStep();
    }, 3500);

    return () => {
      clearTimeout(failsafeTimer);
      clearTimeout(erganTimer);
      clearTimeout(loadingTimer);
    };
  }, [mounted, onLoadingComplete]);

  return (
    <div
      className="loading-screen"
      style={{
        backgroundColor: "#1a1a1a",
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {showErganImage || !mounted ? (
        <div
          className="ergan-image-container"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "black",
            zIndex: 1000,
          }}
        >
          <img src="/ergan.jpg" alt="Ergan" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ) : showLoading ? (
        <>
          {/* Genişletilmiş ve Düzenlenmiş İpucu Konteyneri */}
          <div
            className="tip-container"
            style={{
              width: "90%",
              maxWidth: "600px",
              margin: "0 auto 40px auto",
              padding: "25px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: "15px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              minHeight: "100px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                color: "#4ECDC4",
                fontSize: "12px",
                fontWeight: "bold",
                marginBottom: "10px",
                textTransform: "uppercase",
              }}
            >
              Biliyor muydunuz?
            </span>
            <div
              className="tip-text"
              style={{
                fontSize: "18px",
                lineHeight: "1.5",
                color: "#f1f1f1",
                textAlign: "center",
                fontWeight: "500",
              }}
            >
              {currentTip}
            </div>
          </div>

          <div className="loading-container" style={{ width: "80%", maxWidth: "500px" }}>
            <div
              className="progress-bar-container"
              style={{
                position: "relative",
                height: "35px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "20px",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "15px",
              }}
            >
              <div
                className="progress-bar"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 0,
                  transform: "translateX(-50%)",
                  width: `${progress}%`,
                  height: "100%",
                  transition: "width 0.5s ease-out",
                  background: isComplete
                    ? "linear-gradient(90deg, #4ade80, #16a34a)"
                    : "linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1)",
                }}
              ></div>
              <div
                style={{
                  position: "relative",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "14px",
                  zIndex: 2,
                }}
              >
                %{progress}
              </div>
            </div>
            <div
              className="loading-text"
              style={{
                color: isComplete ? "#4ade80" : "#999",
                textAlign: "center",
                fontSize: "14px",
                letterSpacing: "1px",
              }}
            >
              {loadingText}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default LoadingScreen;
