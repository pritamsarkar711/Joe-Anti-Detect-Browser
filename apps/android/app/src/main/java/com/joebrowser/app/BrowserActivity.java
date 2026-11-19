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
import java.io.FileOutputStream;
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
    /** Profile owning this window; also the history file key. */
    private String profileId = "default";
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

        final String ua = getIntent().getStringExtra("userAgent");
        final String url = getIntent().getStringExtra("url");
        final String cookies = getIntent().getStringExtra("cookies");
        final String pageUrl = url == null || url.isEmpty() ? "https://browserscan.net/" : url;
        profileId = getIntent().getStringExtra("profileId");
        if (profileId == null || profileId.isEmpty()) profileId = "default";
        injection = readAsset("injection/" + profileId + ".js");

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
                recordHistory(view, pageUrl);
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
            // Not a lambda: the APK is compiled with `javac -source 8 -target 8`
            // against a bare android.jar, which has no LambdaMetafactory.
            final WebView target = view;
            final String payload = injection;
            view.postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (web == target) target.evaluateJavascript(payload, null);
                }
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

    /**
     * Append one visit to this profile's history log.
     *
     * The manager UI runs in the main process and polls the log through the
     * bridge (JoeBridge.getHistory). Ids are deterministic — FNV-1a over
     * profile, url and timestamp — so a re-read of the same line can never
     * create a duplicate entry. Files are trimmed well before they can grow
     * without bound.
     */
    private void recordHistory(WebView view, String pageUrl) {
        String target = pageUrl;
        if (target == null || target.isEmpty()) target = view.getUrl();
        if (target == null || !target.startsWith("http")) return;
        String title = view.getTitle();
        if (title == null) title = "";

        // Stamp in UTC so entries sort consistently with the desktop shell's ISO times.
        java.text.SimpleDateFormat iso = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
        iso.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        String at = iso.format(new java.util.Date());

        try {
            File dir = new File(getFilesDir(), "history");
            if (!dir.exists()) dir.mkdirs();
            String safe = profileId.replaceAll("[^a-zA-Z0-9_-]", "_");
            File file = new File(dir, safe + ".jsonl");
            if (file.exists() && file.length() > 256 * 1024) trimHistory(file);

            JSONObject row = new JSONObject();
            row.put("id", historyId(profileId, target, at));
            row.put("profileId", profileId);
            row.put("url", target);
            row.put("title", title.isEmpty() ? titleFor(target) : title);
            row.put("at", at);
            row.put("search", isSearchUrl(target));
            FileOutputStream out = new FileOutputStream(file, true);
            try {
                out.write((row.toString() + "\n").getBytes("UTF-8"));
            } finally {
                out.close();
            }
        } catch (Exception ignored) {
            // History must never break browsing.
        }
    }

    /** Same FNV-1a the shared TS core uses (packages/core/src/history.ts). */
    private static String historyId(String profileId, String url, String at) {
        long h = 0x811c9dc5L;
        String key = profileId + "\u0000" + url + "\u0000" + at;
        for (int i = 0; i < key.length(); i++) {
            h ^= key.charAt(i);
            h = (h * 0x01000193L) & 0xFFFFFFFFL;
        }
        return "h_" + Long.toString(h, 36);
    }

    /** A results page of a known engine carrying a query is a search, not a visit. */
    private static boolean isSearchUrl(String url) {
        try {
            java.net.URI u = java.net.URI.create(url);
            String host = u.getHost() == null ? "" : u.getHost().toLowerCase();
            boolean engine = host.contains("google.") || host.contains("bing.com")
                    || host.contains("duckduckgo.com") || host.contains("yahoo.")
                    || host.contains("yandex.") || host.contains("baidu.com")
                    || host.contains("ecosia.org") || host.contains("brave.com");
            if (!engine) return false;
            String query = u.getQuery();
            return query != null && (query.contains("q=") || query.contains("query=")
                    || query.contains("p=") || query.contains("text="));
        } catch (Exception e) {
            return false;
        }
    }

    private static String titleFor(String url) {
        try {
            String query = java.net.URI.create(url).getQuery();
            if (query != null) {
                String[] pairs = query.split("&");
                for (int i = 0; i < pairs.length; i++) {
                    String[] kv = pairs[i].split("=", 2);
                    if (kv.length == 2 && (kv[0].equals("q") || kv[0].equals("query") || kv[0].equals("text"))) {
                        return java.net.URLDecoder.decode(kv[1], "UTF-8") + " — search";
                    }
                }
            }
            return java.net.URI.create(url).getHost();
        } catch (Exception e) {
            return url;
        }
    }

    /** Keep only the most recent ~800 lines when the log grows past 256 KB. */
    private static void trimHistory(File file) {
        try {
            java.util.ArrayList<String> lines = new java.util.ArrayList<String>();
            BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), "UTF-8"));
            try {
                String line;
                while ((line = reader.readLine()) != null) lines.add(line);
            } finally {
                reader.close();
            }
            int keep = 800;
            java.util.List<String> tail = lines.size() > keep ? lines.subList(lines.size() - keep, lines.size()) : lines;
            FileOutputStream out = new FileOutputStream(file, false);
            try {
                for (int i = 0; i < tail.size(); i++) {
                    out.write((tail.get(i) + "\n").getBytes("UTF-8"));
                }
            } finally {
                out.close();
            }
        } catch (Exception ignored) {
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
