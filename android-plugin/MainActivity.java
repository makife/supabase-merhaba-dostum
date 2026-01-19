package com.ergan.kelimele;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

/**
 * 🚀 MainActivity - Native Activity Restart on Resume
 * 
 * Arka plandan ön plana dönüşte WebView'a sinyal göndererek
 * cold start reload tetikler. Bu sayede "ölü" WebView sorunu çözülür.
 * 
 * Akış:
 * 1. onPause → wasInBackground = true
 * 2. onResume → WebView'a 'native-force-reload' event gönder
 * 3. JS tarafı bu event'i alınca _resume=1 ile reload yapar
 * 4. Loading ekranı (ergan.jpg) ATLANIR
 */
public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 1235;
    
    // 🔥 Arka plan flag'i
    private boolean wasInBackground = false;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUI();
        
        // 🔔 Bildirim izni (silent push için gerekli)
        checkNotificationPermission();
        
        Log.d(TAG, "✅ MainActivity onCreate - Cold Start");
    }
    
    @Override
    protected void onPause() {
        super.onPause();
        wasInBackground = true;
        Log.d(TAG, "📴 onPause - Arka plana gidiliyor");
    }
    
    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUI();
        
        if (wasInBackground) {
            wasInBackground = false;
            Log.d(TAG, "📱 onResume - Arka plandan dönülüyor, JS'e sinyal gönderiliyor...");
            
            // 🔥 WebView hazır olana kadar kısa bekle, sonra JS'e sinyal gönder
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                triggerJSReload();
            }, 100); // 100ms - WebView'in uyanması için
        } else {
            Log.d(TAG, "📱 onResume - Normal (arka plandan değil)");
        }
    }
    
    /**
     * 🔥 WebView'a JavaScript inject ederek reload tetikler
     * Bu native taraftan gelen güvenilir bir sinyal
     */
    private void triggerJSReload() {
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().post(() -> {
                    String js = "window.dispatchEvent(new CustomEvent('native-force-reload', { detail: { source: 'android' } }));";
                    getBridge().getWebView().evaluateJavascript(js, (result) -> {
                        Log.d(TAG, "✅ JS'e native-force-reload sinyali gönderildi");
                    });
                });
            } else {
                Log.w(TAG, "⚠️ Bridge veya WebView null - sinyal gönderilemedi");
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ JS inject hatası: " + e.getMessage());
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
