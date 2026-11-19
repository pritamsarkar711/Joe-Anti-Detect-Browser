package com.joebrowser.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.widget.Toast;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;

/**
 * Launcher activity. Hosts the same React control-plane UI that ships on the
 * desktop EXE and on Vercel, loaded from assets, with a native JS bridge.
 */
public class MainActivity extends Activity {

    private WebView web;
    private SharedPreferences prefs;
    private SyncPoller poller;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("joe", Context.MODE_PRIVATE);

        web = new WebView(this);
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setUserAgentString("JoeBrowser/1.0 (Android; ControlPlane)");
        settings.setMediaPlaybackRequiresUserGesture(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }
        });
        web.addJavascriptInterface(new Bridge(), "JoeBridge");
        web.loadUrl("file:///android_asset/app/index.html");

        poller = new SyncPoller(this, web, prefs);
        poller.start();
    }

    @Override
    protected void onDestroy() {
        if (poller != null) poller.stopPolling();
        if (web != null) web.destroy();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
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
            return "{\"profiles\":[],\"proxies\":[],\"groups\":[\"Default\"]}";
        } finally {
            if (reader != null) try { reader.close(); } catch (Exception ignored) {}
        }
        return sb.toString();
    }

    /** Write the profile's process suffix before the :profile process starts. */
    private void writeSuffix(String suffix) {
        FileOutputStream out = null;
        try {
            File f = new File(getFilesDir(), "profile_suffix.txt");
            out = new FileOutputStream(f);
            out.write(suffix.getBytes("UTF-8"));
        } catch (Exception ignored) {
        } finally {
            if (out != null) try { out.close(); } catch (Exception ignored) {}
        }
    }

    private class Bridge {

        @JavascriptInterface
        public boolean isAndroid() { return true; }

        @JavascriptInterface
        public String getProfiles() { return readAsset("workspace.json"); }

        @JavascriptInterface
        public String getDeviceInfo() {
            JSONObject o = new JSONObject();
            try {
                o.put("kind", "android-apk");
                o.put("name", Build.MODEL);
                o.put("platform", "Android " + Build.VERSION.RELEASE);
                o.put("appVersion", "1.0.0");
                o.put("sdk", Build.VERSION.SDK_INT);
            } catch (JSONException ignored) {}
            return o.toString();
        }

        @JavascriptInterface
        public String launchProfile(String profileJson) {
            try {
                JSONObject p = new JSONObject(profileJson);
                String id = p.optString("id", "default");
                String ua = p.optJSONObject("fingerprint") == null
                        ? "" : p.optJSONObject("fingerprint").optString("userAgent", "");
                String url = p.optString("startUrl", "https://example.com");

                writeSuffix(id);
                Intent i = new Intent(MainActivity.this, BrowserActivity.class);
                i.putExtra("profileId", id);
                i.putExtra("userAgent", ua);
                i.putExtra("url", url);
                startActivity(i);
                return "{\"ok\":true}";
            } catch (Exception e) {
                return "{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        @JavascriptInterface
        public String saveConfig(String url, String anonKey) {
            prefs.edit().putString("supabase_url", url).putString("anon_key", anonKey).apply();
            return "{\"ok\":true}";
        }

        @JavascriptInterface
        public String getConfig() {
            JSONObject o = new JSONObject();
            try {
                o.put("url", prefs.getString("supabase_url", getString(R.string.default_supabase_url)));
                o.put("anonKey", prefs.getString("anon_key", ""));
            } catch (JSONException ignored) {}
            return o.toString();
        }

        @JavascriptInterface
        public String sendCommand(String topic, String payloadJson) {
            boolean ok = SyncHttp.post(prefs, topic, "android-apk", "desktop-exe", payloadJson);
            return "{\"ok\":" + ok + "}";
        }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
