package com.ergan.kelimele;

import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Window geometry independent of transient system-bar visibility; excludes IME. */
@CapacitorPlugin(name = "StableViewport")
public class StableViewportPlugin extends Plugin {
    @PluginMethod
    public void getMetrics(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            View decor = getActivity().getWindow().getDecorView();
            WindowInsetsCompat windowInsets = ViewCompat.getRootWindowInsets(decor);
            if (windowInsets == null || decor.getWidth() <= 0 || decor.getHeight() <= 0) {
                call.reject("Window geometry not ready");
                return;
            }
            Insets safe = windowInsets.getInsetsIgnoringVisibility(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            JSObject result = new JSObject();
            result.put("width", decor.getWidth());
            result.put("height", decor.getHeight());
            result.put("top", safe.top);
            result.put("bottom", safe.bottom);
            result.put("left", safe.left);
            result.put("right", safe.right);
            call.resolve(result);
        });
    }
}