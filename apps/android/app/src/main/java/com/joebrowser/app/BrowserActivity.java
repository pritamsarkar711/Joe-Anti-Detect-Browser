package com.joebrowser.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.Process;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;

/**
 * Isolated browser window for one profile. Runs in the :profile process.
 *
 * WebView.setDataDirectorySuffix() is called in attachBaseContext, before any
 * WebView exists in this process. Because each launch gets a fresh process
 * (killed on exit), every profile receives its own cookie / cache / IndexedDB
 * directory. The JS consistency payload is injected before page scripts run.
 */
public class BrowserActivity extends Activity {

    private WebView web;
    private String injection = "";

    @Override
    protected void attachBaseContext(Context base) {
        String suffix = readSuffix(base);
        if (Build.VERSION.SDK_INT >= 28 && suffix != null && !suffix.isEmpty()) {
            try {
                WebView.setDataDirectorySuffix("joe_" + suffix.replaceAll("[^a-zA-Z0-9_]", ""));
            } catch (Exception ignored) {
                // A reused process would throw here; the launcher always kills it.
            }
        }
        super.attachBaseContext(base);
    }

    private String readSuffix(Context ctx) {
        FileInputStream in = null;
        try {
            File f = new File(ctx.getFilesDir(), "profile_suffix.txt");
            if (!f.exists()) return "default";
            in = new FileInputStream(f);
            byte[] b = new byte[(int) f.length()];
            int n = in.read(b);
            return n > 0 ? new String(b, 0, n, "UTF-8").trim() : "default";
        } catch (Exception e) {
            return "default";
        } finally {
            if (in != null) try { in.close(); } catch (Exception ignored) {}
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final String profileId = getIntent().getStringExtra("profileId");
        final String ua = getIntent().getStringExtra("userAgent");
        final String url = getIntent().getStringExtra("url");
        injection = readAsset("injection/" + (profileId == null ? "default" : profileId) + ".js");

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        if (ua != null && !ua.isEmpty()) s.setUserAgentString(ua);
        WebView.setWebContentsDebuggingEnabled(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String pageUrl, android.graphics.Bitmap favicon) {
                if (!injection.isEmpty()) view.evaluateJavascript(injection, null);
            }

            @Override
            public void onPageFinished(WebView view, String pageUrl) {
                if (!injection.isEmpty()) view.evaluateJavascript(injection, null);
            }
        });

        web.loadUrl(url == null || url.isEmpty() ? "https://example.com" : url);
    }

    private String readAsset(String name) {
        StringBuilder sb = new StringBuilder();
        BufferedReader reader = null;
        try {
            InputStream in = getAssets().open(name);
            reader = new BufferedReader(new InputStreamReader(in, "UTF-8"));
            String line;
            while ((line = reader.readLine()) != null) sb.append(line).append('\n');
        } catch (Exception e) {
            return "";
        } finally {
            if (reader != null) try { reader.close(); } catch (Exception ignored) {}
        }
        return sb.toString();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else finish();
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
        // Guarantee a fresh process (and therefore a fresh WebView data dir)
        // for the next profile launch.
        Process.killProcess(Process.myPid());
    }
}
