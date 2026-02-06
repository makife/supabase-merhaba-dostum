# Android Native Plugins

Bu klasördeki dosyalar Android projesine manuel olarak kopyalanmalıdır.

---

## 📷 NativeCameraPlugin

Avatar fotoğrafı çekme/seçme için native plugin. Capacitor Camera plugin'inin yaşadığı geçici dosya sorunlarını çözer.

### Dosyalar
- `NativeCameraPlugin.java` - Ana plugin kodu
- `file_paths.xml` - FileProvider yapılandırması

### Kurulum

#### 1. Java dosyasını kopyala:
```bash
cp android-plugin/NativeCameraPlugin.java android/app/src/main/java/com/ergan/kelimele/
```

#### 2. FileProvider yapılandırması:
```bash
mkdir -p android/app/src/main/res/xml
cp android-plugin/file_paths.xml android/app/src/main/res/xml/
```

#### 3. AndroidManifest.xml'e FileProvider ekle:

`<application>` tagı içine şunu ekle:
```xml
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.fileprovider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/file_paths" />
</provider>
```

#### 4. 🔴 ÖNEMLİ: AndroidManifest.xml İzinleri

**Android 13+ (API 33+) için:**
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

**Android 12 ve altı için ek izinler (maxSdkVersion ile sınırlandır):**
```xml
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
```

**Tam AndroidManifest.xml izin bloğu:**
```xml
<!-- Kamera -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />

<!-- Android 13+ için medya izinleri -->
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />

<!-- Android 12 ve altı için (geriye uyumluluk) -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />
```

### Özellikler
- ✅ Doğrudan Base64 formatında veri döndürür
- ✅ Geçici dosya erişim sorunları yok
- ✅ EXIF rotasyonu otomatik düzeltilir
- ✅ Fotoğraflar galeriye de kaydedilir
- ✅ Android 13+ Photo Picker desteği
- ✅ Geriye dönük uyumluluk (Android 6+)

---

## 🎵 NativeMusicPlugin

Arka plan müziği yönetimi için native plugin.

### Dosya
- `NativeMusicPlugin.java`

### Kurulum
```bash
cp android-plugin/NativeMusicPlugin.java android/app/src/main/java/com/ergan/kelimele/
```

---

## 📱 MainActivity.java

Ana activity dosyası. Plugin kayıtlarını ve uygulama yaşam döngüsü yönetimini içerir.

### Kurulum
```bash
cp android-plugin/MainActivity.java android/app/src/main/java/com/ergan/kelimele/
```

**Not:** Bu dosya şu plugin'leri kaydeder:
- `NativeMusicPlugin`
- `NativeCameraPlugin`

---

## 🔄 Native Realtime Plugin (Kotlin)

Supabase Realtime bağlantısını native Kotlin tarafında yönetir.

### Dosyalar
- `NativeRealtimePlugin.kt`
- `RealtimeWebSocketService.kt`
- `BackgroundWebViewKeepAlive.kt`

### Kurulum
Projeyi GitHub'a export edip `npx cap add android` yaptıktan sonra:

```bash
# Plugin dosyalarını kopyala
cp android-plugin/NativeRealtimePlugin.kt android/app/src/main/java/com/ergan/kelimele/plugins/
cp android-plugin/RealtimeWebSocketService.kt android/app/src/main/java/com/ergan/kelimele/plugins/
cp android-plugin/BackgroundWebViewKeepAlive.kt android/app/src/main/java/com/ergan/kelimele/plugins/
```

### build.gradle'a OkHttp Ekle
```gradle
dependencies {
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
}
```

### AndroidManifest.xml Eklemeleri
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />

<application ...>
    <service
        android:name=".plugins.RealtimeWebSocketService"
        android:enabled="true"
        android:exported="false"
        android:foregroundServiceType="dataSync" />
</application>
```

---

## 🚀 Genel Kurulum Sırası

1. Tüm dosyaları kopyala
2. AndroidManifest.xml güncellemelerini yap (özellikle izinler!)
3. `npx cap sync android`
4. AAB oluştur: `cd android && ./gradlew bundleRelease`

---

## ⚠️ Sık Karşılaşılan Hatalar

### "Missing permissions in AndroidManifest.xml" hatası
Bu hata AndroidManifest.xml'de izinlerin eksik olduğu anlamına gelir. Yukarıdaki izin bloğunu ekleyin.

### Android 13+ için özel durum
Android 13 ve üzeri sürümlerde `READ_EXTERNAL_STORAGE` ve `WRITE_EXTERNAL_STORAGE` izinleri çalışmaz!
Bunların yerine `READ_MEDIA_IMAGES` kullanılmalıdır.
