package com.ergan.kelimele.plugins

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * 🔥 BACKGROUND WEBVIEW KEEP-ALIVE HACK
 * 
 * Bu sınıf, uygulama arka plana gittiğinde 1x1 piksellik görünmez bir WebView başlatır.
 * Bu sayede JavaScript execution duraklamaz ve veriler kaybolmaz!
 * 
 * Nasıl çalışır:
 * 1. Uygulama arka plana gider → startKeepAlive() çağrılır
 * 2. 1x1 boyutunda overlay WebView oluşturulur (kullanıcı göremez)
 * 3. WebView içinde basit bir JavaScript timer çalışır
 * 4. Bu, Android'in WebView process'ini canlı tutar
 * 5. Uygulama ön plana gelir → stopKeepAlive() çağrılır
 * 6. Overlay WebView kapatılır
 * 
 * NOT: Bu hack, SYSTEM_ALERT_WINDOW izni gerektirir (Settings.canDrawOverlays)
 * Ancak Foreground Service içinde çalıştığı için genellikle sorunsuz çalışır.
 */
class BackgroundWebViewKeepAlive(private val context: Context) {

    companion object {
        private const val TAG = "BGWebViewKeepAlive"
        private const val HEARTBEAT_INTERVAL_MS = 5000L // 5 saniyede bir
    }

    private var windowManager: WindowManager? = null
    private var keepAliveWebView: WebView? = null
    private var isActive = false
    private val handler = Handler(Looper.getMainLooper())

    // JS tarafına gönderilecek callback
    private var onKeepAliveCallback: (() -> Unit)? = null

    /**
     * Keep-alive callback ayarla (opsiyonel)
     * WebView her heartbeat gönderdiğinde çağrılır
     */
    fun setKeepAliveCallback(callback: () -> Unit) {
        onKeepAliveCallback = callback
    }

    /**
     * 🚀 Arka plan WebView'ını başlat
     * Uygulama arka plana geçtiğinde çağrılmalı
     */
    @SuppressLint("SetJavaScriptEnabled")
    fun startKeepAlive() {
        if (isActive) {
            Log.d(TAG, "⚠️ Keep-alive zaten aktif")
            return
        }

        handler.post {
            try {
                Log.d(TAG, "🚀 Background WebView Keep-Alive başlatılıyor...")

                // WindowManager al
                windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

                // 1x1 boyutunda görünmez WebView oluştur
                keepAliveWebView = WebView(context).apply {
                    // JavaScript'i etkinleştir
                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        databaseEnabled = true
                        cacheMode = WebSettings.LOAD_NO_CACHE
                        
                        // Performans optimizasyonları
                        setRenderPriority(WebSettings.RenderPriority.HIGH)
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            safeBrowsingEnabled = false
                        }
                    }

                    // JS interface ekle (opsiyonel debug için)
                    addJavascriptInterface(KeepAliveJsInterface(), "KeepAlive")

                    // WebViewClient ayarla
                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            Log.d(TAG, "✅ Keep-alive page yüklendi")
                        }
                    }

