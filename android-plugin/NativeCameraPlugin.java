package com.ergan.kelimele;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 📷 NativeCameraPlugin
 * 
 * Capacitor Camera plugin'i yerine kullanılacak native çözüm.
 * Fotoğraf çekip/seçip Base64 olarak JS'e gönderir.
 * Geçici dosya sorunlarını tamamen ortadan kaldırır.
 * 
 * Android 13+ (API 33+) için READ_MEDIA_IMAGES kullanılır.
 */
@CapacitorPlugin(
    name = "NativeCamera",
    permissions = {
        @Permission(
            alias = "camera",
            strings = { Manifest.permission.CAMERA }
        )
    }
)
public class NativeCameraPlugin extends Plugin {
    
    private static final String TAG = "NativeCameraPlugin";
    private static final int REQUEST_CAMERA = 1001;
    private static final int REQUEST_GALLERY = 1002;
    private static final int MAX_IMAGE_SIZE = 800; // px
    private static final int JPEG_QUALITY = 80;
    
    private Uri photoUri;
    private String currentPhotoPath;
    
    /**
     * 📷 Kameradan fotoğraf çek
     */
    @PluginMethod
    public void captureFromCamera(PluginCall call) {
        Log.d(TAG, "📷 captureFromCamera çağrıldı");
        
        // Kamera izni kontrolü - sadece CAMERA izni gerekli
        if (!hasCameraPermission()) {
            Log.d(TAG, "📷 Kamera izni isteniyor...");
            requestPermissionForAlias("camera", call, "cameraPermissionCallback");
            return;
        }
        
        launchCamera(call);
    }
    
    /**
     * 🖼️ Galeriden fotoğraf seç
     */
    @PluginMethod
    public void pickFromGallery(PluginCall call) {
        Log.d(TAG, "🖼️ pickFromGallery çağrıldı");
        
        // Android 13+ (API 33+): ACTION_PICK_IMAGES kullanıyoruz, izin GEREKMİYOR!
        // İzin istemek sistem picker'ını açar → sonra bizim picker da açılır = ÇİFT SEÇİM
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Log.d(TAG, "🖼️ Android 13+ - Photo Picker kullanılıyor (izin gerekmez)");
            launchGallery(call);
            return;
        }
        
