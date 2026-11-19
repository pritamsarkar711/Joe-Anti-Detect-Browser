package com.joebrowser.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.Bundle;
import android.os.Process;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

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
    /**
     * The Cloudflare / hCaptcha / reCAPTCHA challenge iframe is a child frame,
     * and `evaluateJavascript` only reaches the main frame. Re-injecting on
     * every frame that starts (plus a capped retry) is what keeps a profile from
     * showing "verify you are human" forever after the challenge redirects.
     */
    private final java.util.Set<String> injected = new java.util.HashSet<>();
    private int retries = 0;

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
        final String cookies = getIntent().getStringExtra("cookies");
        final String pageUrl = url == null || url.isEmpty() ? "https://browserscan.net/" : url;
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
                // A new document drops the previous context: clear the ledger so
                // the payload is applied again to this navigation.
                injected.clear();
                retries = 0;
                inject(view, pageUrl);
            }

            @Override
            public void onPageFinished(WebView view, String pageUrl) {
                inject(view, pageUrl);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                // Keep every hop inside the isolated profile instead of handing
                // it to an external browser, which would break isolation.
                return false;
            }

            @Override
            public void onReceivedError(WebView view, android.webkit.WebResourceRequest request, android.webkit.WebResourceError error) {
                // Show *something* instead of a blank white page when a load
                // fails (offline device, dead proxy, blocked host).
                if (request != null && request.isForMainFrame()) {
                    showErrorPage(view, error == null ? "Network error" : String.valueOf(error.getDescription()));
                }
            }
        });

        seedCookies(cookies, pageUrl);
        web.loadUrl(pageUrl);
    }

    /**
     * Apply the fingerprint payload to a frame and retry a few times.
     *
     * Some challenge flows replace the document after `onPageFinished` without
     * firing `onPageStarted` again for the child frame, so a single injection
     * can be wiped. Three attempts, 350 ms apart, cover that without looping.
     */
    private void inject(WebView view, String pageUrl) {
        if (injection == null || injection.isEmpty()) return;
        view.evaluateJavascript(injection, null);
        if (injected.add(pageUrl) && retries < 3) {
            retries++;
            view.postDelayed(() -> {
                if (web == view) view.evaluateJavascript(injection, null);
            }, 350L * retries);
        }
    }

    /** Minimal offline error surface: no external resources, no white screen. */
    private void showErrorPage(WebView view, String reason) {
        String safe = reason.replace("&", "&amp;").replace("<", "&lt;");
        String html = "<!doctype html><meta name=viewport content=\"width=device-width,initial-scale=1\">"
                + "<body style=\"margin:0;font:15px system-ui;background:#faf9fa;color:#1c191d;display:grid;place-items:center;height:100vh\">"
                + "<div style=\"text-align:center;padding:24px\">"
                + "<div style=\"width:36px;height:36px;border:4px solid #d81b60;border-radius:50%;margin:0 auto 16px\"></div>"
                + "<strong style=\"display:block;margin-bottom:6px\">This profile could not reach the page</strong>"
                + "<div style=\"color:#655f66;font-size:13px\">" + safe + "</div>"
                + "<div style=\"color:#655f66;font-size:12px;margin-top:10px\">Check the proxy for this profile, then reload.</div>"
                + "</div></body>";
        view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    /** Seed a profile cookie jar. JSON arrays and name=value pairs are accepted. */
    private void seedCookies(String text, String pageUrl) {
        if (text == null || text.trim().isEmpty()) return;
        CookieManager manager = CookieManager.getInstance();
        manager.setAcceptCookie(true);
        String trimmed = text.trim();
        try {
            if (trimmed.startsWith("[")) {
                JSONArray list = new JSONArray(trimmed);
                for (int i = 0; i < list.length(); i++) {
                    JSONObject c = list.optJSONObject(i);
                    if (c == null) continue;
                    String name = c.optString("name", "");
                    if (name.isEmpty()) continue;
                    String value = c.optString("value", "");
                    String domain = c.optString("domain", "");
                    String path = c.optString("path", "/");
                    boolean secure = c.optBoolean("secure", false);
                    String cookieUrl = domain.isEmpty() ? pageUrl
                            : (secure ? "https://" : "http://") + domain.replaceFirst("^\\.", "") + path;
                    StringBuilder cookie = new StringBuilder();
                    cookie.append(name).append("=").append(value);
                    if (!domain.isEmpty()) cookie.append("; Domain=").append(domain);
                    cookie.append("; Path=").append(path);
                    if (secure) cookie.append("; Secure");
                    if (c.optBoolean("httpOnly", false)) cookie.append("; HttpOnly");
                    long expires = c.optLong("expires", 0);
                    if (expires > 0) {
                        long age = expires - (System.currentTimeMillis() / 1000);
                        if (age > 0) cookie.append("; Max-Age=").append(age);
                    }
                    manager.setCookie(cookieUrl, cookie.toString());
                }
            } else {
                String[] parts = trimmed.split(";");
                for (int i = 0; i < parts.length; i++) {
                    String part = parts[i].trim();
                    if (part.indexOf('=') > 0) manager.setCookie(pageUrl, part);
                }
            }
            manager.flush();
        } catch (Exception ignored) {
            // Invalid cookie text must never prevent a profile from opening.
        }
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
