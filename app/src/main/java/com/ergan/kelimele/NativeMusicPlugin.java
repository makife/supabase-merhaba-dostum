package com.ergan.kelimele;

import android.content.res.AssetFileDescriptor;
import android.media.MediaPlayer;
import android.os.Handler;
import android.os.Looper;
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
    
    // Fade için
    private Handler fadeHandler = new Handler(Looper.getMainLooper());
    private Runnable fadeRunnable;
    private static final float ORIGINAL_VOLUME = 0.3f;
    
    // Playlist Yönetimi
    private ArrayList<String> currentPlaylist = new ArrayList<>();
    private int currentTrackIndex = 0;
    private String currentPackName = "default";
    private boolean isLoopingPack = false;

    private final String[] DEFAULT_TRACKS = {
        "background-music.mp3", "background-music1.mp3", "background-music2.mp3",
        "background-music3.mp3", "background-music4.mp3", "background-music5.mp3",
        "background-music6.mp3", "background-music7.mp3"
    };

    @Override
    public void load() {
        prepareDefaultPlaylist();
    }

    @PluginMethod
    public void setPack(PluginCall call) {
        String pack = call.getString("pack", "default");
        
        if (currentPackName.equals(pack) && mediaPlayer != null && mediaPlayer.isPlaying()) {
            call.resolve();
            return;
        }

        currentPackName = pack;
        stopInternal();

        if (pack.equals("default")) {
            isLoopingPack = false;
            prepareDefaultPlaylist();
            playCurrentTrack();
        } else {
            isLoopingPack = true;
            String filename = getSingleTrackFilename(pack);
            currentPlaylist.clear();
            currentPlaylist.add(filename);
            playCurrentTrack();
        }

        call.resolve();
    }

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

    /**
     * 🎵 FADE OUT - JS'den çağrılır
     * @param call { duration: 4.5 } // saniye cinsinden
     */
    @PluginMethod
    public void fadeOut(PluginCall call) {
        Double durationSeconds = call.getDouble("duration", 2.0);
        int durationMs = (int) (durationSeconds * 1000);
        
        if (mediaPlayer == null || !mediaPlayer.isPlaying()) {
            Log.d("NativeMusic", "🎵 Fade out: Müzik zaten durmuş");
            call.resolve();
            return;
        }

        // Önceki fade'i iptal et
        if (fadeRunnable != null) {
            fadeHandler.removeCallbacks(fadeRunnable);
        }

        Log.d("NativeMusic", "🎵 Fade out başlıyor: " + durationMs + "ms");

        final float startVolume = ORIGINAL_VOLUME;
        final int steps = 50; // Yumuşak geçiş için
        final int stepDuration = durationMs / steps;
        final float volumeStep = startVolume / steps;
        
        final int[] currentStep = {0};

        fadeRunnable = new Runnable() {
            @Override
            public void run() {
                if (mediaPlayer == null || !mediaPlayer.isPlaying()) {
                    fadeHandler.removeCallbacks(this);
                    return;
                }

                currentStep[0]++;
                float newVolume = Math.max(0, startVolume - (volumeStep * currentStep[0]));
                
                try {
                    mediaPlayer.setVolume(newVolume, newVolume);
                } catch (Exception e) {
                    Log.e("NativeMusic", "Fade out volume hatası: " + e.getMessage());
                }

                if (currentStep[0] >= steps) {
                    // Fade tamamlandı - müziği durdur
                    Log.d("NativeMusic", "🎵 Fade out tamamlandı, müzik durduruluyor");
                    stopInternal();
                    fadeHandler.removeCallbacks(this);
                    call.resolve();
                } else {
                    // Bir sonraki adıma geç
                    fadeHandler.postDelayed(this, stepDuration);
                }
            }
        };

        fadeHandler.post(fadeRunnable);
    }

    /**
     * 🎵 FADE IN - İsteğe bağlı (sonra ekleyebilirsin)
     * @param call { duration: 2.0 }
     */
    @PluginMethod
    public void fadeIn(PluginCall call) {
        Double durationSeconds = call.getDouble("duration", 2.0);
        int durationMs = (int) (durationSeconds * 1000);
        
        if (!isMusicEnabled) {
            call.resolve();
            return;
        }

        // Önceki fade'i iptal et
        if (fadeRunnable != null) {
            fadeHandler.removeCallbacks(fadeRunnable);
        }

        // Müzik çalmıyorsa başlat
        if (mediaPlayer == null || !mediaPlayer.isPlaying()) {
            playCurrentTrack();
        }

        if (mediaPlayer == null) {
            call.resolve();
            return;
        }

        Log.d("NativeMusic", "🎵 Fade in başlıyor: " + durationMs + "ms");

        // Sesi 0'dan başlat
        try {
            mediaPlayer.setVolume(0f, 0f);
        } catch (Exception e) {
            Log.e("NativeMusic", "Fade in başlangıç volume hatası: " + e.getMessage());
        }

        final float targetVolume = ORIGINAL_VOLUME;
        final int steps = 50;
        final int stepDuration = durationMs / steps;
        final float volumeStep = targetVolume / steps;
        
        final int[] currentStep = {0};

        fadeRunnable = new Runnable() {
            @Override
            public void run() {
                if (mediaPlayer == null || !mediaPlayer.isPlaying()) {
                    fadeHandler.removeCallbacks(this);
                    return;
                }

                currentStep[0]++;
                float newVolume = Math.min(targetVolume, volumeStep * currentStep[0]);
                
                try {
                    mediaPlayer.setVolume(newVolume, newVolume);
                } catch (Exception e) {
                    Log.e("NativeMusic", "Fade in volume hatası: " + e.getMessage());
                }

                if (currentStep[0] >= steps) {
                    Log.d("NativeMusic", "🎵 Fade in tamamlandı");
                    fadeHandler.removeCallbacks(this);
                    call.resolve();
                } else {
                    fadeHandler.postDelayed(this, stepDuration);
                }
            }
        };

        fadeHandler.post(fadeRunnable);
    }

    // --- İÇ MANTIK ---

    private void prepareDefaultPlaylist() {
        currentPlaylist.clear();
        for (String track : DEFAULT_TRACKS) {
            currentPlaylist.add("sounds/default/" + track);
        }
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

        stopInternal();

        try {
            mediaPlayer = new MediaPlayer();
            
            String assetPath = "public/" + currentPlaylist.get(currentTrackIndex);
            Log.d("NativeMusic", "Çalınıyor: " + assetPath);

            AssetFileDescriptor afd = getContext().getAssets().openFd(assetPath);
            mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();

            mediaPlayer.setVolume(ORIGINAL_VOLUME, ORIGINAL_VOLUME);
            
            if (isLoopingPack) {
                mediaPlayer.setLooping(true);
            } else {
                mediaPlayer.setLooping(false);
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

        currentTrackIndex++;
        if (currentTrackIndex >= currentPlaylist.size()) {
            currentTrackIndex = 0;
        }

        playCurrentTrack();
    }

    private void stopInternal() {
        // Fade'i iptal et
        if (fadeRunnable != null) {
            fadeHandler.removeCallbacks(fadeRunnable);
            fadeRunnable = null;
        }

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
        if (isMusicEnabled && wasPlayingBeforePause && mediaPlayer != null) {
            mediaPlayer.start();
            Log.d("NativeMusic", "☀️ App foreground: Müzik devam ediyor.");
        }
    }
}