        // Android 6-12 - READ_EXTERNAL_STORAGE gerekli (runtime permission)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.READ_EXTERNAL_STORAGE) 
                != PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "🖼️ READ_EXTERNAL_STORAGE izni isteniyor...");
                ActivityCompat.requestPermissions(
                    getActivity(),
                    new String[]{ Manifest.permission.READ_EXTERNAL_STORAGE },
                    REQUEST_GALLERY
                );
                // İzin sonrası kullanıcı tekrar deneyecek
                call.reject("Depolama izni gerekli. Lütfen izin verdikten sonra tekrar deneyin.");
                return;
            }
        }
        
        launchGallery(call);
    }
    
    /**
     * Kamera izni var mı?
     */
    private boolean hasCameraPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.CAMERA) 
            == PackageManager.PERMISSION_GRANTED;
    }
    
    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        if (hasCameraPermission()) {
            Log.d(TAG, "✅ Kamera izni verildi");
            launchCamera(call);
        } else {
            Log.e(TAG, "❌ Kamera izni reddedildi");
            call.reject("Kamera izni reddedildi");
        }
    }
    
    @PermissionCallback
    private void galleryPermissionCallback(PluginCall call) {
        Log.d(TAG, "📷 Galeri izin callback çağrıldı");
        // İzin verilsin veya verilmesin galeriyi açmayı dene
        // Çünkü bazı durumlarda sistem zaten izin verebilir
        launchGallery(call);
    }
    
    private void launchCamera(PluginCall call) {
        Log.d(TAG, "📷 Kamera başlatılıyor...");
        
        try {
            Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            
            if (takePictureIntent.resolveActivity(getContext().getPackageManager()) == null) {
                call.reject("Kamera uygulaması bulunamadı");
                return;
            }
            
            // Fotoğraf için dosya oluştur
            File photoFile = createImageFile();
            if (photoFile == null) {
                call.reject("Dosya oluşturulamadı");
                return;
            }
            
            currentPhotoPath = photoFile.getAbsolutePath();
            
            // FileProvider ile URI oluştur
            photoUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                photoFile
            );
            
            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri);
            takePictureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            
            // Call'ı sakla ve activity'yi başlat
            saveCall(call);
            startActivityForResult(call, takePictureIntent, "cameraResultCallback");
            
            Log.d(TAG, "📷 Kamera açıldı, dosya yolu: " + currentPhotoPath);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Kamera başlatma hatası: " + e.getMessage(), e);
            call.reject("Kamera başlatılamadı: " + e.getMessage());
        }
    }
    
    private void launchGallery(PluginCall call) {
        Log.d(TAG, "🖼️ Galeri başlatılıyor...");
        
        try {
            // Modern galeri seçici kullan
            Intent pickIntent;
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // Android 13+ için Photo Picker
                pickIntent = new Intent(MediaStore.ACTION_PICK_IMAGES);
            } else {
                // Eski sürümler için klasik galeri
                pickIntent = new Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI);
            }
            
            pickIntent.setType("image/*");
            
            saveCall(call);
            startActivityForResult(call, pickIntent, "galleryResultCallback");
            
            Log.d(TAG, "🖼️ Galeri açıldı");
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Galeri başlatma hatası: " + e.getMessage(), e);
            // Fallback: Klasik galeri seçiciyi dene
            try {
                Intent fallbackIntent = new Intent(Intent.ACTION_GET_CONTENT);
                fallbackIntent.setType("image/*");
                saveCall(call);
                startActivityForResult(call, fallbackIntent, "galleryResultCallback");
            } catch (Exception e2) {
                call.reject("Galeri açılamadı: " + e2.getMessage());
            }
        }
    }
    
    @ActivityCallback
    private void cameraResultCallback(PluginCall call, ActivityResult result) {
        Log.d(TAG, "📷 Kamera sonucu alındı, resultCode: " + result.getResultCode());
        
        if (call == null) {
            Log.e(TAG, "❌ Call null!");
            return;
        }
        
        if (result.getResultCode() == Activity.RESULT_OK) {
            try {
                // Dosyadan bitmap yükle
                Bitmap bitmap = BitmapFactory.decodeFile(currentPhotoPath);
                
                if (bitmap == null) {
                    Log.e(TAG, "❌ Bitmap null!");
                    call.reject("Fotoğraf okunamadı");
                    return;
                }
                
                // EXIF rotasyonunu düzelt
                bitmap = fixRotation(bitmap, currentPhotoPath);
                
                // Boyutlandır ve Base64'e çevir
                String base64 = processAndEncodeImage(bitmap);
                bitmap.recycle();
                
                // Fotoğrafı galeriye kaydet (opsiyonel, hata verse de devam et)
                try {
                    saveToGallery(currentPhotoPath);
                } catch (Exception e) {
                    Log.w(TAG, "Galeriye kaydetme atlandı: " + e.getMessage());
                }
                
                // JS'e gönder
                JSObject ret = new JSObject();
                ret.put("base64", base64);
                ret.put("success", true);
                call.resolve(ret);
                
                Log.d(TAG, "✅ Kamera fotoğrafı işlendi ve gönderildi");
                
            } catch (Exception e) {
                Log.e(TAG, "❌ Fotoğraf işleme hatası: " + e.getMessage(), e);
                call.reject("Fotoğraf işlenemedi: " + e.getMessage());
            }
        } else {
            Log.d(TAG, "📷 Kamera iptal edildi");
            call.reject("Fotoğraf çekimi iptal edildi");
        }
    }
    
    @ActivityCallback
    private void galleryResultCallback(PluginCall call, ActivityResult result) {
        Log.d(TAG, "🖼️ Galeri sonucu alındı, resultCode: " + result.getResultCode());
        
        if (call == null) {
            Log.e(TAG, "❌ Call null!");
            return;
        }
        
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            try {
                Uri selectedImageUri = result.getData().getData();
                
                if (selectedImageUri == null) {
                    call.reject("Fotoğraf seçilemedi");
                    return;
                }
                
                // URI'den bitmap yükle
                InputStream inputStream = getContext().getContentResolver().openInputStream(selectedImageUri);
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                inputStream.close();
                
                if (bitmap == null) {
                    call.reject("Fotoğraf okunamadı");
                    return;
                }
                
                // Boyutlandır ve Base64'e çevir
                String base64 = processAndEncodeImage(bitmap);
                bitmap.recycle();
                
                // JS'e gönder
                JSObject ret = new JSObject();
                ret.put("base64", base64);
                ret.put("success", true);
                call.resolve(ret);
                
                Log.d(TAG, "✅ Galeri fotoğrafı işlendi ve gönderildi");
                
            } catch (Exception e) {
                Log.e(TAG, "❌ Galeri fotoğraf işleme hatası: " + e.getMessage(), e);
                call.reject("Fotoğraf işlenemedi: " + e.getMessage());
            }
        } else {
            Log.d(TAG, "🖼️ Galeri seçimi iptal edildi");
            call.reject("Fotoğraf seçimi iptal edildi");
        }
    }
    
    /**
     * Fotoğrafı boyutlandır ve Base64'e çevir
     */
    private String processAndEncodeImage(Bitmap original) {
        // Oranı koru ve boyutlandır
        int width = original.getWidth();
        int height = original.getHeight();
        float ratio = (float) width / height;
        
        int newWidth, newHeight;
        if (width > height) {
            newWidth = Math.min(width, MAX_IMAGE_SIZE);
            newHeight = (int) (newWidth / ratio);
        } else {
            newHeight = Math.min(height, MAX_IMAGE_SIZE);
            newWidth = (int) (newHeight * ratio);
        }
        
        Bitmap resized = Bitmap.createScaledBitmap(original, newWidth, newHeight, true);
        
        // JPEG olarak sıkıştır
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        resized.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, baos);
        byte[] bytes = baos.toByteArray();
        
        if (resized != original) {
            resized.recycle();
        }
        
        String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
        Log.d(TAG, "📷 Fotoğraf işlendi: " + newWidth + "x" + newHeight + ", Base64 uzunluk: " + base64.length());
        
        return base64;
    }
    
    /**
     * EXIF rotasyonunu düzelt (kamera genelde 90° döndürülmüş kaydeder)
     */
    private Bitmap fixRotation(Bitmap bitmap, String imagePath) {
        try {
            ExifInterface exif = new ExifInterface(imagePath);
            int orientation = exif.getAttributeInt(
                ExifInterface.TAG_ORIENTATION, 
                ExifInterface.ORIENTATION_UNDEFINED
            );
            
            Matrix matrix = new Matrix();
            switch (orientation) {
                case ExifInterface.ORIENTATION_ROTATE_90:
                    matrix.postRotate(90);
                    break;
                case ExifInterface.ORIENTATION_ROTATE_180:
                    matrix.postRotate(180);
                    break;
                case ExifInterface.ORIENTATION_ROTATE_270:
                    matrix.postRotate(270);
                    break;
                default:
                    return bitmap;
            }
            
            Bitmap rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
            if (rotated != bitmap) {
                bitmap.recycle();
            }
            return rotated;
            
        } catch (Exception e) {
            Log.w(TAG, "EXIF okunamadı: " + e.getMessage());
            return bitmap;
        }
    }
    
    /**
     * Fotoğraf için geçici dosya oluştur
     */
    private File createImageFile() {
        try {
            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            String fileName = "AVATAR_" + timeStamp + "_";
            
            File storageDir = getContext().getExternalFilesDir(Environment.DIRECTORY_PICTURES);
            
            if (storageDir != null && !storageDir.exists()) {
                storageDir.mkdirs();
            }
            
            return File.createTempFile(fileName, ".jpg", storageDir);
            
        } catch (Exception e) {
            Log.e(TAG, "Dosya oluşturma hatası: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Fotoğrafı galeriye kaydet
     */
    private void saveToGallery(String imagePath) {
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, new File(imagePath).getName());
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES);
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
            }
            
            Uri uri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            
            if (uri != null) {
                InputStream inputStream = new java.io.FileInputStream(imagePath);
                java.io.OutputStream outputStream = getContext().getContentResolver().openOutputStream(uri);
                
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = inputStream.read(buffer)) != -1) {
                    outputStream.write(buffer, 0, bytesRead);
                }
                
                inputStream.close();
                outputStream.close();
                
                Log.d(TAG, "✅ Fotoğraf galeriye kaydedildi");
            }
            
        } catch (Exception e) {
            Log.w(TAG, "Galeriye kaydetme hatası (kritik değil): " + e.getMessage());
        }
    }
}
