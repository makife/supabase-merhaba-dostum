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
    private static final long FULL_RESTART_THRESHOLD_MS = 120000; // 2 dakika
    
    // Minimum arka plan süresi (her dönüşte restart için)
    private static final long MIN_BACKGROUND_TIME_MS = 500; // 0.5 saniye

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
                restartActivity(true); // cold restart
            } else {
                // ✅ 2 DAKİKADAN AZ → SOFT RESTART (loading atlanır, kanallar canlanır)
                Log.d(TAG, "✅ <2 dakika arka planda. SOFT RESTART yapılıyor (loading atlanacak)");
                clearPauseTime();
                restartActivity(false); // soft restart
            }
        } else {
            Log.d(TAG, "✅ Süre yetersiz veya ilk açılış, restart yok.");
            clearPauseTime();
        }
    }
    
    private void clearPauseTime() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().remove(KEY_PAUSE_TIME).apply();
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
     * @param showLoading true = loading gösterilsin, false = loading atlansin
     */
    private void injectResumeFlag(boolean showLoading) {
        try {
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(() -> {
                        String js;
                        if (showLoading) {
                            // Cold restart - normal cold start gibi davran
                            js = "try { " +
                                   "console.log('[Native] ✅ Cold restart - loading gösterilecek'); " +
                                   "} catch(e) { console.error('[Native] Flag set error:', e); }";
                        } else {
                            // Soft restart - loading atla, kanalları canlandır
                            js = "try { " +
                                   "sessionStorage.setItem('app-resume-restart', 'true'); " +
                                   "sessionStorage.setItem('app-loaded', 'true'); " +
                                   "console.log('[Native] ✅ Soft restart - loading atlanacak'); " +
                                   "window.dispatchEvent(new CustomEvent('native-resume-ready')); " +
                                   "} catch(e) { console.error('[Native] Flag set error:', e); }";
                        }
                        
                        getBridge().getWebView().evaluateJavascript(js, null);
                        Log.d(TAG, "✅ Resume flag JS'e inject edildi (showLoading=" + showLoading + ")");
                    });
                } else {
                    Log.w(TAG, "⚠️ Bridge veya WebView null, fallback deneniyor...");
                    
                    // Fallback
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                        if (getBridge() != null && getBridge().getWebView() != null) {
                            String js = showLoading ? 
                                "console.log('[Native] Cold restart fallback');" :
                                "try { " +
                                   "sessionStorage.setItem('app-resume-restart', 'true'); " +
                                   "sessionStorage.setItem('app-loaded', 'true'); " +
                                   "console.log('[Native] ✅ Soft restart fallback'); " +
                                   "window.dispatchEvent(new CustomEvent('native-resume-ready')); " +
                                   "} catch(e) {}";
                            
                            getBridge().getWebView().evaluateJavascript(js, null);
                        }
                    }, 200);
                }
            }, 50);
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