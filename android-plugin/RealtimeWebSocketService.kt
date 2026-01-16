package com.ergan.kelimele.plugins

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
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
 * Realtime WebSocket Service - Basitleştirilmiş Versiyon
 * 
 * Foreground Service olarak çalışır, arka planda bile WebSocket bağlantısını canlı tutar.
 * Supabase Realtime (Phoenix Channels) protokolünü native olarak implement eder.
 * 
 * NOT: WebView Keep-Alive ve Message Queue kaldırıldı.
 * Yeni sistem: Silent Push Notification ile arka planda canlı tutma.
 */
class RealtimeWebSocketService : Service() {

    companion object {
        private const val TAG = "RealtimeWSService"
        private const val NOTIFICATION_CHANNEL_ID = "realtime_connection"
        private const val NOTIFICATION_ID = 1001
        private const val HEARTBEAT_INTERVAL_MS = 30000L
        private const val HEARTBEAT_TIMEOUT_MS = 90000L
        private const val RECONNECT_BASE_DELAY_MS = 1000L
        private const val RECONNECT_MAX_DELAY_MS = 30000L
        private const val MIN_CONNECTED_TIME_MS = 10000L
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
    private var lastHeartbeatAck = System.currentTimeMillis()
    private var pendingHeartbeatRef: String? = null
    private var connectionStartTime = 0L
    private var consecutiveHeartbeatFailures = 0

    // Wake Lock
    private var wakeLock: PowerManager.WakeLock? = null

    // Network Listener
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    // Disconnect timer
    private var disconnectRunnable: Runnable? = null

    // 🆕 MESSAGE BUFFER - Arka plandayken mesajları biriktir
    private var isAppInForeground = true
    private val messageBuffer = mutableListOf<BufferedMessage>()
    private val MAX_BUFFER_SIZE = 100

    data class BufferedMessage(
        val topic: String,
        val event: String,
        val payload: String,
        val timestamp: Long = System.currentTimeMillis()
    )

    data class ChannelSubscription(
        val topic: String,
        val event: String,
        val schema: String = "public",
        val table: String = "*",
        val filter: String? = null,
        var isJoined: Boolean = false,
        var joinRef: String? = null
    )

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "🚀 Service onCreate")

        // OkHttp client
        okHttpClient = OkHttpClient.Builder()
            .pingInterval(25, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .connectTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()

        // Wake Lock
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "KelimEle::RealtimeWakeLock"
        )

