/**
 * Native Audio Service - Capacitor Native Audio Plugin
 * Mobile'da HTML5 Audio yerine native ses sistemi kullanır
 */

import { Capacitor } from '@capacitor/core';
import { NativeAudio } from '@capacitor-community/native-audio';

// Platform kontrolü
const isNative = Capacitor.isNativePlatform();
const isIOSNative = isNative && Capacitor.getPlatform() === 'ios';

// Preload edilmiş ses listesi
const preloadedSounds = new Set<string>();

// Ses dosyası tanımları
interface SoundDefinition {
  assetId: string;
  assetPath: string;
  volume?: number;
  isUrl?: boolean;
  channels?: number; // iOS overlap için kanal sayısı (kısa/sık sesler için >1)
}

// Tüm sesler - 🔧 DOSYA YOLLARI DOĞRULANDI (public/ klasöründeki gerçek isimlerle eşleşiyor)
const SOUND_DEFINITIONS: SoundDefinition[] = [
  // Geri sayım sesleri
  { assetId: 'countdown', assetPath: 'public/gerisayim.mp3', volume: 0.6 },
  { assetId: 'start', assetPath: 'public/basla.mp3', volume: 0.7 },
  
  // Joker sesleri
  { assetId: 'joker_degistir', assetPath: 'public/degistir.mp3', volume: 0.7 },
  { assetId: 'joker_fisilda', assetPath: 'public/fisilda.mp3', volume: 0.7 },
  { assetId: 'joker_senyaz', assetPath: 'public/senyaz.mp3', volume: 0.7 },
  
  // Özel sesler
  { assetId: 'yes', assetPath: 'public/yes.mp3', volume: 0.7 },
  { assetId: 'wow1', assetPath: 'public/wow1.mp3', volume: 0.7 },
  { assetId: 'wow2', assetPath: 'public/wow2.mp3', volume: 0.7 },
  { assetId: 'yahoo', assetPath: 'public/yahoo.mp3', volume: 0.7 },
  { assetId: 'sampiyon', assetPath: 'public/sampiyon.mp3', volume: 0.8 },
  { assetId: 'didyouseethat', assetPath: 'public/didyouseethat.mp3', volume: 0.7 },
  
  { assetId: 'cark', assetPath: 'public/carkSesi.mp3', volume: 0.6 }, // ✅ Gerçek dosya adı: carkSesi.mp3
  { assetId: 'cark_dolu', assetPath: 'public/carkDoluGeldi.mp3', volume: 0.7 },
  { assetId: 'cark_bos', assetPath: 'public/carkBosGeldi.mp3', volume: 0.7 },
  
  // Oyun sesleri - ✅ DOĞRULANMIŞ YOLLAR (public/sounds/default/ içinde)
  // 🔧 Menü/geri butonları → oyunicibutonsesi.mp3
  { assetId: 'button_click', assetPath: 'public/oyunicibutonsesi.mp3', volume: 0.5, channels: 4 },
  { assetId: 'correct_word', assetPath: 'public/sounds/default/correct-word.mp3', volume: 0.6, channels: 3 },
  { assetId: 'wrong_word', assetPath: 'public/sounds/default/wrong-word.mp3', volume: 0.5, channels: 3 },
  { assetId: 'celebration', assetPath: 'public/sounds/default/kutlama.mp3', volume: 0.6 },
  { assetId: 'game_lose', assetPath: 'public/sounds/default/kaybetme.mp3', volume: 0.6 },
  { assetId: 'tie', assetPath: 'public/sounds/default/beraberlik.mp3', volume: 0.6 },
  // 🔧 10 saniye geri sayım → onsaniyegerisayim.mp3
  { assetId: 'beep', assetPath: 'public/onsaniyegerisayim.mp3', volume: 0.7, channels: 4 },
  // 🔧 Izgara harf butonları → butonsesi.mp3
  { assetId: 'letter_select', assetPath: 'public/butonsesi.mp3', volume: 0.5, channels: 4 },
  // 30 saniye uyarı sesi
  { assetId: 'time_warning', assetPath: 'public/sureAzaliyor.mp3', volume: 0.7 },
  { assetId: 'final_countdown_click', assetPath: 'public/geriSayimKlik.mp3', volume: 0.7, channels: 4 },
  { assetId: 'tournament_win', assetPath: 'public/turKazanma.mp3', volume: 0.8 },
];

