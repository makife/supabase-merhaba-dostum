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
import com.getcapacitor.BridgeActivity;

/**
 * 🚀 MainActivity - PROCESS DEATH PROOF RESTART
 * 
 * Bu sürüm, "pauseTime" verisini RAM yerine DİSKE (SharedPreferences) kaydeder.
 * Böylece Android uygulamayı arka planda öldürse bile (Vivo/Samsung vb.),
 * uygulama geri döndüğünde ne kadar süredir kapalı olduğunu hatırlar ve
 * gerekiyorsa kendini sıfırdan başlatır.
 */
public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1235;
    
    // Restart sonrası JS'e iletilecek bayrak
    private static final String EXTRA_RESUME_RESTART = "RESUME_RESTART";
    
    // 🔥 DİSK KAYIT AYARLARI
    private static final String PREFS_NAME = "AppRestartPrefs";
    private static final String KEY_PAUSE_TIME = "pause_time";
    
    // Kaç ms arkada kalırsa restart atılsın? (100ms = 0.1 saniye)
    // Çok düşük tutuyoruz ki her arka plan dönüşünde restart atsın
    private static final long MIN_BACKGROUND_TIME_MS = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUI();
        checkNotificationPermission();
        
        // Bu bir "Zorla Restart" açılışı mı kontrol et
        boolean isResumeRestart = getIntent().getBooleanExtra(EXTRA_RESUME_RESTART, false);
        
        if (isResumeRestart) {
            Log.d(TAG, "✅ onCreate - RESUME RESTART MODU (Loading atlanacak)");
            // JS tarafına "Ben restart oldum" sinyalini gönder
            injectResumeFlag();
        } else {
            Log.d(TAG, "✅ onCreate - NORMAL (SOĞUK) AÇILIŞ");
        }
        
        // Bir sonraki döngü için disk'i temizle
        clearPauseTime();
    }
    
    @Override
    public void onPause() {
        super.onPause();
        
        // Şu anki zamanı al
        long now = System.currentTimeMillis();
        
        // 🔥 RAM'e değil, DİSKE (SharedPreferences) kaydet.
        // Telefon RAM'i temizlese bile bu veri silinmez.
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putLong(KEY_PAUSE_TIME, now).apply();
        
        Log.d(TAG, "📴 onPause - Zaman Diske Kaydedildi: " + now);
    }
    
    @Override
    public void onResume() {
        super.onResume();
        hideSystemUI();
        
        // 1. BU BİR RESTART MI? KONTROL ET
        boolean isResumeRestart = getIntent().getBooleanExtra(EXTRA_RESUME_RESTART, false);
        
        if (isResumeRestart) {
            Log.d(TAG, "📱 onResume - Restart sonrası ilk açılış. Kontrol atlanıyor.");
            
            // 🔥 Bayrağı tüket - bir sonraki resume'da tekrar kontrol edilsin
            getIntent().removeExtra(EXTRA_RESUME_RESTART);
            
            // Disk'i temizle
            clearPauseTime();
            return;
        }
        
        // 2. NORMAL RESUME: DİSKTEN ZAMANI OKU
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long lastPauseTime = prefs.getLong(KEY_PAUSE_TIME, 0);
        long now = System.currentTimeMillis();
        
        // Geçen süreyi hesapla (Eğer lastPauseTime 0 ise sonuç 0 olur)
        long backgroundDuration = (lastPauseTime > 0) ? (now - lastPauseTime) : 0;
        
        Log.d(TAG, "📱 onResume - Disk Zamanı: " + lastPauseTime + " | Geçen Süre: " + backgroundDuration + "ms");
        
        // 3. KARAR ANI: EŞİK DEĞER GEÇİLDİ Mİ?
        if (lastPauseTime > 0 && backgroundDuration >= MIN_BACKGROUND_TIME_MS) {
            Log.w(TAG, "🚨 KRİTİK: Uygulama " + backgroundDuration + "ms ölü kaldı. RESTART ATILIYOR!");
            
            // Sonsuz döngü olmasın diye zamanı temizle
            clearPauseTime();
            
            // ATOM BOMBASI: Uygulamayı yeniden yarat
            restartActivity();
        } else {
            // Süre 3 saniyeden azsa veya uygulama ilk kez açılıyorsa (Cold Start)
            Log.d(TAG, "✅ Süre yetersiz veya ilk açılış, restart yok.");
            
            // Her ihtimale karşı zamanı temizle
            clearPauseTime();
        }
    }
    
    /**
     * Zamanı diskten siler.
     */
    private void clearPauseTime() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().remove(KEY_PAUSE_TIME).apply();
    }
    
    /**
     * 🔥 Activity'yi tamamen öldürüp sıfırdan başlatır.
     * Bu işlem yepyeni bir WebView oluşturur.
     */
    private void restartActivity() {
        try {
            Log.d(TAG, "🔄🔄🔄 ACTIVITY RESTART BAŞLIYOR 🔄🔄🔄");
            
            Intent intent = new Intent(this, MainActivity.class);
            // Geçmişi sil, yeni görev başlat
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            // Restart bayrağını ekle
            intent.putExtra(EXTRA_RESUME_RESTART, true);
            
            startActivity(intent);
            finish(); // Kendini öldür
            
            // Geçiş animasyonunu kaldır (Hız hissi için)
            overridePendingTransition(0, 0);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Restart Hatası", e);
        }
    }

    /**
     * 🔥 WebView'a JS kodu enjekte eder.
     * React tarafı bu sessionStorage değerini okuyup Splash'i atlar.
     * 
     * 🔥🔥 50ms delay - React yüklenmeden ÖNCE flag inject et
     */
    private void injectResumeFlag() {
        try {
            // 🔥 50ms delay - çok erken inject etmemek için (WebView hazır olmalı)
            // ama çok geç de inject etmemek için (React state hesaplanmadan önce)
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(() -> {
                        // 🔥 Flag set ET ve custom event DISPATCH et
                        String js = "try { " +
                                   "sessionStorage.setItem('app-resume-restart', 'true'); " +
                                   "sessionStorage.setItem('app-loaded', 'true'); " +
                                   "console.log('[Native] ✅ Resume restart flag set'); " +
                                   "window.dispatchEvent(new CustomEvent('native-resume-ready')); " +
                                   "} catch(e) { console.error('[Native] Flag set error:', e); }";
                        
                        getBridge().getWebView().evaluateJavascript(js, null);
                        Log.d(TAG, "✅ Resume flag JS'e inject edildi (50ms delay)");
                    });
                } else {
                    Log.w(TAG, "⚠️ Bridge veya WebView null, flag inject edilemedi");
                    
                    // 🔥 Fallback: 200ms sonra tekrar dene
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                        if (getBridge() != null && getBridge().getWebView() != null) {
                            String js = "try { " +
                                       "sessionStorage.setItem('app-resume-restart', 'true'); " +
                                       "sessionStorage.setItem('app-loaded', 'true'); " +
                                       "console.log('[Native] ✅ Resume restart flag set (fallback)'); " +
                                       "window.dispatchEvent(new CustomEvent('native-resume-ready')); " +
                                       "} catch(e) { console.error('[Native] Flag set error:', e); }";
                            
                            getBridge().getWebView().evaluateJavascript(js, null);
                            Log.d(TAG, "✅ Resume flag JS'e inject edildi (fallback 200ms)");
                        }
                    }, 200);
                }
            }, 50); // 🔥 50ms - React yüklenmeden önce flag inject et
        } catch (Exception e) {
            Log.e(TAG, "❌ Resume flag inject hatası: " + e.getMessage(), e);
        }
    }
    
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }
    
    /**
     * Tam ekran (Immersive) mod
     */
    private void hideSystemUI() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
        getWindow().setStatusBarColor(0xFF000000);
        getWindow().setNavigationBarColor(0xFF000000);
    }
    
    /**
     * Bildirim izni kontrolü (Android 13+)
     */
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
