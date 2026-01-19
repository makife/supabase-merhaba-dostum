package com.ergan.kelimele;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

/**
 * 🚀 MainActivity - GERÇEK Activity Restart on Resume
 * 
 * Arka plandan ön plana dönüşte Activity'yi tamamen yeniden başlatır.
 * Bu sayede YENİ bir WebView oluşturulur ve "ölü" WebView sorunu çözülür.
 * 
 * Akış:
 * 1. onPause → wasInBackground = true
 * 2. onResume → finish() + startActivity() ile GERÇEK restart
 * 3. Yeni WebView = Tüm JS ve Supabase kanalları sıfırdan başlar
 * 4. Intent'e RESUME_RESTART flag eklenir → Loading ekranı atlanır
 */
public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1235;
    private static final String EXTRA_RESUME_RESTART = "RESUME_RESTART";
    
    // 🔥 Arka plan flag'i
    private boolean wasInBackground = false;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUI();
        
        // 🔔 Bildirim izni (silent push için gerekli)
        checkNotificationPermission();
        
        // 🔥 Resume restart'tan mı geliyoruz kontrol et
        boolean isResumeRestart = getIntent().getBooleanExtra(EXTRA_RESUME_RESTART, false);
        if (isResumeRestart) {
            Log.d(TAG, "✅ MainActivity onCreate - RESUME RESTART (Loading atlanacak)");
            // JS tarafına sinyal gönder - loading atlanacak
            injectResumeFlag();
        } else {
            Log.d(TAG, "✅ MainActivity onCreate - Cold Start");
        }
    }
    
    @Override
    public void onPause() {
        super.onPause();
        wasInBackground = true;
        Log.d(TAG, "📴 onPause - Arka plana gidiliyor");
    }
    
    @Override
    public void onResume() {
        super.onResume();
        hideSystemUI();
        
        // 🔥 Eğer bu zaten bir resume restart ise, tekrar restart yapma
        boolean isResumeRestart = getIntent().getBooleanExtra(EXTRA_RESUME_RESTART, false);
        
        if (wasInBackground && !isResumeRestart) {
            wasInBackground = false;
            Log.d(TAG, "📱 onResume - Arka plandan dönülüyor, ACTIVITY RESTART yapılıyor...");
            
            // 🔥 GERÇEK Activity Restart - Yeni WebView oluşturulacak
            restartActivity();
        } else {
            wasInBackground = false;
            Log.d(TAG, "📱 onResume - Normal (restart değil veya zaten restart edilmiş)");
        }
    }
    
    /**
     * 🔥 Activity'yi tamamen yeniden başlatır
     * Bu YENİ bir WebView oluşturur - tüm JS sıfırdan yüklenir
     */
    private void restartActivity() {
        try {
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.putExtra(EXTRA_RESUME_RESTART, true); // Loading atlanacak flag
            
            Log.d(TAG, "🔄 Activity restart başlatılıyor...");
            finish();
            startActivity(intent);
            
            // Geçiş animasyonunu kaldır (daha hızlı görünsün)
            overridePendingTransition(0, 0);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Activity restart hatası: " + e.getMessage());
        }
    }
    
    /**
     * 🔥 WebView'a resume flag inject et - loading atlanacak
     */
    private void injectResumeFlag() {
        try {
            // WebView hazır olduktan sonra inject et
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().post(() -> {
                        String js = "sessionStorage.setItem('app-resume-restart', 'true'); " +
                                   "sessionStorage.setItem('app-loaded', 'true'); " +
                                   "console.log('[Native] Resume restart flag set');";
                        getBridge().getWebView().evaluateJavascript(js, null);
                        Log.d(TAG, "✅ Resume flag JS'e inject edildi");
                    });
                }
            }, 200); // WebView'in hazır olması için bekle
        } catch (Exception e) {
            Log.e(TAG, "❌ Resume flag inject hatası: " + e.getMessage());
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
