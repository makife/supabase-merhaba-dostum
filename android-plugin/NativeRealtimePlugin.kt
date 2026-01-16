package com.ergan.kelimele.plugins

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Native Realtime Plugin - Basitleştirilmiş Versiyon
 * 
 * Supabase Realtime bağlantısını native Kotlin tarafında yönetir.
 * WebView'den bağımsız çalışır, arka planda bile bağlantı kopmaz.
 * 
 * NOT: Message Queue ve WebView Keep-Alive kaldırıldı.
 * Yeni sistem: Silent Push Notification ile arka planda canlı tutma.
 */
@CapacitorPlugin(name = "NativeRealtime")
class NativeRealtimePlugin : Plugin() {

    companion object {
        private const val TAG = "NativeRealtimePlugin"
    }

    private var realtimeService: RealtimeWebSocketService? = null
    private var isBound = false

    // Service bağlantısı
    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as RealtimeWebSocketService.LocalBinder
            realtimeService = binder.getService()
            isBound = true
            
            // Service'den gelen mesajları JS'e ilet
            realtimeService?.setMessageCallback { topic, event, payload ->
                val data = JSObject().apply {
                    put("topic", topic)
                    put("event", event)
                    put("payload", payload)
                }
                notifyListeners("realtimeMessage", data)
            }
            
            // Bağlantı durumu değişikliklerini ilet
            realtimeService?.setConnectionCallback { state, reason ->
                val data = JSObject().apply {
                    put("state", state)
                    put("reason", reason ?: "")
                }
                notifyListeners("connectionState", data)
            }
            
            Log.d(TAG, "✅ Service bağlandı")
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            realtimeService = null
            isBound = false
            Log.d(TAG, "⚠️ Service bağlantısı kesildi")
        }
    }

    override fun load() {
        super.load()
        Log.d(TAG, "🚀 NativeRealtimePlugin yüklendi")
    }

    /**
     * WebSocket bağlantısını başlat
     */
    @PluginMethod
    fun connect(call: PluginCall) {
        val url = call.getString("url") ?: run {
            call.reject("URL gerekli")
            return
        }
        val apiKey = call.getString("apiKey") ?: run {
            call.reject("API Key gerekli")
            return
        }
        val accessToken = call.getString("accessToken")

        Log.d(TAG, "🔌 Bağlantı başlatılıyor: $url")

        try {
            // Service'i başlat
            val intent = Intent(context, RealtimeWebSocketService::class.java).apply {
                putExtra("url", url)
                putExtra("apiKey", apiKey)
                putExtra("accessToken", accessToken ?: "")
            }
            
            // Foreground service olarak başlat
            context.startForegroundService(intent)
            
            // Service'e bind ol
            context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)

            call.resolve(JSObject().apply {
                put("success", true)
                put("message", "Bağlantı başlatıldı")
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ Bağlantı hatası", e)
            call.reject("Bağlantı hatası: ${e.message}")
        }
    }

    /**
     * Bağlantıyı kapat
     */
    @PluginMethod
    fun disconnect(call: PluginCall) {
        Log.d(TAG, "🔌 Bağlantı kapatılıyor...")

        try {
            if (isBound) {
                context.unbindService(serviceConnection)
                isBound = false
            }
            
            val intent = Intent(context, RealtimeWebSocketService::class.java)
            context.stopService(intent)
            realtimeService = null

            call.resolve(JSObject().apply {
                put("success", true)
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ Disconnect hatası", e)
            call.reject("Disconnect hatası: ${e.message}")
        }
    }

    /**
     * Kanala subscribe ol
     */
    @PluginMethod
    fun subscribe(call: PluginCall) {
        val topic = call.getString("topic") ?: run {
            call.reject("Topic gerekli")
            return
        }
        val event = call.getString("event") ?: "postgres_changes"
        val schema = call.getString("schema") ?: "public"
        val table = call.getString("table") ?: "*"
        val filter = call.getString("filter")

        Log.d(TAG, "📢 Subscribe: $topic / $event")

        if (realtimeService == null) {
            call.reject("Service bağlı değil, önce connect() çağırın")
            return
        }

        try {
            realtimeService?.subscribe(topic, event, schema, table, filter)
            call.resolve(JSObject().apply {
                put("success", true)
                put("topic", topic)
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ Subscribe hatası", e)
            call.reject("Subscribe hatası: ${e.message}")
        }
    }

    /**
     * Kanaldan unsubscribe ol
     */
    @PluginMethod
    fun unsubscribe(call: PluginCall) {
        val topic = call.getString("topic") ?: run {
            call.reject("Topic gerekli")
            return
        }

        Log.d(TAG, "📴 Unsubscribe: $topic")

        try {
            realtimeService?.unsubscribe(topic)
            call.resolve(JSObject().apply {
                put("success", true)
            })
        } catch (e: Exception) {
            call.reject("Unsubscribe hatası: ${e.message}")
        }
    }

    /**
     * Broadcast mesaj gönder
     */
    @PluginMethod
    fun broadcast(call: PluginCall) {
        val topic = call.getString("topic") ?: run {
            call.reject("Topic gerekli")
            return
        }
        val event = call.getString("event") ?: run {
            call.reject("Event gerekli")
            return
        }
        val payload = call.getString("payload") ?: "{}"

        Log.d(TAG, "📤 Broadcast: $topic / $event")

        try {
            realtimeService?.broadcast(topic, event, payload)
            call.resolve(JSObject().apply {
                put("success", true)
            })
        } catch (e: Exception) {
            call.reject("Broadcast hatası: ${e.message}")
        }
    }

    /**
     * Bağlantı durumunu kontrol et
     */
    @PluginMethod
    fun getConnectionState(call: PluginCall) {
        val state = realtimeService?.getConnectionState() ?: "disconnected"
        call.resolve(JSObject().apply {
            put("state", state)
            put("isConnected", state == "connected")
        })
    }

    /**
     * Access token güncelle (oturum yenilendiğinde)
     */
    @PluginMethod
    fun setAccessToken(call: PluginCall) {
        val token = call.getString("token") ?: run {
            call.reject("Token gerekli")
            return
        }

        Log.d(TAG, "🔑 Token güncelleniyor...")

        try {
            realtimeService?.setAccessToken(token)
            call.resolve(JSObject().apply {
                put("success", true)
            })
        } catch (e: Exception) {
            call.reject("Token güncelleme hatası: ${e.message}")
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        if (isBound) {
            context.unbindService(serviceConnection)
            isBound = false
        }
    }
}
