import React, { useState, useEffect } from 'react';

const LoadingScreen = ({ onLoadingComplete }) => {
  const [tips, setTips] = useState(['Oyun yükleniyor...']);
  const [currentTip, setCurrentTip] = useState('');
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Oyun hazırlanıyor...');
  const [isComplete, setIsComplete] = useState(false);
  const [showErganImage, setShowErganImage] = useState(true);

  const loadingSteps = [
    { text: 'Oyun hazırlanıyor...', progress: 0 },
    { text: 'Harfler yükleniyor...', progress: 15 },
    { text: 'Kelimeler kontrol ediliyor...', progress: 30 },
    { text: 'Joker kartları hazırlanıyor...', progress: 45 },
    { text: 'Sözlük güncelleniyor...', progress: 60 },
    { text: 'Oyun kuralları yükleniyor...', progress: 75 },
    { text: 'Kullanıcı verisi kontrol ediliyor...', progress: 90 },
    { text: 'Son hazırlıklar...', progress: 95 },
    { text: 'Tamamlandı!', progress: 100 }
  ];

  useEffect(() => {
    // İpuçları yükle
    const loadTips = async () => {
      try {
        const response = await fetch('/ipucu.txt');
        if (response.ok) {
          const text = await response.text();
          const tipsArray = text.split('\n').filter(line => line.trim() !== '');
          setTips(tipsArray);
          setCurrentTip(tipsArray[Math.floor(Math.random() * tipsArray.length)]);
        }
      } catch (error) {
        console.warn('İpucu dosyası okunamadı:', error);
        setCurrentTip(tips[0]);
      }
    };

    loadTips();
  }, []);

  useEffect(() => {
    // Ergan görselini 3 saniye göster
    setTimeout(() => {
      setShowErganImage(false);
    }, 3000);

    // Loading süreci - Minimum 5-6 saniye
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
              if (onLoadingComplete) {
                onLoadingComplete();
              }
            }, 1000);
          }, 500);
        }
      }
    };

    // 3 saniye ergan görseli sonrasında loading başlasın
    setTimeout(updateStep, 3500);
  }, [onLoadingComplete]);

  return (
    <div className="loading-screen">
      {showErganImage ? (
        <div className="ergan-image-container" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1000
        }}>
          <img 
            src="/ergan.jpg" 
            alt="Ergan" 
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
      ) : (
        <>
          <div className="tip-container">
            <div className="tip-text">{currentTip}</div>
          </div>
          
          <div className="loading-container">
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ 
                  width: `${progress}%`,
                  background: isComplete ? 
                    'linear-gradient(90deg, #4ade80, #22c55e, #16a34a)' : 
                    'linear-gradient(90deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4)'
                }}
              ></div>
            </div>
            <div className="loading-text" style={{
              color: isComplete ? '#4ade80' : 'white'
            }}>{loadingText}</div>
          </div>
        </>
      )}
    </div>
  );
};

export default LoadingScreen;