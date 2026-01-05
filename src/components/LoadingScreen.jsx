import React, { useState, useEffect } from 'react';
import { ensureImagesLoaded } from './GameCountdown';

const LoadingScreen = ({ onLoadingComplete }) => {
  const [tips, setTips] = useState(['Oyun yükleniyor...']);
  const [currentTip, setCurrentTip] = useState('');
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Oyun hazırlanıyor...');
  const [isComplete, setIsComplete] = useState(false);
  // Force ergan to show first - başlangıçta mutlaka ergan göster
  const [showErganImage, setShowErganImage] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const loadingSteps = [
    { text: 'Oyun hazırlanıyor...', progress: 0 },
    { text: 'Harfler yükleniyor...', progress: 15 },
    { text: 'Kelimeler kontrol ediliyor...', progress: 30 },
    { text: 'Joker kartları hazırlanıyor...', progress: 45 },
    { text: 'Geri sayım görselleri yükleniyor...', progress: 55 },
    { text: 'Sözlük güncelleniyor...', progress: 70 },
    { text: 'Oyun kuralları yükleniyor...', progress: 85 },
    { text: 'Son hazırlıklar...', progress: 95 },
    { text: 'Tamamlandı!', progress: 100 }
  ];

  useEffect(() => {
    // İpuçları yükle ve countdown görsellerini preload et (timeout ile)
    const loadAssets = async () => {
      const ASSET_TIMEOUT = 5000; // 5 saniye timeout
      
      try {
        // Countdown görsellerini paralel olarak yükle - timeout ile
        const countdownPromise = Promise.race([
          ensureImagesLoaded(),
          new Promise((resolve) => setTimeout(resolve, ASSET_TIMEOUT))
        ]);
        
        // İpuçlarını yükle - timeout ile
        const tipsPromise = Promise.race([
          fetch('/ipucu.txt').then(async (response) => {
            if (response.ok) {
              const text = await response.text();
              const tipsArray = text.split('\n').filter(line => line.trim() !== '');
              setTips(tipsArray);
              setCurrentTip(tipsArray[Math.floor(Math.random() * tipsArray.length)]);
            }
          }).catch((error) => {
            console.warn('İpucu dosyası okunamadı:', error);
            setCurrentTip(tips[0]);
          }),
          new Promise((resolve) => setTimeout(resolve, ASSET_TIMEOUT))
        ]);

        // Her ikisini de bekle (timeout varsa devam et)
        await Promise.all([countdownPromise, tipsPromise]);
        console.log('✅ LoadingScreen: All assets preloaded (or timeout)');
      } catch (error) {
        console.warn('Asset yükleme hatası:', error);
      }
    };

    loadAssets();
  }, []);

  // Component mount olduğunda çalış
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Mounted olana kadar timer'ları başlatma
    if (!mounted) return;

    // FAILSAFE: Maksimum 15 saniyede loading bitsin
    const failsafeTimer = setTimeout(() => {
      console.log('⚠️ LoadingScreen: Failsafe timeout - forcing complete');
      if (onLoadingComplete) {
        onLoadingComplete();
      }
    }, 15000);

    // Ergan görselini 3 saniye göster
    const erganTimer = setTimeout(() => {
      setShowErganImage(false);
      setShowLoading(true);
    }, 3000);

    // Loading süreci - Ergan bitince başla
    const loadingTimer = setTimeout(() => {
      let currentStep = 0;
      
      const updateStep = () => {
        if (currentStep < loadingSteps.length) {
          const step = loadingSteps[currentStep];
          setProgress(step.progress);
          setLoadingText(step.text);
          currentStep++;
          
          if (currentStep < loadingSteps.length) {
            // Her adım arası 700-1200ms (toplamda ~6-8 saniye)
            setTimeout(updateStep, Math.random() * 500 + 700);
          } else {
            // Loading tamamlandı
            setTimeout(() => {
              setLoadingText('Oyun başlıyor...');
              setIsComplete(true);
              
              // 1 saniye daha bekle, sonra callback çağır
              setTimeout(() => {
                console.log('Loading completed, calling callback...');
                clearTimeout(failsafeTimer); // Failsafe'i iptal et
                if (onLoadingComplete) {
                  onLoadingComplete();
                }
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

  // İlk render'da her zaman ergan göster
  return (
    <div className="loading-screen">
      {(showErganImage || !mounted) ? (
        <div className="ergan-image-container" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'black',
          zIndex: 1000
        }}>
          <img 
            src="/ergan.jpg" 
            alt="Ergan"
            loading="eager"
            fetchpriority="high"
            decoding="sync"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
      ) : showLoading ? (
        <>
          <div className="tip-container">
            <div className="tip-text">{currentTip}</div>
          </div>
          
         <div className="loading-container">
            <div className="progress-bar-container" style={{
              position: 'relative',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div 
                className="progress-bar" 
                style={{ 
                  width: `${progress}%`,
                  height: '100%',
                  background: isComplete ? 
                    'linear-gradient(90deg, #4ade80, #22c55e, #16a34a)' : 
                    'linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4)'
                }}
              ></div>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '16px',
                textShadow: '0 0 4px rgba(0, 0, 0, 0.8)',
                zIndex: 2
              }}>%{progress}</div>
            </div>
            <div className="loading-text" style={{
              color: isComplete ? '#4ade80' : 'white'
            }}>{loadingText}</div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default LoadingScreen;
