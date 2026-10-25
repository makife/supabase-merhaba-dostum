package com.ergan.kelimele;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * 🚀 MainActivity - 2 DAKİKA KURALI
 * 
 * KURAL:
 * - 2 dakikadan FAZLA arka planda → TAM RESTART (cold start, loading ekranı gösterilir)
 * - 2 dakikadan AZ arka planda → SOFT RESTART (aynı sayfada, loading ATLANIR, kanallar canlanır)
 */
public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1235;
    
    // Restart türlerini belirten bayraklar
    private static final String EXTRA_RESUME_RESTART = "RESUME_RESTART";  // Soft restart (loading atlanır)
    private static final String EXTRA_COLD_RESTART = "COLD_RESTART";      // Tam restart (loading gösterilir)
    
    // DİSK KAYIT AYARLARI
    private static final String PREFS_NAME = "AppRestartPrefs";
    private static final String KEY_PAUSE_TIME = "pause_time";
    
    // 🔥 2 DAKİKA = 120.000 ms
    private static final long FULL_RESTART_THRESHOLD_MS = 480000; // 2 dakika
    
    // Minimum arka plan süresi (her dönüşte restart için)
    private static final long MIN_BACKGROUND_TIME_MS = 500; // 0.5 saniye

    @Override
    protected void onCreate(Bundle savedInstanceState) {
		registerPlugin(NativeMusicPlugin.class);
		registerPlugin(NativeCameraPlugin.class); // 📷 Avatar kamera plugin'i
        super.onCreate(savedInstanceState);

        // Sistem çubukları geçici olarak görünürken WebView'i yeniden ölçme.
        // İçerik daima ekranın tamamında kalır; çubuklar üstüne bindirilir.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
		
		// 🔔 Push Notification Channel - IMPORTANCE_HIGH = heads-up banner
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.NotificationChannel channel = new android.app.NotificationChannel(
                "kelimeci_notifications",
                "Kelimele Bildirimleri",
                android.app.NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Oyun davetleri ve mesaj bildirimleri");
        channel.enableVibration(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
    
        android.app.NotificationManager manager = getSystemService(android.app.NotificationManager.class);
        manager.createNotificationChannel(channel);
        }
		
        hideSystemUI();
        checkNotificationPermission();
		
        
        // Bu bir restart mı kontrol et
        boolean isResumeRestart = getIntent().getBooleanExtra(EXTRA_RESUME_RESTART, false);
        boolean isColdRestart = getIntent().getBooleanExtra(EXTRA_COLD_RESTART, false);
        
        if (isResumeRestart) {
            Log.d(TAG, "✅ onCreate - SOFT RESTART (Loading ATLANACAK, kanallar canlanacak)");
            // JS tarafına "Soft restart" sinyalini gönder
            injectResumeFlag(false); // loading atla
        } else if (isColdRestart) {
            Log.d(TAG, "✅ onCreate - COLD RESTART (Loading GÖSTERİLECEK - 2dk+ arka planda)");
            // Normal cold start - loading gösterilecek (flag inject etme)
        } else {
            Log.d(TAG, "✅ onCreate - NORMAL (İLK) AÇILIŞ");
        }
        
        // Bir sonraki döngü için disk'i temizle
        clearPauseTime();
    }
    
    @Override
    public void onPause() {
        super.onPause();
        
        long now = System.currentTimeMillis();
        
        // Zamanı diske kaydet
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putLong(KEY_PAUSE_TIME, now).apply();
        
        Log.d(TAG, "📴 onPause - Zaman Diske Kaydedildi: " + now);
        
        // 🎵 MÜZİĞİ DURDUR - Arka plana giderken (hemen!)
        pauseMusicImmediately();
    }
    
    /**
     * 🎵 Arka plana giderken müziği ANINDA durdur
     * Event dispatch YERINE doğrudan tüm audio elementlerini durdurur
     * WebView suspend olmadan ÖNCE çalışması gerekiyor
     */
    private void pauseMusicImmediately() {
        Log.d(TAG, "🎵 pauseMusicImmediately() çağrıldı - Tüm audio'lar durduruluyor");
        
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                // 🔥 Event dispatch etmek yerine DOĞRUDAN tüm audio'ları durdur
                // Bu sayede JS çalışmasa bile audio'lar duracak
                getBridge().getWebView().evaluateJavascript(
                    "(function() {" +
                    "  try {" +
                    "    console.log('[Native] 🎵 Tüm audio elementleri durduruluyor...');" +
                    // Çalan audio'ları kaydet (foreground'da devam için)
                    "    window.__nativePausedAudios = [];" +
                    "    var audios = document.getElementsByTagName('audio');" +
                    "    for (var i = 0; i < audios.length; i++) {" +
                    "      if (!audios[i].paused) {" +
                    "        window.__nativePausedAudios.push({" +
                    "          element: audios[i]," +
                    "          currentTime: audios[i].currentTime," +
                    "          volume: audios[i].volume" +
                    "        });" +
                    "        audios[i].pause();" +
                    "        console.log('[Native] Audio durdu: ' + (audios[i].src || 'unknown'));" +
                    "      }" +
                    "    }" +
                    // Event da gönder (JS tarafı için)
                    "    window.dispatchEvent(new CustomEvent('app-background'));" +
                    "    console.log('[Native] ✅ ' + window.__nativePausedAudios.length + ' audio durduruldu');" +
                    "  } catch(e) {" +
                    "    console.error('[Native] Audio durdurma hatası:', e);" +
                    "  }" +
                    "})()",
                    null
                );
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Audio durdurma hatası: " + e.getMessage());
        }
    }
    
    @Override
    public void onResume() {
        super.onResume();
        hideSystemUI();
        
        // BU BİR RESTART MI? KONTROL ET
        boolean isResumeRestart = getIntent().getBooleanExtra(EXTRA_RESUME_RESTART, false);
        boolean isColdRestart = getIntent().getBooleanExtra(EXTRA_COLD_RESTART, false);
        
        if (isResumeRestart || isColdRestart) {
            Log.d(TAG, "📱 onResume - Restart sonrası ilk açılış. Kontrol atlanıyor.");
            
            // Bayrakları tüket
            getIntent().removeExtra(EXTRA_RESUME_RESTART);
            getIntent().removeExtra(EXTRA_COLD_RESTART);
            
            clearPauseTime();
            return;
        }
        
        // NORMAL RESUME: DİSKTEN ZAMANI OKU
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long lastPauseTime = prefs.getLong(KEY_PAUSE_TIME, 0);
        long now = System.currentTimeMillis();
        
        long backgroundDuration = (lastPauseTime > 0) ? (now - lastPauseTime) : 0;
        
        Log.d(TAG, "📱 onResume - Arka plan süresi: " + backgroundDuration + "ms");
        
        // KARAR ANI
        if (lastPauseTime > 0 && backgroundDuration >= MIN_BACKGROUND_TIME_MS) {
            if (backgroundDuration >= FULL_RESTART_THRESHOLD_MS) {
                // 🔥 2 DAKİKADAN FAZLA → COLD RESTART (loading gösterilir)
                Log.w(TAG, "🚨 2+ dakika arka planda! COLD RESTART yapılıyor (loading gösterilecek)");
                clearPauseTime();
                restartActivity(true); // cold restart - Activity tamamen yeniden başlar
            } else {
                // ✅ 2 DAKİKADAN AZ → SOFT RECOVERY (Activity restart YOK! Sadece JS recovery)
                Log.d(TAG, "✅ <2 dakika arka planda. SOFT RECOVERY yapılıyor (Activity restart YOK!)");
                clearPauseTime();
                performSoftRecovery(); // 🔥 Activity restart YAPMADAN sadece JS inject et
            }
        } else {
            Log.d(TAG, "✅ Süre yetersiz veya ilk açılış, sadece foreground event.");
            clearPauseTime();
            dispatchForegroundEvent(); // Müzik devam etsin
        }
    }
    
    private void clearPauseTime() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().remove(KEY_PAUSE_TIME).apply();
    }
    
    /**
     * 🔥 SOFT RECOVERY - Activity restart YAPMADAN sadece JS inject ederek recovery yapar.
     * Bu sayede kullanıcı hiçbir loading ekranı görmez, aynı sayfada kalır.
     */
    private void performSoftRecovery() {
        Log.d(TAG, "🔄 SOFT RECOVERY başlıyor (Activity restart YOK!)");
        
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().post(() -> {
                    String js = "try { " +
                           // 🔥 Supabase token yenileme ve kanal reconnect
                           "console.log('[Native] 🔄 SOFT RECOVERY - Token ve kanallar yenileniyor...'); " +
                           
                           // Session storage flag'leri (React tarafı bunları okur)
                           "sessionStorage.setItem('soft-recovery', 'true'); " +
                           "sessionStorage.setItem('force-reconnect', 'true'); " +
                           
                           // Foreground event - müzik devam etsin
                           "window.dispatchEvent(new CustomEvent('app-foreground')); " +
                           
                           // Supabase recovery event
                           "window.dispatchEvent(new CustomEvent('native-soft-recovery')); " +
                           
                           // Realtime reconnect trigger
                           "if (window.__supabaseClient) { " +
                           "  window.__supabaseClient.realtime.disconnect(); " +
                           "  setTimeout(function() { window.__supabaseClient.realtime.connect(); }, 100); " +
                           "} " +
                           
                           "console.log('[Native] ✅ SOFT RECOVERY tamamlandı - Kullanıcı aynı sayfada!'); " +
                           "} catch(e) { console.error('[Native] Soft recovery error:', e); }";
                    
                    getBridge().getWebView().evaluateJavascript(js, null);
                    Log.d(TAG, "✅ Soft recovery JS inject edildi");
                });
            } else {
                Log.w(TAG, "⚠️ WebView null, soft recovery yapılamadı");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Soft recovery hatası: " + e.getMessage());
        }
    }
    
    /**
     * 🎵 Ön plana geldiğinde müziği devam ettir
     * Kaydedilen audio'ları kaldığı yerden başlatır
     */
    private void dispatchForegroundEvent() {
        Log.d(TAG, "🎵 dispatchForegroundEvent() çağrıldı - Audio'lar devam ettiriliyor");
        
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    "(function() {" +
                    "  try {" +
                    "    console.log('[Native] 🎵 Kaydedilen audio\\'lar devam ettiriliyor...');" +
                    // Kaydedilen audio'ları devam ettir
                    "    if (window.__nativePausedAudios && window.__nativePausedAudios.length > 0) {" +
                    "      for (var i = 0; i < window.__nativePausedAudios.length; i++) {" +
                    "        var item = window.__nativePausedAudios[i];" +
                    "        if (item.element) {" +
                    "          item.element.volume = item.volume;" +
                    "          item.element.play().catch(function(e) {" +
                    "            console.warn('[Native] Audio resume hatası:', e);" +
                    "          });" +
                    "          console.log('[Native] Audio devam: ' + (item.element.src || 'unknown'));" +
                    "        }" +
                    "      }" +
                    "      console.log('[Native] ✅ ' + window.__nativePausedAudios.length + ' audio devam ettirildi');" +
                    "      window.__nativePausedAudios = [];" +
                    "    }" +
                    // Event da gönder
                    "    window.dispatchEvent(new CustomEvent('app-foreground'));" +
                    "  } catch(e) {" +
                    "    console.error('[Native] Audio resume hatası:', e);" +
                    "  }" +
                    "})()",
                    null
                );
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Audio resume hatası: " + e.getMessage());
        }
    }
    
    /**
     * Activity'yi yeniden başlatır.
     * @param isColdRestart true = loading gösterilir, false = loading atlanır
     */
    private void restartActivity(boolean isColdRestart) {
        try {
            Log.d(TAG, "🔄 ACTIVITY RESTART - " + (isColdRestart ? "COLD" : "SOFT"));
            
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            
            if (isColdRestart) {
                intent.putExtra(EXTRA_COLD_RESTART, true);
            } else {
                intent.putExtra(EXTRA_RESUME_RESTART, true);
            }
            
            startActivity(intent);
            finish();
            
            overridePendingTransition(0, 0);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Restart Hatası", e);
        }
    }

    /**
     * WebView'a JS kodu enjekte eder.
     * Soft restart için WebView'ın hazır olmasını bekler.
     * @param showLoading true = loading gösterilsin, false = loading atlansin
     */
    private void injectResumeFlag(boolean showLoading) {
        if (showLoading) {
            Log.d(TAG, "📱 Cold restart - JS injection atlanıyor");
            return;
        }
        
        Log.d(TAG, "📱 Soft restart - WebView bekleniyor...");
        
        final int MAX_RETRIES = 30; // 30 x 100ms = 3 saniye max
        final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());
        
        final Runnable[] retryRunnable = new Runnable[1];
        final int[] retryCount = {0};
        
        retryRunnable[0] = () -> {
            retryCount[0]++;
            
            try {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(() -> {
                        // 🔥 ÇOK ÖNEMLİ: Önce loading ekranını gizle, sonra flagleri set et
                        String js = "try { " +
                               // Loading ekranını anında gizle
                               "var loadingScreen = document.getElementById('initial-loading'); " +
                               "if (loadingScreen) { loadingScreen.style.display = 'none'; } " +
                               
                               // Session storage flagleri
                               "sessionStorage.setItem('app-resume-restart', 'true'); " +
                               "sessionStorage.setItem('app-loaded', 'true'); " +
                               "sessionStorage.setItem('skip-loading-screen', 'true'); " +
                               
                               // CSS ile zorla gizle
                               "var style = document.createElement('style'); " +
                               "style.textContent = '#initial-loading { display: none !important; }'; " +
                               "document.head.appendChild(style); " +
                               
                               // Event dispatch
                               "window.dispatchEvent(new CustomEvent('native-resume-ready')); " +
                               "window.dispatchEvent(new CustomEvent('app-foreground')); " +
                               
                               "console.log('[Native] ✅ Soft restart - loading GIZLENDI, flagler SET edildi (retry=" + retryCount[0] + ")'); " +
                               "} catch(e) { console.error('[Native] Flag set error:', e); }";
                        
                        getBridge().getWebView().evaluateJavascript(js, null);
                        Log.d(TAG, "✅ Resume flag inject edildi (retry=" + retryCount[0] + ")");
                    });
                } else if (retryCount[0] < MAX_RETRIES) {
                    Log.d(TAG, "⏳ WebView henüz hazır değil, retry " + retryCount[0] + "/" + MAX_RETRIES);
                    handler.postDelayed(retryRunnable[0], 100);
                } else {
                    Log.e(TAG, "❌ WebView " + MAX_RETRIES + " denemede hazır olmadı!");
                }
            } catch (Exception e) {
                Log.e(TAG, "❌ Resume flag inject hatası: " + e.getMessage(), e);
                if (retryCount[0] < MAX_RETRIES) {
                    handler.postDelayed(retryRunnable[0], 100);
                }
            }
        };
        
        // İlk denemeyi 50ms sonra başlat
        handler.postDelayed(retryRunnable[0], 50);
    }
    
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }
    
    private void hideSystemUI() {
        View decorView = getWindow().getDecorView();

        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), decorView);
        insetsController.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        insetsController.hide(WindowInsetsCompat.Type.systemBars());

        // Eski bayraklar sadece Android 11 (API 30) altı cihazlarda gerekli.
        // API 30+ üzerinde WindowInsetsControllerCompat ile birlikte kullanmak
        // çubukların geçici gösterimi sırasında içeriğin yeniden boyutlanmasına
        // (esneme) yol açabiliyor.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }
        getWindow().setStatusBarColor(0xFF000000);
        getWindow().setNavigationBarColor(0xFF000000);
    }
    
    private void checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) 
                != PackageManager.PERMISSION_GRANTED) {
                Log.w(TAG, "⚠️ Bildirim izni yok, isteniyor...");
                ActivityCompat.requestPermissions(
                    this, 
                    new String[]{Manifest.permission.POST_NOTIFICATIONS}, 
                    NOTIFICATION_PERMISSION_REQUEST_CODE
                );
            } else {
                Log.d(TAG, "✅ Bildirim izni mevcut");
            }
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "✅ Bildirim izni verildi!");
            } else {
                Log.w(TAG, "❌ Bildirim izni reddedildi");
            }
        }
    }
}
