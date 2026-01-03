package com.example.kelimeci.plugins

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import okhttp3.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * Realtime WebSocket Service
 * 
 * Foreground Service olarak çalışır, arka planda bile WebSocket bağlantısını canlı tutar.
 * Supabase Realtime (Phoenix Channels) protokolünü native olarak implement eder.
 */
class RealtimeWebSocketService : Service() {

    companion object {
        private const val TAG = "RealtimeWSService"
        private const val NOTIFICATION_CHANNEL_ID = "realtime_connection"
        private const val NOTIFICATION_ID = 1001
        private const val HEARTBEAT_INTERVAL_MS = 25000L // 25 saniye
        private const val RECONNECT_BASE_DELAY_MS = 1000L
        private const val RECONNECT_MAX_DELAY_MS = 30000L
    }

    // Binder
    private val binder = LocalBinder()

    inner class LocalBinder : Binder() {
        fun getService(): RealtimeWebSocketService = this@RealtimeWebSocketService
    }

    // OkHttp
    private lateinit var okHttpClient: OkHttpClient
    private var webSocket: WebSocket? = null

    // Bağlantı bilgileri
    private var wsUrl: String = ""
    private var apiKey: String = ""
    private var accessToken: String = ""

    // Durum
    private var connectionState: String = "disconnected"
    private val subscriptions = ConcurrentHashMap<String, ChannelSubscription>()
    private val messageRef = AtomicInteger(0)
    private var reconnectAttempts = 0

    // Callbacks
    private var messageCallback: ((String, String, String) -> Unit)? = null
    private var connectionCallback: ((String, String?) -> Unit)? = null

    // Heartbeat
    private var heartbeatRunnable: Runnable? = null
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    // Wake Lock - CPU'yu uyutma
    private var wakeLock: PowerManager.WakeLock? = null