const toIOSNativeAssetPath = (assetPath: string): string => {
  const fileName = assetPath.replace(/^public\//, '').split('/').pop();
  return fileName ? `sounds/${fileName}` : assetPath;
};

// Initialization flag
let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Native Audio hazır olana kadar bekle
 */
export const waitForNativeAudio = async (): Promise<boolean> => {
  if (!isNative) return false;
  if (initialized) return true;
  if (initPromise) {
    await initPromise;
    return initialized;
  }
  return false;
};

/**
 * Native Audio başlatıldı mı kontrol et
 */
export const isNativeAudioReady = (): boolean => initialized;

/**
 * Native Audio'yu başlat ve tüm sesleri preload et
 */
export const initNativeAudio = async (): Promise<void> => {
  if (!isNative) {
    console.log('🔊 NativeAudio: Web ortamı, HTML5 Audio kullanılacak');
    return;
  }

  if (isIOSNative) {
    if (initialized) return;
    if (initPromise) return initPromise;

    // iOS IPA'da WKWebView/WebAudio bazı kısa efektleri sessiz bırakabiliyor.
    // Tek yol olarak NativeAudio kullanıyoruz; HTML5/oscillator fallback yok, bu yüzden AVAudioSession çakışması da yok.
    initPromise = (async () => {
      try {
        // 🔧 iOS: focus:false → AVAudioSession ambient mod, arka plan müziğini kesmez
        await NativeAudio.configure({ fade: false, focus: false });
      } catch (e) {
        console.warn('⚠️ NativeAudio iOS configure atlandı:', e);
      }

      await Promise.all(SOUND_DEFINITIONS.map(async (sound) => {
        try {
          if (preloadedSounds.has(sound.assetId)) return;
          try { await NativeAudio.unload({ assetId: sound.assetId }); } catch {}
          await NativeAudio.preload({
            assetId: sound.assetId,
            assetPath: toIOSNativeAssetPath(sound.assetPath),
            audioChannelNum: sound.channels ?? 1,
            isUrl: false,
          });
          if (sound.volume !== undefined) {
            try { await NativeAudio.setVolume({ assetId: sound.assetId, volume: sound.volume }); } catch {}
          }
          preloadedSounds.add(sound.assetId);
          console.log(`✅ NativeAudio iOS: ${sound.assetId} yüklendi`);
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          if (message.includes('already exists')) {
            preloadedSounds.add(sound.assetId);
          } else {
            console.warn(`⚠️ NativeAudio iOS: ${sound.assetId} yüklenemedi:`, e);
          }
        }
      }));

      initialized = true;
      console.log(`🔊 NativeAudio iOS: ${preloadedSounds.size}/${SOUND_DEFINITIONS.length} ses hazır ✅`);
    })();
    return initPromise;
  }

  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('🔊 NativeAudio: Başlatılıyor...');
      
      // Tüm sesleri paralel olarak preload et (daha hızlı)
      const preloadPromises = SOUND_DEFINITIONS.map(async (sound) => {
        try {
          // Eğer zaten preload edilmişse atla
          if (preloadedSounds.has(sound.assetId)) {
            console.log(`✅ NativeAudio: ${sound.assetId} zaten yüklü`);
            return;
          }
          
          // Önce unload dene (varsa temizle) - "already exists" hatasını önler
          try {
            await NativeAudio.unload({ assetId: sound.assetId });
          } catch {
            // Asset yoksa hata verir, ignore et
          }
          
          await NativeAudio.preload({
            assetId: sound.assetId,
            assetPath: sound.assetPath,
            audioChannelNum: sound.channels ?? 1,
            isUrl: false,
          });
          preloadedSounds.add(sound.assetId);
          console.log(`✅ NativeAudio: ${sound.assetId} yüklendi`);
        } catch (e: unknown) {
          // "already exists" hatası - aslında yüklü demek
          const message = e instanceof Error ? e.message : String(e);
          if (message.includes('already exists')) {
            preloadedSounds.add(sound.assetId);
            console.log(`✅ NativeAudio: ${sound.assetId} zaten mevcut`);
          } else {
            console.warn(`⚠️ NativeAudio: ${sound.assetId} yüklenemedi:`, e);
          }
        }
      });
      
      await Promise.all(preloadPromises);
      
      initialized = true;
      console.log(`🔊 NativeAudio: ${preloadedSounds.size}/${SOUND_DEFINITIONS.length} ses hazır ✅`);
    } catch (error) {
      console.error('❌ NativeAudio: Başlatma hatası:', error);
    }
  })();

  return initPromise;
};

