import React, { useEffect, useRef, memo } from "react";
import { Text, StyleSheet, Platform } from "react-native";

// Web için ses dosyası yolu: public/sounds/default.mp3
const WEB_SOUND_PATH = "/sounds/default.mp3";
// Native için ses dosyası (Assets klasörüne eklemelisin):
// const NATIVE_SOUND = require("./assets/sounds/default.mp3");

interface FinalCountdownProps {
  displayTime: number;
  onCountdownTick?: (second: number) => void;
}

const FinalCountdown = memo(({ displayTime, onCountdownTick }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);
  const audioRef = useRef<any>(null); // Web Audio veya Expo Sound objesi için

  const showCountdown = displayTime >= 1 && displayTime <= 9;

  // SES ÇALMA FONKSİYONU (Platform Agnostic)
  const playPitchSound = async (secondsLeft: number) => {
    // Pitch (Hız/Perde) Hesaplama:
    // 9 saniyede 1.0 (normal), 1 saniyede ~1.8 (ince/hızlı)
    const pitchRate = 1.0 + (9 - secondsLeft) * 0.1;

    if (Platform.OS === "web") {
      // --- WEB MANTIĞI ---
      const audio = new Audio(WEB_SOUND_PATH);
      audio.playbackRate = pitchRate;
      audio.play().catch((e) => console.log("Ses çalma hatası (Web):", e));
    } else {
      // --- NATIVE MANTIĞI (Expo AV kullanıyorsan) ---
      // Not: Native'de 'expo-av' yüklü olmalıdır.
      try {
        const { Audio } = require("expo-av");
        const { sound } = await Audio.Sound.createAsync(
          require("./assets/sounds/default.mp3"), // Native dosya yolu
        );
        await sound.setRateAsync(pitchRate, true); // true: Perdeyi hızla birlikte yükseltir
        await sound.playAsync();
        // Çaldıktan sonra temizle
        sound.setOnPlaybackStatusUpdate((s: any) => {
          if (s.didJustFinish) sound.unloadAsync();
        });
      } catch (e) {
        console.log("Ses çalma hatası (Native):", e);
      }
    }
  };

  useEffect(() => {
    if (showCountdown && displayTime !== lastTickRef.current) {
      lastTickRef.current = displayTime;
      playPitchSound(displayTime);
      onCountdownTick?.(displayTime);
    }
  }, [displayTime, showCountdown]);

  if (!showCountdown) return null;

  return <Text style={styles.textStyle}>{displayTime}</Text>;
});

// STİLLER (Hem Web hem Native için uyumlu)
const styles = StyleSheet.create({
  textStyle: {
    fontSize: 120,
    fontWeight: "900",
    color: "#ef4444",
    textAlign: "center",
    fontFamily: Platform.OS === "web" ? "'Orbitron', sans-serif" : "System",
    ...Platform.select({
      web: {
        // Tailwind/CSS benzeri gölge (sadece webde tam çalışır)
        textShadow: "0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(239,68,68,0.5)",
      },
      native: {
        textShadowColor: "rgba(239, 68, 68, 0.8)",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
      },
    }),
  },
});

FinalCountdown.displayName = "FinalCountdown";

export default FinalCountdown;
