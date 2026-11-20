package com.expert10000.stockfishcoach;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Android 15+ draws the WebView behind the status bar. Keep its scrolling
        // viewport below the bar so content cannot pan underneath the clock.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            View content = findViewById(android.R.id.content);
            content.setBackgroundColor(Color.rgb(16, 27, 40));
            ViewCompat.setOnApplyWindowInsetsListener(content, (view, windowInsets) -> {
                Insets topBars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout()
                );
                view.setPadding(topBars.left, topBars.top, topBars.right, 0);
                return windowInsets;
            });
            ViewCompat.requestApplyInsets(content);
        }
    }
}