/**
 * HTML5 Audio fallback - Native ses yüklenemediğinde
 */
const playHTML5Fallback = (assetPath: string, volume: number = 0.7): boolean => {
  // 🔧 iOS crash guard: Native app içinde HTML5 Audio fallback yapma.
  // Özellikle harf seçimi/kelime gönderimi gibi yoğun aksiyonlarda WebView audio stack'i
  // native audio ile çakışıp uygulamayı oyundan atabiliyor.
  if (isNative) return false;

  try {
    // public/ prefix'ini kaldır
    const webPath = assetPath.replace('public/', '/');
    const audio = new Audio(webPath);
    audio.volume = volume;
    audio.play().catch(e => {
      console.log(`⚠️ HTML5 Audio fallback başarısız (beklenen):`, e);
    });
    return true;
  } catch (e) {
    console.log(`⚠️ HTML5 Audio fallback oluşturulamadı:`, e);
    return false;
  }
};

/**
 * Native ses çal - Preload tamamlanmamışsa bekle, hata durumunda HTML5 fallback
 */
export const playNativeSound = async (assetId: string, volume?: number): Promise<boolean> => {
  // 🔧 AUDIO FAILSAFE: Web ortamında direkt HTML5 kullan
  if (!isNative) {
    const soundDef = SOUND_DEFINITIONS.find(s => s.assetId === assetId);
    if (soundDef) {
      return playHTML5Fallback(soundDef.assetPath, volume || soundDef.volume || 0.7);
    }
    return false;
  }

  if (isIOSNative) {
    if (!initialized && initPromise) {
      try {
        await Promise.race([
          initPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('iOS preload timeout')), 2000))
        ]);
      } catch {}
    }
  }
  
  // Eğer henüz başlatılmadıysa bekle (max 2 saniye)
  if (!initialized && initPromise) {
    console.log(`⏳ NativeAudio: ${assetId} için preload bekleniyor...`);
    try {
      await Promise.race([
        initPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Preload timeout')), 2000))
      ]);
    } catch (e) {
      console.log(`⚠️ NativeAudio: Preload timeout - HTML5 fallback denenecek`);
    }
  }
  
  // 🔧 AUDIO FAILSAFE: Ses preload edilmemişse HTML5 fallback
  if (!preloadedSounds.has(assetId)) {
    console.warn(`⚠️ NativeAudio: ${assetId} preload edilmemiş`);
    if (isNative) return false;
    const soundDef = SOUND_DEFINITIONS.find(s => s.assetId === assetId);
    if (soundDef) {
      return playHTML5Fallback(soundDef.assetPath, volume || soundDef.volume || 0.7);
    }
    return false;
  }

  try {
    const soundDef = SOUND_DEFINITIONS.find(s => s.assetId === assetId);
    const isMultiChannel = (soundDef?.channels ?? 1) > 1;

    // 🔧 iOS-fix: Çok kanallı sesler için stop ÇAĞIRMA — kanallar overlap edebilsin.
    // Sadece tek kanallı uzun sesler (yes/wow/celebration vs.) için önceki çalmayı kes.
    if (!isMultiChannel) {
      try {
        await NativeAudio.stop({ assetId });
      } catch (e) {
        // Ignore stop errors
      }
    }

    // Volume ayarla
    if (volume !== undefined) {
      await NativeAudio.setVolume({ assetId, volume });
    }

    // Çal
    await NativeAudio.play({ assetId });
    console.log(`🔊 NativeAudio: ${assetId} çalındı`);
    return true;
  } catch (error: unknown) {
    // 🔧 AUDIO FAILSAFE: Native hata (status=0x1 vb) durumunda HTML5 fallback
    console.error(`❌ NativeAudio: ${assetId} çalınamadı:`, error);
    if (isNative) return false;
    const soundDef = SOUND_DEFINITIONS.find(s => s.assetId === assetId);
    if (soundDef) {
      return playHTML5Fallback(soundDef.assetPath, volume || soundDef.volume || 0.7);
    }
    return false;
  }
};

