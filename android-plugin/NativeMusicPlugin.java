package com.ergan.kelimele;

import android.content.res.AssetFileDescriptor;
import android.media.MediaPlayer;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@CapacitorPlugin(name = "NativeMusic")
public class NativeMusicPlugin extends Plugin {
    
    private MediaPlayer mediaPlayer;
    private boolean isMusicEnabled = true;
    private boolean wasPlayingBeforePause = false;
    
    // Playlist Yönetimi
    private ArrayList<String> currentPlaylist = new ArrayList<>();
    private int currentTrackIndex = 0;
    private String currentPackName = "default";
    private boolean isLoopingPack = false; // Doğa/Uzay sesleri tek dosya loop eder

    // Şarkı Listeleri (Java içinde hardcode ettik ki JS ölse bile o bilsin)
    private final String[] DEFAULT_TRACKS = {
        "backround-music.mp3", "backround-music1.mp3", "backround-music2.mp3",
        "backround-music3.mp3", "backround-music4.mp3", "backround-music5.mp3",
        "backround-music6.mp3", "backround-music7.mp3", "backround-music8.mp3", 
        "backround-music9.mp3"
    };

    @Override
    public void load() {
        // Plugin yüklendiğinde varsayılan listeyi hazırla ama çalma
        prepareDefaultPlaylist();
    }

    /**
     * JS'den gelen "Paketi Değiştir" emri
     * @param call { pack: "default" | "nature1" | ... }
     */
    @PluginMethod
    public void setPack(PluginCall call) {
        String pack = call.getString("pack", "default");
        
        // Eğer aynı paketteysek ve çalıyorsa elleme
        if (currentPackName.equals(pack) && mediaPlayer != null && mediaPlayer.isPlaying()) {
            call.resolve();
            return;
        }

        currentPackName = pack;
        stopInternal(); // Önceki müziği durdur

        if (pack.equals("default")) {
            isLoopingPack = false;
            prepareDefaultPlaylist(); // Listeyi oluştur ve karıştır (Shuffle)
            playCurrentTrack(); // İlk şarkıyı çal
        } else {
            // Tekli dosyalar (Loop modu)
            isLoopingPack = true;
            String filename = getSingleTrackFilename(pack);
            currentPlaylist.clear();
            currentPlaylist.add(filename);
            playCurrentTrack();
        }

        call.resolve();
    }

    /**
     * JS'den gelen "Müziği Aç/Kapa" emri
     * @param call { enabled: true/false }
     */
    @PluginMethod
    public void setMusicEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("enabled parameter is required");
            return;
        }

        isMusicEnabled = enabled;

        if (isMusicEnabled) {
            if (mediaPlayer == null) {
                playCurrentTrack();
            } else if (!mediaPlayer.isPlaying()) {
                mediaPlayer.start();
            }
        } else {
            if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                mediaPlayer.pause();
            }
        }
        call.resolve();
    }

    // --- İÇ MANTIK (JS GÖRMEZ) ---

    private void prepareDefaultPlaylist() {
        currentPlaylist.clear();
        for (String track : DEFAULT_TRACKS) {
            currentPlaylist.add("sounds/default/" + track);
        }
        // 🔥 SHUFFLE: Listeyi karıştır
        Collections.shuffle(currentPlaylist);
        currentTrackIndex = 0;
        Log.d("NativeMusic", "Playlist hazırlandı ve karıştırıldı. İlk şarkı: " + currentPlaylist.get(0));
    }

    private String getSingleTrackFilename(String pack) {
        switch (pack) {
            case "nature1": return "sounds/default/doga1.mp3";
            case "nature2": return "sounds/default/doga2.mp3";
            case "space1":  return "sounds/default/uzay1.mp3";
            case "space2":  return "sounds/default/uzay2.mp3";
            default: return "sounds/default/backround-music.mp3";
        }
    }

    private void playCurrentTrack() {
        if (!isMusicEnabled || currentPlaylist.isEmpty()) return;

        stopInternal(); // Temiz bir başlangıç için

        try {
            mediaPlayer = new MediaPlayer();
            
            // Dosya yolunu ayarla (Capacitor assets -> public/...)
            String assetPath = "public/" + currentPlaylist.get(currentTrackIndex);
            Log.d("NativeMusic", "Çalınıyor: " + assetPath);

            AssetFileDescriptor afd = getContext().getAssets().openFd(assetPath);
            mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();

            mediaPlayer.setVolume(0.3f, 0.3f);
            
            if (isLoopingPack) {
                mediaPlayer.setLooping(true); // Tek dosya sürekli dönsün
            } else {
                mediaPlayer.setLooping(false); // Playlist modunda şarkı bitince event tetiklensin
                // 🔥 Şarkı bitince ne olacak?
                mediaPlayer.setOnCompletionListener(mp -> {
                    Log.d("NativeMusic", "Şarkı bitti, sıradakine geçiliyor...");
                    playNextTrack();
                });
            }

            mediaPlayer.prepare();
            mediaPlayer.start();

        } catch (IOException e) {
            Log.e("NativeMusic", "Dosya oynatılamadı: " + e.getMessage());
        }
    }

    private void playNextTrack() {
        if (currentPlaylist.isEmpty()) return;

        // İndeksi artır, listenin sonundaysak başa dön
        currentTrackIndex++;
        if (currentTrackIndex >= currentPlaylist.size()) {
            currentTrackIndex = 0;
            // İsteğe bağlı: Liste bitince tekrar karıştırılabilir
            // Collections.shuffle(currentPlaylist); 
        }

        playCurrentTrack();
    }

    private void stopInternal() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception e) {
                // Hata yoksay
            }
            mediaPlayer = null;
        }
    }

    // --- LIFECYCLE (UYGULAMA ARKA PLANA GİDİNCE) ---

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
            wasPlayingBeforePause = true;
            Log.d("NativeMusic", "🌙 App background: Müzik duraklatıldı.");
        } else {
            wasPlayingBeforePause = false;
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // Sadece eğer müzik ayarı açıksa VE arka plana gitmeden önce çalıyorsa devam et
        if (isMusicEnabled && wasPlayingBeforePause && mediaPlayer != null) {
            mediaPlayer.start();
            Log.d("NativeMusic", "☀️ App foreground: Müzik devam ediyor.");
        }
    }
}