    data class ChannelSubscription(
        val topic: String,
        val event: String,
        val schema: String,
        val table: String,
        val filter: String?,
        var joinRef: String? = null,
        var isJoined: Boolean = false
    )

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "🚀 Service onCreate")
        
        createNotificationChannel()
        
        // OkHttp client oluştur
        okHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS) // WebSocket için sonsuz
            .writeTimeout(30, TimeUnit.SECONDS)
            .pingInterval(20, TimeUnit.SECONDS) // OkHttp ping
            .retryOnConnectionFailure(true)
            .build()

        // Wake Lock al - arka planda CPU'yu uyutma
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "Kelimeci:RealtimeWakeLock"
        )
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "🚀 Service onStartCommand")

        // Foreground notification başlat
        startForeground(NOTIFICATION_ID, createNotification("Bağlanıyor..."))

        // Bağlantı bilgilerini al
        intent?.let {
            wsUrl = it.getStringExtra("url") ?: ""
            apiKey = it.getStringExtra("apiKey") ?: ""
            accessToken = it.getStringExtra("accessToken") ?: ""
        }

        if (wsUrl.isNotEmpty() && apiKey.isNotEmpty()) {
            connect()
        }

        // Service öldürülürse yeniden başlat
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder {
        return binder
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "💀 Service onDestroy")
        
        stopHeartbeat()
        disconnect()
        
        wakeLock?.let {
            if (it.isHeld) it.release()
        }
    }

    // ================= PUBLIC METHODS =================

    fun setMessageCallback(callback: (String, String, String) -> Unit) {
        messageCallback = callback
    }

    fun setConnectionCallback(callback: (String, String?) -> Unit) {
        connectionCallback = callback
    }

    fun getConnectionState(): String = connectionState

    fun setAccessToken(token: String) {
        accessToken = token
        // Tüm kanallara yeni token ile yeniden join
        if (connectionState == "connected") {
            subscriptions.values.forEach { sub ->
                sendJoinMessage(sub)
            }
        }
    }

    fun subscribe(topic: String, event: String, schema: String, table: String, filter: String?) {
        val subscription = ChannelSubscription(topic, event, schema, table, filter)
        subscriptions[topic] = subscription

        if (connectionState == "connected") {
            sendJoinMessage(subscription)
        }
    }

    fun unsubscribe(topic: String) {
        subscriptions[topic]?.let { sub ->
            if (sub.isJoined) {
                sendLeaveMessage(sub)
            }
            subscriptions.remove(topic)
        }
    }

    fun broadcast(topic: String, event: String, payload: String) {
        if (connectionState != "connected") {
            Log.w(TAG, "⚠️ Bağlı değil, broadcast yapılamıyor")
            return
        }

        val sub = subscriptions[topic]
        val message = JSONArray().apply {
            put(sub?.joinRef ?: JSONObject.NULL)
            put(getNextRef())
            put(topic)
            put(event)
            put(JSONObject(payload))
        }

        webSocket?.send(message.toString())
    }

    // ================= PRIVATE METHODS =================

    private fun connect() {
        if (webSocket != null) {
            Log.d(TAG, "⚠️ Zaten bağlı")
            return
        }

        // Wake lock al
        wakeLock?.acquire(10 * 60 * 1000L) // 10 dakika

        updateConnectionState("connecting", null)
        updateNotification("Bağlanıyor...")

        // URL'e parametreleri ekle
        val fullUrl = buildString {
            append(wsUrl)
            append(if (wsUrl.contains("?")) "&" else "?")
            append("apikey=$apiKey")
            append("&vsn=1.0.0")
        }

        Log.d(TAG, "🔌 WebSocket bağlanıyor: $fullUrl")

        val request = Request.Builder()
            .url(fullUrl)
            .addHeader("X-Client-Info", "native-kotlin")
            .build()

        webSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d(TAG, "✅ WebSocket AÇILDI")
                
                updateConnectionState("connected", null)
                updateNotification("Bağlı")
                reconnectAttempts = 0

                // Heartbeat başlat
                startHeartbeat()

                // Tüm kanallara join
                subscriptions.values.forEach { sub ->
                    sendJoinMessage(sub)
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                handleMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "⚠️ WebSocket kapanıyor: $code - $reason")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "🔴 WebSocket KAPANDI: $code - $reason")
                handleDisconnect(reason)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "❌ WebSocket HATA: ${t.message}", t)
                handleDisconnect(t.message ?: "Bilinmeyen hata")
            }
        })
    }

    private fun handleMessage(text: String) {
        try {
            val message = JSONArray(text)
            
            val joinRef = if (!message.isNull(0)) message.getString(0) else null
            val ref = if (!message.isNull(1)) message.getString(1) else null
            val topic = message.getString(2)
            val event = message.getString(3)
            val payload = message.getJSONObject(4)

            Log.d(TAG, "📩 Mesaj: $topic / $event")

            when (event) {
                "phx_reply" -> handlePhxReply(topic, payload, ref)
                "phx_error" -> handlePhxError(topic, payload)
                "phx_close" -> handlePhxClose(topic)
                "postgres_changes" -> handlePostgresChanges(topic, payload)
                "broadcast" -> handleBroadcast(topic, payload)
                "presence_state" -> handlePresence(topic, "state", payload)
                "presence_diff" -> handlePresence(topic, "diff", payload)
                else -> {
                    // Diğer eventler - JS'e ilet
                    messageCallback?.invoke(topic, event, payload.toString())
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Mesaj parse hatası: ${e.message}", e)
        }
    }

    private fun handlePhxReply(topic: String, payload: JSONObject, ref: String?) {
        val status = payload.optString("status", "error")
        
        if (status == "ok") {
            subscriptions[topic]?.let { sub ->
                sub.isJoined = true
                Log.d(TAG, "✅ Kanal join başarılı: $topic")
            }
        } else {
            Log.e(TAG, "❌ Kanal join hatası: $topic - ${payload.optString("response")}")
        }
    }

    private fun handlePhxError(topic: String, payload: JSONObject) {
        Log.e(TAG, "❌ Phoenix error: $topic - $payload")
        subscriptions[topic]?.isJoined = false
    }

    private fun handlePhxClose(topic: String) {
        Log.d(TAG, "📴 Kanal kapandı: $topic")
        subscriptions[topic]?.isJoined = false
    }

    private fun handlePostgresChanges(topic: String, payload: JSONObject) {
        Log.d(TAG, "🗃️ Postgres değişiklik: $topic")
        messageCallback?.invoke(topic, "postgres_changes", payload.toString())
    }

    private fun handleBroadcast(topic: String, payload: JSONObject) {
        Log.d(TAG, "📢 Broadcast: $topic")
        messageCallback?.invoke(topic, "broadcast", payload.toString())
    }

    private fun handlePresence(topic: String, type: String, payload: JSONObject) {
        Log.d(TAG, "👥 Presence $type: $topic")
        messageCallback?.invoke(topic, "presence_$type", payload.toString())
    }

    private fun sendJoinMessage(subscription: ChannelSubscription) {
        val ref = getNextRef()
        subscription.joinRef = ref

        val config = JSONObject().apply {
            put("broadcast", JSONObject().apply {
                put("self", true)
            })
            put("presence", JSONObject().apply {
                put("key", "")
            })
            put("postgres_changes", JSONArray().apply {
                put(JSONObject().apply {
                    put("event", subscription.event)
                    put("schema", subscription.schema)
                    put("table", subscription.table)
                    subscription.filter?.let { put("filter", it) }
                })
            })
        }

        val payload = JSONObject().apply {
            put("config", config)
            if (accessToken.isNotEmpty()) {
                put("access_token", accessToken)
            }
        }

        val message = JSONArray().apply {
            put(ref)
            put(ref)
            put(subscription.topic)
            put("phx_join")
            put(payload)
        }

        Log.d(TAG, "📤 Join gönderiliyor: ${subscription.topic}")
        webSocket?.send(message.toString())
    }

    private fun sendLeaveMessage(subscription: ChannelSubscription) {
        val message = JSONArray().apply {
            put(subscription.joinRef)
            put(getNextRef())
            put(subscription.topic)
            put("phx_leave")
            put(JSONObject())
        }

        webSocket?.send(message.toString())
    }

    private fun startHeartbeat() {
        stopHeartbeat()

        heartbeatRunnable = object : Runnable {
            override fun run() {
                if (connectionState == "connected") {
                    sendHeartbeat()
                    handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
                }
            }
        }

        handler.postDelayed(heartbeatRunnable!!, HEARTBEAT_INTERVAL_MS)
    }

    private fun stopHeartbeat() {
        heartbeatRunnable?.let { handler.removeCallbacks(it) }
        heartbeatRunnable = null
    }

    private fun sendHeartbeat() {
        val message = JSONArray().apply {
            put(JSONObject.NULL)
            put(getNextRef())
            put("phoenix")
            put("heartbeat")
            put(JSONObject())
        }

        Log.d(TAG, "💓 Heartbeat gönderiliyor...")
        webSocket?.send(message.toString())
    }

    private fun handleDisconnect(reason: String) {
        webSocket = null
        stopHeartbeat()
        
        subscriptions.values.forEach { it.isJoined = false }
        
        updateConnectionState("disconnected", reason)
        updateNotification("Bağlantı kesildi")

        // Otomatik yeniden bağlan
        scheduleReconnect()
    }

    private fun scheduleReconnect() {
        reconnectAttempts++
        
        // Exponential backoff
        val delay = minOf(
            RECONNECT_BASE_DELAY_MS * (1L shl minOf(reconnectAttempts, 5)),
            RECONNECT_MAX_DELAY_MS
        )

        Log.d(TAG, "🔄 Yeniden bağlanma planlandı: ${delay}ms sonra (deneme: $reconnectAttempts)")
        updateNotification("Yeniden bağlanıyor... ($reconnectAttempts)")

        handler.postDelayed({
            if (connectionState == "disconnected") {
                connect()
            }
        }, delay)
    }

    private fun disconnect() {
        stopHeartbeat()
        webSocket?.close(1000, "Service kapatıldı")
        webSocket = null
        updateConnectionState("disconnected", "Service kapatıldı")
    }

    private fun getNextRef(): String {
        return messageRef.incrementAndGet().toString()
    }

    private fun updateConnectionState(state: String, reason: String?) {
        connectionState = state
        connectionCallback?.invoke(state, reason)
    }

    // ================= NOTIFICATION =================

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Oyun Bağlantısı",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Oyun sunucusuyla bağlantı durumu"
                setShowBadge(false)
            }
            
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(text: String): Notification {
        val pendingIntent = packageManager.getLaunchIntentForPackage(packageName)?.let {
            PendingIntent.getActivity(
                this, 0, it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("Kelimeci")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pendingIntent)
            .build()
    }

    private fun updateNotification(text: String) {
        val notification = createNotification(text)
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
}
