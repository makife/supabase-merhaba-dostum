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
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Realtime WebSocket Service - MESSAGE QUEUE DESTEKLİ
 * 
 * Foreground Service olarak çalışır, arka planda bile WebSocket bağlantısını canlı tutar.
 * Supabase Realtime (Phoenix Channels) protokolünü native olarak implement eder.
 * 
 * 🔥 YENİ ÖZELLİK: MESSAGE QUEUE
 * - JS arka plandayken mesajları queue'ya ekler
 * - JS ön plana gelince queue'daki tüm mesajları gönderir
 * - Bu sayede veriler KAYBOLMAZ!
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
        
        // 🔥 MESSAGE QUEUE AYARLARI
        private const val MAX_QUEUE_SIZE = 100 // Maksimum 100 mesaj tutulur
        private const val MESSAGE_EXPIRE_MS = 60000L // 1 dakikadan eski mesajlar atılır
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

    // 🔥🔥🔥 MESSAGE QUEUE - Arka planda gelen mesajları tutacak
    data class QueuedMessage(
        val topic: String,
        val event: String,
        val payload: String,
        val timestamp: Long = System.currentTimeMillis()
    )
    
    private val messageQueue = CopyOnWriteArrayList<QueuedMessage>()
    private val isJsInForeground = AtomicBoolean(true) // JS ön planda mı?

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
        
        // Queue'yu temizle
        messageQueue.clear()
        
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

    // 🔥🔥🔥 YENİ: JS Foreground/Background durumu
    fun enterForegroundMode() {
        Log.d(TAG, "▶️ JS Foreground moduna geçti")
        isJsInForeground.set(true)
        
        // Queue'daki mesajları gönder
        flushMessageQueue()
    }
    
    fun enterBackgroundMode() {
        Log.d(TAG, "⏸️ JS Background moduna geçti")
        isJsInForeground.set(false)
    }
    
    // 🔥 Queue'daki tüm mesajları JS'e gönder
    private fun flushMessageQueue() {
        if (messageQueue.isEmpty()) {
            Log.d(TAG, "📭 Message queue boş, gönderilecek mesaj yok")
            return
        }
        
        val now = System.currentTimeMillis()
        val validMessages = messageQueue.filter { msg ->
            now - msg.timestamp < MESSAGE_EXPIRE_MS
        }
        
        Log.d(TAG, "📬 Message queue flush ediliyor: ${validMessages.size} mesaj")
        
        validMessages.forEach { msg ->
            Log.d(TAG, "📤 Queued mesaj gönderiliyor: ${msg.topic} / ${msg.event}")
            messageCallback?.invoke(msg.topic, msg.event, msg.payload)
        }
        
        // Queue'yu temizle
        messageQueue.clear()
        Log.d(TAG, "✅ Message queue temizlendi")
    }
    
    // 🔥 Queue'daki mesajları getir (JS tarafından çağrılabilir)
    fun getQueuedMessages(): List<QueuedMessage> {
        val now = System.currentTimeMillis()
        return messageQueue.filter { msg ->
            now - msg.timestamp < MESSAGE_EXPIRE_MS
        }
    }
    
    // 🔥 Queue'yu temizle
    fun clearMessageQueue() {
        messageQueue.clear()
        Log.d(TAG, "🗑️ Message queue manuel temizlendi")
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

            Log.d(TAG, "📩 Mesaj: $topic / $event (JS foreground: ${isJsInForeground.get()})")

            when (event) {
                "phx_reply" -> handlePhxReply(topic, payload, ref)
                "phx_error" -> handlePhxError(topic, payload)
                "phx_close" -> handlePhxClose(topic)
                "postgres_changes" -> handlePostgresChanges(topic, payload)
                "broadcast" -> handleBroadcast(topic, payload)
                "presence_state" -> handlePresence(topic, "state", payload)
                "presence_diff" -> handlePresence(topic, "diff", payload)
                else -> {
                    // Diğer eventler - JS'e ilet veya queue'ya ekle
                    deliverOrQueueMessage(topic, event, payload.toString())
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Mesaj parse hatası: ${e.message}", e)
        }
    }

    // 🔥🔥🔥 KRİTİK: Mesajı JS'e gönder veya queue'ya ekle
    private fun deliverOrQueueMessage(topic: String, event: String, payload: String) {
        if (isJsInForeground.get()) {
            // JS ön planda - direkt gönder
            Log.d(TAG, "📤 Mesaj direkt gönderiliyor: $topic / $event")
            messageCallback?.invoke(topic, event, payload)
        } else {
            // JS arka planda - queue'ya ekle
            Log.d(TAG, "📥 Mesaj queue'ya ekleniyor: $topic / $event")
            
            // Queue boyutunu kontrol et
            if (messageQueue.size >= MAX_QUEUE_SIZE) {
                // En eski mesajı sil
                messageQueue.removeAt(0)
                Log.d(TAG, "⚠️ Queue dolu, en eski mesaj silindi")
            }
            
            messageQueue.add(QueuedMessage(topic, event, payload))
            Log.d(TAG, "📊 Queue boyutu: ${messageQueue.size}")
        }
    }

    private fun handlePhxReply(topic: String, payload: JSONObject, ref: String?) {
        val status = payload.optString("status", "error")
        
        // Heartbeat ACK kontrolü
        if (topic == "phoenix" && ref == pendingHeartbeatRef) {
            lastHeartbeatAck = System.currentTimeMillis()
            pendingHeartbeatRef = null
            consecutiveHeartbeatFailures = 0
            Log.d(TAG, "💚 Heartbeat ACK alındı")
            return
        }
        
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
        deliverOrQueueMessage(topic, "postgres_changes", payload.toString())
    }

    private fun handleBroadcast(topic: String, payload: JSONObject) {
        Log.d(TAG, "📢 Broadcast: $topic")
        deliverOrQueueMessage(topic, "broadcast", payload.toString())
    }

    private fun handlePresence(topic: String, type: String, payload: JSONObject) {
        Log.d(TAG, "👥 Presence $type: $topic")
        deliverOrQueueMessage(topic, "presence_$type", payload.toString())
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
        
        lastHeartbeatAck = System.currentTimeMillis()

        heartbeatRunnable = object : Runnable {
            override fun run() {
                if (connectionState == "connected") {
                    val now = System.currentTimeMillis()
                    val timeSinceLastAck = now - lastHeartbeatAck
                    val timeSinceConnection = now - connectionStartTime
                    
                    if (timeSinceConnection < MIN_CONNECTED_TIME_MS) {
                        Log.d(TAG, "⏳ Yeni bağlantı, timeout kontrolü atlanıyor")
                        sendHeartbeat()
                        handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
                        return
                    }
                    
                    if (timeSinceLastAck > HEARTBEAT_TIMEOUT_MS) {
                        consecutiveHeartbeatFailures++
                        Log.w(TAG, "⚠️ Heartbeat ACK timeout - failures: $consecutiveHeartbeatFailures")
                        
                        if (consecutiveHeartbeatFailures >= 3) {
                            Log.e(TAG, "❌ 3 ardışık heartbeat başarısız, yeniden bağlanılıyor...")
                            handler.post {
                                webSocket?.cancel()
                                webSocket = null
                                handleDisconnect("Heartbeat timeout (3 failures)")
                            }
                            return
                        }
                    } else {
                        consecutiveHeartbeatFailures = 0
                    }
                    
                    sendHeartbeat()
                    handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
                }
            }
        }

        handler.postDelayed(heartbeatRunnable!!, HEARTBEAT_INTERVAL_MS)
        Log.d(TAG, "💓 Heartbeat başlatıldı")
    }

    private fun sendHeartbeat() {
        pendingHeartbeatRef = getNextRef()
        
        val message = JSONArray().apply {
            put(null)
            put(pendingHeartbeatRef)
            put("phoenix")
            put("heartbeat")
            put(JSONObject())
        }

        webSocket?.send(message.toString())
        Log.d(TAG, "💓 Heartbeat gönderildi (ref: $pendingHeartbeatRef)")
    }

    private fun stopHeartbeat() {
        heartbeatRunnable?.let {
            handler.removeCallbacks(it)
            heartbeatRunnable = null
        }
    }

    private fun handleDisconnect(reason: String) {
        Log.d(TAG, "🔴 Disconnect: $reason")
        
        webSocket = null
        stopHeartbeat()
        updateConnectionState("disconnected", reason)
        updateNotification("Bağlantı kesildi")

        // Subscription'ları resetle
        subscriptions.values.forEach { it.isJoined = false }

        // Reconnect dene
        scheduleReconnect()
    }

    private fun scheduleReconnect() {
        reconnectAttempts++
        val delay = minOf(
            RECONNECT_BASE_DELAY_MS * (1 shl minOf(reconnectAttempts, 5)),
            RECONNECT_MAX_DELAY_MS
        )

        Log.d(TAG, "🔄 Reconnect planlandı: ${delay}ms sonra (attempt: $reconnectAttempts)")
        
        handler.postDelayed({
            if (connectionState == "disconnected") {
                connect()
            }
        }, delay)
    }

    private fun disconnect() {
        stopHeartbeat()
        webSocket?.close(1000, "Normal closure")
        webSocket = null
        updateConnectionState("disconnected", null)
    }

    private fun getNextRef(): String = messageRef.incrementAndGet().toString()

    private fun updateConnectionState(state: String, reason: String?) {
        connectionState = state
        connectionCallback?.invoke(state, reason)
    }

    // ================= NOTIFICATION =================

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Realtime Bağlantı",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "WebSocket bağlantı durumu"
                setShowBadge(false)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(status: String): Notification {
        val pendingIntent = packageManager.getLaunchIntentForPackage(packageName)?.let {
            PendingIntent.getActivity(
                this, 0, it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

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
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
}