                    // Basit bir keep-alive HTML yükle
                    loadDataWithBaseURL(
                        null,
                        createKeepAliveHtml(),
                        "text/html",
                        "UTF-8",
                        null
                    )
                }

                // Overlay parametreleri - 1x1 piksel, görünmez
                val layoutParams = WindowManager.LayoutParams().apply {
                    width = 1
                    height = 1
                    
                    // Overlay tipi (Android versiyonuna göre)
                    type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    } else {
                        @Suppress("DEPRECATION")
                        WindowManager.LayoutParams.TYPE_SYSTEM_ALERT
                    }
                    
                    // Görünmez ve dokunulamaz
                    flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                    
                    format = PixelFormat.TRANSLUCENT
                    gravity = Gravity.TOP or Gravity.START
                    x = 0
                    y = 0
                    
                    // Tamamen şeffaf
                    alpha = 0f
                }

                // WebView'ı overlay olarak ekle
                windowManager?.addView(keepAliveWebView, layoutParams)
                
                isActive = true
                Log.d(TAG, "✅ Background WebView Keep-Alive AKTİF!")

            } catch (e: Exception) {
                Log.e(TAG, "❌ Keep-alive başlatma hatası: ${e.message}", e)
                isActive = false
            }
        }
    }

    /**
     * 🛑 Arka plan WebView'ını durdur
     * Uygulama ön plana geldiğinde çağrılmalı
     */
    fun stopKeepAlive() {
        if (!isActive) {
            Log.d(TAG, "⚠️ Keep-alive zaten kapalı")
            return
        }

        handler.post {
            try {
                Log.d(TAG, "🛑 Background WebView Keep-Alive durduruluyor...")

                keepAliveWebView?.let { webView ->
                    // JavaScript'i durdur
                    webView.loadUrl("javascript:stopHeartbeat();")
                    
                    // WebView'ı kaldır
                    try {
                        windowManager?.removeView(webView)
                    } catch (e: Exception) {
                        Log.w(TAG, "⚠️ WebView remove hatası: ${e.message}")
                    }
                    
                    // Kaynakları temizle
                    webView.stopLoading()
                    webView.destroy()
                }

                keepAliveWebView = null
                windowManager = null
                isActive = false

                Log.d(TAG, "✅ Background WebView Keep-Alive DURDURULDU!")

            } catch (e: Exception) {
                Log.e(TAG, "❌ Keep-alive durdurma hatası: ${e.message}", e)
            }
        }
    }

    /**
     * Keep-alive durumunu kontrol et
     */
    fun isKeepAliveActive(): Boolean = isActive

    /**
     * Keep-alive HTML içeriği oluştur
     * Bu basit JavaScript sürekli çalışarak WebView process'ini canlı tutar
     */
    private fun createKeepAliveHtml(): String {
        return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Keep Alive</title>
                <style>
                    body { margin: 0; padding: 0; background: transparent; }
                </style>
            </head>
            <body>
                <script>
                    var heartbeatCount = 0;
                    var heartbeatInterval = null;
                    
                    function startHeartbeat() {
                        if (heartbeatInterval) return;
                        
                        heartbeatInterval = setInterval(function() {
                            heartbeatCount++;
                            
                            // Native tarafı bilgilendir
                            if (typeof KeepAlive !== 'undefined') {
                                KeepAlive.onHeartbeat(heartbeatCount);
                            }
                            
                            // Hafıza temizliği
                            if (heartbeatCount % 10 === 0) {
                                console.log('[KeepAlive] Heartbeat: ' + heartbeatCount);
                            }
                        }, ${HEARTBEAT_INTERVAL_MS});
                        
                        console.log('[KeepAlive] Started');
                    }
                    
                    function stopHeartbeat() {
                        if (heartbeatInterval) {
                            clearInterval(heartbeatInterval);
                            heartbeatInterval = null;
                            console.log('[KeepAlive] Stopped after ' + heartbeatCount + ' heartbeats');
                        }
                    }
                    
                    // Sayfa yüklenince başlat
                    document.addEventListener('DOMContentLoaded', startHeartbeat);
                    
                    // Yedek: Hemen başlat
                    if (document.readyState === 'complete' || document.readyState === 'interactive') {
                        startHeartbeat();
                    }
                </script>
            </body>
            </html>
        """.trimIndent()
    }

    /**
     * JavaScript Interface - Native callback için
     */
    inner class KeepAliveJsInterface {
        @JavascriptInterface
        fun onHeartbeat(count: Int) {
            Log.d(TAG, "💓 KeepAlive Heartbeat: $count")
            onKeepAliveCallback?.invoke()
        }
    }

    /**
     * Kaynakları temizle
     */
    fun destroy() {
        stopKeepAlive()
    }
}
