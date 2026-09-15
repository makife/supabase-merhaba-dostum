import React, { useState, useEffect, useRef } from "react";
import Lottie from "lottie-react";
import { ensureImagesLoaded } from "./GameCountdown";
import { preloadHomeIslands } from "@/lib/homeIslandAssets";
import erganGif from "@/assets/ergan.gif";
import wormAnimationData from "@/assets/ilerlemeCubugu.json";

const LoadingScreen = ({ onLoadingComplete }) => {
  const [tips, setTips] = useState(["Oyun yükleniyor..."]);
  const [currentTip, setCurrentTip] = useState("");
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState("Oyun hazırlanıyor...");
  const [isComplete, setIsComplete] = useState(false);
  const [showErganImage, setShowErganImage] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isGifReady, setIsGifReady] = useState(false);

  // GIF 5 saniye (54 frame) ve sonsuz döngüde (loop) oynuyor,
  // videoda olduğu gibi "onEnded" event'i yok, bu yüzden süresini
  // biliyor olmamız ve elle bir timer ile intro'yu bitirmemiz gerekiyor.
  const ERGAN_GIF_DURATION_MS = 5000;

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

  const introFinishedRef = useRef(false);
  const finishIntro = () => {
    if (introFinishedRef.current) return;
    introFinishedRef.current = true;
    setShowErganImage(false);
    setShowLoading(true);
  };

  useEffect(() => {
    if (!mounted) return;
    // Gif zaten ERGAN_GIF_DURATION_MS sonra finishIntro'yu tetikliyor;
    // bu, olması gerekmeyen ama garanti olsun diye duran bir son çare (safety net).
    const introFallback = setTimeout(finishIntro, ERGAN_GIF_DURATION_MS + 3000);
    return () => clearTimeout(introFallback);
  }, [mounted]);

  // GIF her zaman "autoplay" olduğu için (img tag'i ekrana geldiği an oynamaya başlar,
  // iOS'un video'da yaptığı gibi kullanıcı etkileşimi/mute kontrolü YOK), sadece
  // süresi kadar bekleyip intro'yu bitiriyoruz.
  useEffect(() => {
    if (!mounted) return;
    const gifTimer = setTimeout(finishIntro, ERGAN_GIF_DURATION_MS);
    return () => clearTimeout(gifTimer);
  }, [mounted]);

  useEffect(() => {
    if (!showLoading) return;

    let cancelled = false;
    const timers = [];

    const failsafeTimer = setTimeout(() => {
      console.log("⚠️ LoadingScreen: Failsafe timeout");
      if (onLoadingComplete) onLoadingComplete();
    }, 15000);
    timers.push(failsafeTimer);

    let currentStep = 0;
    const updateStep = () => {
      if (cancelled || currentStep >= loadingSteps.length) return;
      const step = loadingSteps[currentStep];
      setProgress(step.progress);
      setLoadingText(step.text);
      currentStep++;

      if (currentStep < loadingSteps.length) {
        timers.push(setTimeout(updateStep, Math.random() * 500 + 700));
      } else {
        timers.push(
          setTimeout(() => {
            setLoadingText("Oyun başlıyor...");
            setIsComplete(true);
            timers.push(
              setTimeout(() => {
                clearTimeout(failsafeTimer);
                if (onLoadingComplete) onLoadingComplete();
              }, 1000)
            );
          }, 500)
        );
      }
    };

    updateStep();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [showLoading, onLoadingComplete]);

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
          <img
  src={erganGif}
  alt=""
  onLoad={() => setIsGifReady(true)}
  onError={finishIntro}
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover",
    opacity: isGifReady ? 1 : 0, // Gif hazır olana kadar tamamen gizli
    transition: "opacity 0.15s ease-in", // Aniden fırlamak yerine yumuşak geçiş
  }}
/>
        </div>
      ) : showLoading ? (
        <>
          {/* İpucu Konteyneri */}
          <div
            className="tip-container"
            style={{
              width: "90%",
              maxWidth: "600px",
              margin: "0 auto 20px auto",
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

          <div className="loading-container" style={{ width: "90%", maxWidth: "600px" }}>
            {/* Lottie Animasyon Konteyneri */}
<div
  style={{
    width: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transform: "translateY(105px)", // 👈 40px aşağı iter (örn: 60px, 80px yapabilirsin)
    marginBottom: "50px",
  }}
>
  <Lottie
    animationData={wormAnimationData}
    loop={false}
    autoplay={true}
    style={{ width: "100%", height: "auto" }}
  />
</div>



            {/* Yükleme Yazısı ve Yüzde */}
            <div
              className="loading-text"
              style={{
                color: isComplete ? "#4ade80" : "#999",
                textAlign: "center",
                fontSize: "15px",
                fontWeight: "600",
                letterSpacing: "1px",
                marginTop: "10px",
              }}
            >
              {loadingText} (%{progress})
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default LoadingScreen;
