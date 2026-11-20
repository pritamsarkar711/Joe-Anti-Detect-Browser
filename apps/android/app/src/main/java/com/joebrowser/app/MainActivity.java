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

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
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
        // ES module scripts are fetched with CORS semantics; on API 30+ WebView
        // blocks file://→file:// module loads unless this is explicitly enabled.
        // Scoped safely here: the guard below refuses to load anything that is
        // not a bundled file:///android_asset/ resource, so no remote page can
        // ever read local files through this window.
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        // The manager UI is loaded from android_asset and never browses third
        // party pages, so it keeps the app's own agent; profiles (BrowserActivity)
        // get the spoofed one. The version comes from the manifest so the UA
        // cannot drift from the release version again.
        settings.setUserAgentString("JoeBrowser/" + appVersion() + " (Android; Workspace)");
        settings.setMediaPlaybackRequiresUserGesture(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // The management UI is a bundled asset and must never browse:
                // the JoeBridge is injected here, so a remote page would inherit
                // workspace control. Anything that is not a bundled asset is
                // refused and opened outside instead.
                String target = request == null || request.getUrl() == null ? "" : request.getUrl().toString();
                if (target.startsWith("file:///android_asset/")) return false;
                try {
                    Intent external = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(target));
                    external.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(external);
                } catch (Exception ignored) {
                    // No browser available; staying put is safer than loading it here.
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                // A missing or unreadable asset bundle used to leave a white
                // screen with no way out. Say what happened instead.
                if (request != null && request.isForMainFrame()) {
                    String reason = error == null ? "unknown" : String.valueOf(error.getDescription());
                    view.loadDataWithBaseURL(null,
                            "<!doctype html><meta name=viewport content=\"width=device-width,initial-scale=1\">"
                                    + "<body style=\"margin:0;font:15px system-ui;background:#faf9fa;color:#1c191d;display:grid;place-items:center;height:100vh;text-align:center\">"
                                    + "<div style=\"padding:24px\"><strong>Workspace failed to load</strong>"
                                    + "<div style=\"color:#655f66;font-size:13px;margin-top:6px\">" + reason + "</div>"
                                    + "<div style=\"color:#655f66;font-size:12px;margin-top:10px\">Reinstall the APK to restore the bundled assets.</div></div></body>",
                            "text/html", "utf-8", null);
                }
            }
        });
        web.addJavascriptInterface(new Bridge(), "JoeBridge");
        web.loadUrl("file:///android_asset/app/index.html");

        restartPollerIfConfigured();
    }

    /**
     * Start the Supabase poller only once a key is configured.
     *
     * Polling without a key sent `apikey: ` and `Authorization: Bearer ` to the
     * project on every tick — a request that can never succeed and that some
     * gateways treat as an attack. Saving the key now starts polling at once,
     * instead of requiring an app restart before sync appears to work.
     */
    private void restartPollerIfConfigured() {
        String key = prefs.getString("anon_key", "");
        boolean configured = key != null && key.length() > 0;
        if (configured && (poller == null || !poller.isAlive())) {
            poller = new SyncPoller(this, web, prefs);
            poller.start();
        }
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

    /** Version for the management user agent, from the manifest — never hard-coded. */
    private String appVersion() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "0";
        }
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
        public String getProfiles() { return readAsset("workspace.json"); }

        @JavascriptInterface
        public String getDeviceInfo() {
            JSONObject o = new JSONObject();
            try {
                o.put("kind", "android-apk");
                o.put("name", Build.MODEL);
                o.put("platform", "Android " + Build.VERSION.RELEASE);
                o.put("appVersion", appVersion());
                o.put("sdk", Build.VERSION.SDK_INT);
            } catch (JSONException ignored) {}
            return o.toString();
        }

        /**
         * Browsing history recorded by the isolated profile WebViews.
         *
         * Each profile process appends visits to filesDir/history/<id>.jsonl;
         * this reads every log back as one newest-first array for the UI.
         */
        @JavascriptInterface
        public String getHistory() {
            JSONArray rows = new JSONArray();
            try {
                File dir = new File(getFilesDir(), "history");
                File[] files = dir.listFiles();
                if (files != null) {
                    for (int f = 0; f < files.length; f++) {
                        if (!files[f].getName().endsWith(".jsonl")) continue;
                        BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(files[f]), "UTF-8"));
                        try {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                if (line.trim().isEmpty()) continue;
                                try {
                                    rows.put(new JSONObject(line));
                                } catch (JSONException ignored) {
                                    // A torn write from a killed process: skip the line.
                                }
                            }
                        } finally {
                            reader.close();
                        }
                    }
                }
                java.util.ArrayList<JSONObject> sorted = new java.util.ArrayList<JSONObject>();
                for (int i = 0; i < rows.length(); i++) sorted.add(rows.optJSONObject(i));
                java.util.Collections.sort(sorted, new java.util.Comparator<JSONObject>() {
                    @Override
                    public int compare(JSONObject a, JSONObject b) {
                        return b.optString("at", "").compareTo(a.optString("at", ""));
                    }
                });
                JSONArray out = new JSONArray();
                int cap = Math.min(sorted.size(), 1500);
                for (int i = 0; i < cap; i++) out.put(sorted.get(i));
                return out.toString();
            } catch (Exception e) {
                return "[]";
            }
        }

        /** Clear one profile's history log, or every log when the id is empty. */
        @JavascriptInterface
        public String clearHistory(String profileId) {
            try {
                File dir = new File(getFilesDir(), "history");
                File[] files = dir.listFiles();
                if (files != null) {
                    for (int f = 0; f < files.length; f++) {
                        String name = files[f].getName();
                        if (!name.endsWith(".jsonl")) continue;
                        if (profileId == null || profileId.isEmpty()
                                || name.equals(profileId.replaceAll("[^a-zA-Z0-9_-]", "_") + ".jsonl")) {
                            files[f].delete();
                        }
                    }
                }
                return "{\"ok\":true}";
            } catch (Exception e) {
                return "{\"ok\":false}";
            }
        }

        @JavascriptInterface
        public String launchProfile(String profileJson) {
            try {
                JSONObject p = new JSONObject(profileJson);
                String id = p.optString("id", "default");
                String ua = p.optJSONObject("fingerprint") == null
                        ? "" : p.optJSONObject("fingerprint").optString("userAgent", "");
                String url = p.optString("startUrl", "https://browserscan.net/");
                String cookies = p.optString("cookies", "");

                writeSuffix(id);
                Intent i = new Intent(MainActivity.this, BrowserActivity.class);
                i.putExtra("profileId", id);
                i.putExtra("userAgent", ua);
                i.putExtra("url", url);
                i.putExtra("cookies", cookies);
                startActivity(i);
                return "{\"ok\":true}";
            } catch (Exception e) {
                return "{\"ok\":false,\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        /**
         * Persist the project configuration and the signed-in user's access token.
         *
         * The anon key alone cannot pass RLS: `auth.uid()` is null, so every
         * command insert was rejected and the phone's sync was silently dead.
         * The third argument is the JWT from the Supabase session the UI holds;
         * SyncHttp sends it as the bearer token.
         */
        @JavascriptInterface
        public String saveConfig(String url, String anonKey, String accessToken) {
            prefs.edit()
                    .putString("supabase_url", url)
                    .putString("anon_key", anonKey)
                    .putString("access_token", accessToken == null ? "" : accessToken)
                    .apply();
            restartPollerIfConfigured();
            return "{\"ok\":true}";
        }

        @JavascriptInterface
        public String getConfig() {
            JSONObject o = new JSONObject();
            try {
                o.put("url", prefs.getString("supabase_url", getString(R.string.default_supabase_url)));
                o.put("anonKey", prefs.getString("anon_key", ""));
                o.put("accessToken", prefs.getString("access_token", ""));
            } catch (JSONException ignored) {}
            return o.toString();
        }

        @JavascriptInterface
        public String sendCommand(String topic, String payloadJson) {
            boolean ok = SyncHttp.post(prefs, topic, "android-apk", "desktop-exe", payloadJson);
            return "{\"ok\":" + ok + "}";
        }

    }
}
