# Native Realtime Plugin for Capacitor

Bu plugin, Supabase Realtime bağlantısını native Kotlin tarafında yönetir. WebView'den bağımsız çalışır ve arka planda bile bağlantı kopmaz.

## 🔥 YENİ ÖZELLİK: WebView Keep-Alive Hack

Uygulama arka plana gittiğinde 1x1 piksellik görünmez bir WebView başlatılır. Bu sayede:
- JavaScript execution duraklamaz
- Realtime veriler kaybolmaz
- Foreground Service + WebView = Sürekli canlı bağlantı!

## Kurulum

### 1. Dosyaları Android Projesine Kopyala

Projeyi GitHub'a export edip `npx cap add android` yaptıktan sonra:

```bash
# Plugin dosyalarını kopyala
cp android-plugin/NativeRealtimePlugin.kt android/app/src/main/java/com/ergan/kelimele/plugins/
cp android-plugin/RealtimeWebSocketService.kt android/app/src/main/java/com/ergan/kelimele/plugins/
cp android-plugin/BackgroundWebViewKeepAlive.kt android/app/src/main/java/com/ergan/kelimele/plugins/
```

### 2. build.gradle'a OkHttp Ekle

`android/app/build.gradle` dosyasına ekle:

```gradle
dependencies {
    // ... mevcut bağımlılıklar
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
}
```

### 3. AndroidManifest.xml'e Ekle

`android/app/src/main/AndroidManifest.xml` dosyasına ekle:

```xml
<manifest ...>
    <!-- İzinler -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    
    <!-- 🔥 YENİ: WebView Keep-Alive için Overlay izni -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    
    <application ...>
        <!-- Service -->
        <service
            android:name=".plugins.RealtimeWebSocketService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="dataSync" />
    </application>
</manifest>
```

### 4. MainActivity.kt'ye Plugin'i Kaydet

`android/app/src/main/java/com/ergan/kelimele/MainActivity.kt` dosyasını düzenle:

```kotlin
package com.ergan.kelimele

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import com.getcapacitor.BridgeActivity
import com.ergan.kelimele.plugins.NativeRealtimePlugin

class MainActivity : BridgeActivity() {
    
    companion object {
        private const val OVERLAY_PERMISSION_REQUEST_CODE = 1234
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        // Plugin'i kaydet
        registerPlugin(NativeRealtimePlugin::class.java)
        
        super.onCreate(savedInstanceState)
        
        // 🔥 Overlay izni kontrolü (WebView Keep-Alive için gerekli)
        checkOverlayPermission()
    }
    
    private fun checkOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                Log.w("MainActivity", "⚠️ SYSTEM_ALERT_WINDOW izni yok, WebView Keep-Alive çalışmayacak")
                // Opsiyonel: Kullanıcıya izin iste
                // requestOverlayPermission()
            } else {
                Log.d("MainActivity", "✅ Overlay izni mevcut")
            }
        }
    }
    
    // Opsiyonel: Overlay izni isteme
    private fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivityForResult(intent, OVERLAY_PERMISSION_REQUEST_CODE)
        }
    }
    
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == OVERLAY_PERMISSION_REQUEST_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (Settings.canDrawOverlays(this)) {
                    Log.d("MainActivity", "✅ Overlay izni verildi!")
                } else {
                    Log.w("MainActivity", "❌ Overlay izni reddedildi")
                }
            }
        }
    }
}
```

### 5. npx cap sync

```bash
npx cap sync android
```

## JS Tarafında Kullanım

```typescript
import { registerPlugin } from '@capacitor/core';

interface NativeRealtimePlugin {
  connect(options: { url: string; apiKey: string; accessToken?: string }): Promise<{ success: boolean }>;
  disconnect(): Promise<{ success: boolean }>;
  
  // 🔥 Foreground/Background mode (WebView Keep-Alive + Message Queue)
  enterForegroundMode(): Promise<void>;
  enterBackgroundMode(): Promise<void>;
  
  subscribe(options: { 
    topic: string; 
    event?: string; 
    schema?: string; 
    table?: string; 
    filter?: string 
  }): Promise<{ success: boolean }>;
  unsubscribe(options: { topic: string }): Promise<{ success: boolean }>;
  broadcast(options: { topic: string; event: string; payload: string }): Promise<{ success: boolean }>;
  getConnectionState(): Promise<{ state: string; isConnected: boolean }>;
  setAccessToken(options: { token: string }): Promise<{ success: boolean }>;
  addListener(
    eventName: 'realtimeMessage' | 'connectionState',
    listenerFunc: (data: any) => void
  ): Promise<{ remove: () => void }>;
}

const NativeRealtime = registerPlugin<NativeRealtimePlugin>('NativeRealtime');

export { NativeRealtime };
```

## Özellikler

- ✅ **Foreground Service** - Android arka planda öldürmez
- ✅ **Wake Lock** - CPU uyumaz
- ✅ **Auto Reconnect** - Bağlantı koparsa otomatik yeniden bağlanır
- ✅ **Heartbeat** - 25 saniyede bir ping gönderir
- ✅ **Phoenix Channels** - Supabase Realtime protokolü ile uyumlu
- ✅ **Postgres Changes** - Veritabanı değişikliklerini dinler
- ✅ **Broadcast** - Mesaj gönderip alabilir
- ✅ **Presence** - Online kullanıcıları takip eder
- ✅ **Message Queue** - Arka plandayken mesajlar kaybolmaz
- 🔥 **WebView Keep-Alive** - 1x1 WebView ile JavaScript canlı kalır!

## Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                        React App                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 useNativeRealtime()                      │ │
│  │                 useAppForegroundState()                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │ Capacitor Bridge
┌──────────────────────────▼──────────────────────────────────┐
│                   NativeRealtimePlugin.kt                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              RealtimeWebSocketService                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │ │
│  │  │   OkHttp    │  │  Heartbeat  │  │  Message Queue  │  │ │
│  │  │  WebSocket  │  │   Handler   │  │     Handler     │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │           BackgroundWebViewKeepAlive               │ │ │
│  │  │  ┌─────────────────────────────────────────────┐   │ │ │
│  │  │  │  1x1 Görünmez WebView (JS Execution Aktif)  │   │ │ │
│  │  │  └─────────────────────────────────────────────┘   │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │ Native WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                   Supabase Realtime Server                   │
│                 (Phoenix Channels Protocol)                  │
└─────────────────────────────────────────────────────────────┘
```

## WebView Keep-Alive Nasıl Çalışır?

1. **Arka Plana Geçiş**: `enterBackgroundMode()` çağrılır
2. **1x1 WebView Oluşturulur**: Görünmez overlay olarak ekrana eklenir
3. **JavaScript Timer Başlar**: 5 saniyede bir heartbeat gönderir
4. **Android Süreci Canlı Tutar**: WebView process aktif olduğu için JS duraklamaz
5. **Ön Plana Dönüş**: `enterForegroundMode()` çağrılır
6. **WebView Kapatılır**: Kaynak tüketimini önler

## İzin Notları

### SYSTEM_ALERT_WINDOW İzni

WebView Keep-Alive özelliği için bu izin gereklidir. Ancak:
- Google Play Store'da bazı uygulamalar için otomatik verilir
- Foreground Service zaten çalıştığı için genellikle sorunsuz çalışır
- İzin yoksa bile Message Queue sistemi devreye girer ve veriler kaybolmaz

### İzin İsteme (Opsiyonel)

Kullanıcıdan manuel izin isteyebilirsiniz:
```kotlin
val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
startActivityForResult(intent, OVERLAY_PERMISSION_REQUEST_CODE)
```