/**
 * Geri sayım sesi çal
 */
export const playCountdownSound = async (): Promise<boolean> => {
  return playNativeSound('countdown', 0.6);
};

/**
 * Başla sesi çal
 */
export const playStartSound = async (): Promise<boolean> => {
  return playNativeSound('start', 0.7);
};

/**
 * Joker sesi çal
 */
export const playJokerSound = async (jokerType: 'degistir' | 'fisilda' | 'senyaz'): Promise<boolean> => {
  return playNativeSound(`joker_${jokerType}`, 0.7);
};

/**
 * Özel ses çal (dosya adından assetId çıkar)
 */
export const playSpecialNativeSound = async (soundFile: string, volume: number = 0.7): Promise<boolean> => {
  // Dosya adından assetId çıkar
  let assetId = '';
  
  if (soundFile.includes('yes.mp3')) assetId = 'yes';
  else if (soundFile.includes('wow2.mp3')) assetId = 'wow2';
  else if (soundFile.includes('wow1.mp3')) assetId = 'wow1';
  else if (soundFile.includes('yahoo.mp3')) assetId = 'yahoo';
  else if (soundFile.includes('degistir.mp3')) assetId = 'joker_degistir';
  else if (soundFile.includes('fisilda.mp3')) assetId = 'joker_fisilda';
  else if (soundFile.includes('senyaz.mp3')) assetId = 'joker_senyaz';
  else if (soundFile.includes('sampiyon.mp3')) assetId = 'sampiyon';
  else if (soundFile.includes('didyouseethat.mp3')) assetId = 'didyouseethat';
  else if (soundFile.includes('geriSayimKlik.mp3')) assetId = 'final_countdown_click';
  else if (soundFile.includes('turKazanma.mp3')) assetId = 'tournament_win';
  
  else if (soundFile.includes('carkSesi.mp3')) assetId = 'cark';
  else if (soundFile.includes('carkDoluGeldi.mp3')) assetId = 'cark_dolu';
  else if (soundFile.includes('carkBosGeldi.mp3')) assetId = 'cark_bos';
  else if (soundFile.includes('kutlama.mp3')) assetId = 'celebration';
  else if (soundFile.includes('kaybetme.mp3')) assetId = 'game_lose';
  else if (soundFile.includes('beraberlik.mp3')) assetId = 'tie';
  else if (soundFile.includes('button-click.mp3') || soundFile.includes('butonKlik.mp3')) assetId = 'button_click';
  else if (soundFile.includes('correct-word.mp3')) assetId = 'correct_word';
  else if (soundFile.includes('wrong-word.mp3')) assetId = 'wrong_word';
  
  if (assetId) {
    return playNativeSound(assetId, volume);
  }
  
  return false;
};

/**
 * Tüm sesleri kapat
 */
export const stopAllSounds = async (): Promise<void> => {
  if (!isNative) return;
  
  for (const assetId of preloadedSounds) {
    try {
      await NativeAudio.stop({ assetId });
    } catch (e) {
      // Ignore
    }
  }
};

/**
 * Tüm sesleri temizle (unload)
 */
export const unloadAllSounds = async (): Promise<void> => {
  if (!isNative) return;
  
  for (const assetId of preloadedSounds) {
    try {
      await NativeAudio.unload({ assetId });
    } catch (e) {
      // Ignore
    }
  }
  
  preloadedSounds.clear();
  initialized = false;
  initPromise = null;
};

/**
 * Native platform mi kontrol et
 */
export const isNativePlatform = (): boolean => isNative;

/**
 * Ses preload edilmiş mi kontrol et
 */
export const isSoundPreloaded = (assetId: string): boolean => preloadedSounds.has(assetId);
