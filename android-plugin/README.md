# Native Realtime Plugin for Capacitor

Bu plugin, Supabase Realtime bağlantısını native Kotlin tarafında yönetir. WebView'den bağımsız çalışır ve arka planda bile bağlantı kopmaz.

## Kurulum

### 1. Dosyaları Android Projesine Kopyala

Projeyi GitHub'a export edip `npx cap add android` yaptıktan sonra:

```bash
# Plugin dosyalarını kopyala
cp android-plugin/NativeRealtimePlugin.kt android/app/src/main/java/com/example/kelimeci/plugins/
cp android-plugin/RealtimeWebSocketService.kt android/app/src/main/java/com/example/kelimeci/plugins/
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

`android/app/src/main/java/com/example/kelimeci/MainActivity.kt` dosyasını düzenle:

```kotlin
package com.example.kelimeci

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.example.kelimeci.plugins.NativeRealtimePlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Plugin'i kaydet
        registerPlugin(NativeRealtimePlugin::class.java)
        
        super.onCreate(savedInstanceState)
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

## Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                        React App                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 useNativeRealtime()                      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │ Capacitor Bridge
┌──────────────────────────▼──────────────────────────────────┐
│                   NativeRealtimePlugin.kt                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              RealtimeWebSocketService                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │ │
│  │  │   OkHttp    │  │  Heartbeat  │  │ Auto Reconnect  │  │ │
│  │  │  WebSocket  │  │   Handler   │  │     Handler     │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │ Native WebSocket
┌──────────────────────────▼──────────────────────────────────┐
│                   Supabase Realtime Server                   │
│                 (Phoenix Channels Protocol)                  │
└─────────────────────────────────────────────────────────────┘
```
