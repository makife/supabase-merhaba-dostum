import './LoadingScreen.css';

const LoadingScreen = () => {
  const [tips, setTips] = useState(['Oyun yükleniyor...']);
  const [currentTip, setCurrentTip] = useState('');
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Oyun hazırlanıyor...');

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
    // Loading süreci
    let currentStep = 0;
    
    const updateStep = () => {
      if (currentStep < loadingSteps.length) {
        const step = loadingSteps[currentStep];
        setProgress(step.progress);
        setLoadingText(step.text);
        currentStep++;
        
        if (currentStep < loadingSteps.length) {
          setTimeout(updateStep, Math.random() * 800 + 600);
        }
      }
    };

    setTimeout(updateStep, 500);
  }, []);

  return (
    <div className="loading-screen">
      <div className="tip-container">
        <div className="tip-text">{currentTip}</div>
      </div>
      
      <div className="loading-container">
        <div className="progress-bar-container">
          <div 
            className="progress-bar" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="loading-text">{loadingText}</div>
      </div>
    </div>
  );
};

export default LoadingScreen;