        // Network listener
        registerNetworkListener()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "🚀 Service onStartCommand")

        // Foreground notification
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification("Bağlanıyor..."))

        // Bağlantı bilgilerini al
        intent?.let {
            wsUrl = it.getStringExtra("url") ?: wsUrl
            apiKey = it.getStringExtra("apiKey") ?: apiKey
            accessToken = it.getStringExtra("accessToken") ?: accessToken
        }

        // Bağlantıyı başlat
        if (wsUrl.isNotEmpty() && apiKey.isNotEmpty()) {
            connect()
        }

        return START_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "🔴 Service onDestroy")
        stopHeartbeat()
        disconnect()
        unregisterNetworkListener()
        
        try {
            wakeLock?.let {
                if (it.isHeld) {
                    it.release()
                    Log.d(TAG, "🔋 Wake lock bırakıldı")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Wake lock release hatası: ${e.message}")
        }
        super.onDestroy()
    }

    // ================= NETWORK LISTENER =================

    private fun registerNetworkListener() {
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "🌐 Network MEVCUT")
                if (connectionState == "disconnected" && wsUrl.isNotEmpty()) {
                    handler.postDelayed({ connect() }, 1000)
                }
            }

            override fun onLost(network: Network) {
                Log.d(TAG, "🌐 Network KAYBOLDU")
                handleDisconnect("Network lost")
            }
        }

        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        try {
            connectivityManager?.registerNetworkCallback(networkRequest, networkCallback!!)
            Log.d(TAG, "✅ Network listener kaydedildi")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Network listener hatası: ${e.message}")
        }
    }

    private fun unregisterNetworkListener() {
        try {
            networkCallback?.let {
                connectivityManager?.unregisterNetworkCallback(it)
                Log.d(TAG, "✅ Network listener kaldırıldı")
            }
        } catch (e: Exception) {
            Log.e(TAG, "⚠️ Network listener kaldırma hatası: ${e.message}")
        }
    }

    // ================= PUBLIC API =================

    fun setMessageCallback(callback: (String, String, String) -> Unit) {
        messageCallback = callback
        Log.d(TAG, "✅ Message callback set")
    }

    fun setConnectionCallback(callback: (String, String?) -> Unit) {
        connectionCallback = callback
        Log.d(TAG, "✅ Connection callback set")
    }

    fun getConnectionState(): String = connectionState

    fun setAccessToken(token: String) {
        accessToken = token
        Log.d(TAG, "🔑 Access token güncellendi")
        
        // Tüm kanallara yeniden join (yeni token ile)
        subscriptions.values.forEach { sub ->
            sub.isJoined = false
            sendJoinMessage(sub)
        }
    }

    // 🆕 App ön plana/arka plana geçişi
    fun setAppForegroundState(inForeground: Boolean) {
        val wasInBackground = !isAppInForeground
        isAppInForeground = inForeground
        
        Log.d(TAG, "📱 App foreground state: $inForeground (buffer size: ${messageBuffer.size})")
        
        // Ön plana gelince buffer'daki mesajları gönder
        if (inForeground && wasInBackground && messageBuffer.isNotEmpty()) {
            flushBufferedMessages()
        }
    }

    // 🆕 Buffer'daki mesajları JS'e gönder
    private fun flushBufferedMessages() {
        Log.d(TAG, "📬 Buffer flush başlıyor, ${messageBuffer.size} mesaj")
        
        val messagesToSend = synchronized(messageBuffer) {
            val copy = messageBuffer.toList()
            messageBuffer.clear()
            copy
        }
        
        messagesToSend.forEach { msg ->
            Log.d(TAG, "📬 Buffered mesaj gönderiliyor: ${msg.topic} / ${msg.event}")
            messageCallback?.invoke(msg.topic, msg.event, msg.payload)
        }
        
        Log.d(TAG, "📬 Buffer flush tamamlandı, ${messagesToSend.size} mesaj gönderildi")
    }

    // 🆕 Buffered mesaj sayısını al
    fun getBufferedMessageCount(): Int = messageBuffer.size

    fun subscribe(topic: String, event: String, schema: String = "public", table: String = "*", filter: String? = null) {
        val subscription = ChannelSubscription(topic, event, schema, table, filter)
        subscriptions[topic] = subscription
        
        if (connectionState == "connected") {
            sendJoinMessage(subscription)
        }
        
        Log.d(TAG, "📢 Subscribe eklendi: $topic (active subs: ${subscriptions.size})")
    }

    fun unsubscribe(topic: String) {
        subscriptions[topic]?.let { sub ->
            if (sub.isJoined) {
                sendLeaveMessage(sub)
            }
            subscriptions.remove(topic)
            Log.d(TAG, "📴 Unsubscribe: $topic")
        }
    }

    fun broadcast(topic: String, event: String, payload: String) {
        val message = JSONArray().apply {
            put(null)
            put(getNextRef())
            put(topic)
            put(event)
            put(JSONObject(payload))
        }
        
        webSocket?.send(message.toString())
        Log.d(TAG, "📤 Broadcast gönderildi: $topic / $event")
    }

    // ================= PRIVATE METHODS =================

    private fun connect() {
        if (webSocket != null) {
            Log.d(TAG, "⚠️ Zaten bağlı veya bağlanıyor")
            return
        }

        // Wake lock
        try {
            if (wakeLock?.isHeld == false) {
                wakeLock?.acquire()
                Log.d(TAG, "🔋 Wake lock alındı (sonsuz)")
            }
        } catch (e: Exception) {
            Log.e(TAG, "⚠️ Wake lock alınamadı: ${e.message}")
        }

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
                
                lastHeartbeatAck = System.currentTimeMillis()
                connectionStartTime = System.currentTimeMillis()
                consecutiveHeartbeatFailures = 0
                
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
        val status = payload.optString("status", "")
        val response = payload.optJSONObject("response")
        
        Log.d(TAG, "📩 phx_reply: $topic, status=$status, ref=$ref")

        // Heartbeat ACK kontrolü
        if (ref == pendingHeartbeatRef && topic == "phoenix") {
            lastHeartbeatAck = System.currentTimeMillis()
            pendingHeartbeatRef = null
            consecutiveHeartbeatFailures = 0
            Log.d(TAG, "💓 Heartbeat ACK alındı")
            return
        }

        // Channel join yanıtı
        if (status == "ok") {
            subscriptions[topic]?.let { sub ->
                if (!sub.isJoined) {
                    sub.isJoined = true
                    sub.joinRef = ref
                    Log.d(TAG, "✅ Channel join başarılı: $topic")
                }
            }
        } else if (status == "error") {
            Log.e(TAG, "❌ Channel hatası: $topic - ${response?.toString()}")
        }

        // JS'e ilet
        messageCallback?.invoke(topic, "phx_reply", payload.toString())
    }

    private fun handlePhxError(topic: String, payload: JSONObject) {
        Log.e(TAG, "❌ Phoenix error: $topic - $payload")
        
        subscriptions[topic]?.let { sub ->
            sub.isJoined = false
            // Yeniden join dene
            handler.postDelayed({ sendJoinMessage(sub) }, 2000)
        }
    }

    private fun handlePhxClose(topic: String) {
        Log.d(TAG, "📴 Phoenix close: $topic")
        subscriptions[topic]?.isJoined = false
    }

    private fun handlePostgresChanges(topic: String, payload: JSONObject) {
        Log.d(TAG, "📊 Postgres changes: $topic (foreground: $isAppInForeground)")
        deliverOrBufferMessage(topic, "postgres_changes", payload.toString())
    }

    private fun handleBroadcast(topic: String, payload: JSONObject) {
        Log.d(TAG, "📢 Broadcast alındı: $topic (foreground: $isAppInForeground)")
        deliverOrBufferMessage(topic, "broadcast", payload.toString())
    }

    private fun handlePresence(topic: String, type: String, payload: JSONObject) {
        Log.d(TAG, "👥 Presence $type: $topic (foreground: $isAppInForeground)")
        deliverOrBufferMessage(topic, "presence_$type", payload.toString())
    }

    // 🆕 Mesajı ya ilet ya da buffer'la
    private fun deliverOrBufferMessage(topic: String, event: String, payload: String) {
        if (isAppInForeground) {
            // Ön plandayız, direkt ilet
            messageCallback?.invoke(topic, event, payload)
        } else {
            // Arka plandayız, buffer'la
            synchronized(messageBuffer) {
                if (messageBuffer.size < MAX_BUFFER_SIZE) {
                    messageBuffer.add(BufferedMessage(topic, event, payload))
                    Log.d(TAG, "📦 Mesaj buffer'landı: $topic / $event (total: ${messageBuffer.size})")
                } else {
                    // Buffer dolu, en eski mesajı at
                    messageBuffer.removeAt(0)
                    messageBuffer.add(BufferedMessage(topic, event, payload))
                    Log.w(TAG, "⚠️ Buffer dolu, eski mesaj atıldı")
                }
            }
        }
    }

    private fun handleDisconnect(reason: String) {
        Log.d(TAG, "🔌 Disconnect: $reason")
        
        webSocket?.cancel()
        webSocket = null
        
        subscriptions.values.forEach { it.isJoined = false }
        updateConnectionState("disconnected", reason)
        stopHeartbeat()

        // Reconnect
        if (wsUrl.isNotEmpty()) {
            scheduleReconnect()
        }
    }

    private fun scheduleReconnect() {
        val delay = minOf(
            RECONNECT_BASE_DELAY_MS * (1L shl minOf(reconnectAttempts, 5)),
            RECONNECT_MAX_DELAY_MS
        )
        reconnectAttempts++
        
        Log.d(TAG, "🔄 Reconnect planlandı: ${delay}ms sonra (deneme: $reconnectAttempts)")
        
        handler.postDelayed({
            if (connectionState == "disconnected") {
                connect()
            }
        }, delay)
    }

    private fun disconnect() {
        webSocket?.close(1000, "Client disconnect")
        webSocket = null
        subscriptions.values.forEach { it.isJoined = false }
    }

    // ================= HEARTBEAT =================

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
        Log.d(TAG, "💓 Heartbeat başlatıldı")
    }

    private fun stopHeartbeat() {
        heartbeatRunnable?.let {
            handler.removeCallbacks(it)
            heartbeatRunnable = null
        }
    }

    private fun sendHeartbeat() {
        val now = System.currentTimeMillis()
        val connectedDuration = now - connectionStartTime
        val timeSinceLastAck = now - lastHeartbeatAck
        
        // Timeout kontrolü
        if (timeSinceLastAck > HEARTBEAT_TIMEOUT_MS && connectedDuration > MIN_CONNECTED_TIME_MS) {
            consecutiveHeartbeatFailures++
            Log.w(TAG, "⚠️ Heartbeat timeout! failures=$consecutiveHeartbeatFailures")
            
            if (consecutiveHeartbeatFailures >= 3) {
                Log.e(TAG, "❌ Çok fazla heartbeat hatası, yeniden bağlanıyor...")
                handleDisconnect("Heartbeat timeout")
                return
            }
        }
        
        val ref = getNextRef()
        pendingHeartbeatRef = ref
        
        val message = JSONArray().apply {
            put(null)
            put(ref)
            put("phoenix")
            put("heartbeat")
            put(JSONObject())
        }
        
        webSocket?.send(message.toString())
        Log.d(TAG, "💓 Heartbeat gönderildi: ref=$ref")
    }

    // ================= CHANNEL MESSAGES =================

    private fun sendJoinMessage(sub: ChannelSubscription) {
        if (connectionState != "connected") return
        
        val ref = getNextRef()
        
        val config = JSONObject().apply {
            put("broadcast", JSONObject().apply {
                put("self", true)
            })
            put("presence", JSONObject().apply {
                put("key", "")
            })
            put("postgres_changes", JSONArray().apply {
                put(JSONObject().apply {
                    put("event", sub.event)
                    put("schema", sub.schema)
                    put("table", sub.table)
                    sub.filter?.let { put("filter", it) }
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
            put(sub.topic)
            put("phx_join")
            put(payload)
        }
        
        webSocket?.send(message.toString())
        Log.d(TAG, "📤 Join gönderildi: ${sub.topic}")
    }

    private fun sendLeaveMessage(sub: ChannelSubscription) {
        val ref = getNextRef()
        
        val message = JSONArray().apply {
            put(sub.joinRef)
            put(ref)
            put(sub.topic)
            put("phx_leave")
            put(JSONObject())
        }
        
        webSocket?.send(message.toString())
        Log.d(TAG, "📤 Leave gönderildi: ${sub.topic}")
    }

    private fun getNextRef(): String = messageRef.incrementAndGet().toString()

    // ================= NOTIFICATION =================

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Realtime Bağlantı",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Anlık oyun bağlantısı için gerekli"
                setShowBadge(false)
            }
            
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(status: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("KelimEle")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun updateNotification(status: String) {
        val notification = createNotification(status)
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification)
    }

    private fun updateConnectionState(state: String, reason: String?) {
        connectionState = state
        connectionCallback?.invoke(state, reason)
    }
}
