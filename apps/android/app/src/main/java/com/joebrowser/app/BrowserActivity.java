package com.joebrowser.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Process;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

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
 *
 * The window carries real browser controls — address bar, back, forward,
 * reload/stop, home, find-on-page, zoom, downloads and clear-data — built
 * from plain android.widget views so the SDK-only APK build keeps working.
 */
public class BrowserActivity extends Activity {

    private WebView web;
    private String injection = "";
    /** Profile owning this window; also the history file key. */
    private String profileId = "default";
    /** The launch URL, reused by the Home button. */
    private String homeUrl = "https://browserscan.net/";
    /** Controls */
    private Button backBtn;
    private Button forwardBtn;
    private Button reloadBtn;
    private EditText address;
    private EditText findInput;
    private TextView findCount;
    private LinearLayout findRow;
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

    private int dp(float value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    @SuppressLint({"SetJavaScriptEnabled", "ClickableViewAccessibility"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final String ua = getIntent().getStringExtra("userAgent");
        final String url = getIntent().getStringExtra("url");
        final String cookies = getIntent().getStringExtra("cookies");
        homeUrl = url == null || url.isEmpty() ? "https://browserscan.net/" : url;
        profileId = getIntent().getStringExtra("profileId");
        if (profileId == null || profileId.isEmpty()) profileId = "default";
        injection = readAsset("injection/" + profileId + ".js");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#F6F7F9"));

        // ---- address row ----
        LinearLayout addressRow = new LinearLayout(this);
        addressRow.setOrientation(LinearLayout.HORIZONTAL);
        addressRow.setPadding(dp(8), dp(6), dp(8), dp(6));
        addressRow.setBackgroundColor(Color.WHITE);
        address = new EditText(this);
        address.setSingleLine(true);
        address.setTextSize(13);
        address.setHint("Search or enter address");
        address.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_GO);
        address.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        addressRow.addView(address);
        Button goBtn = smallButton("Go");
        addressRow.addView(goBtn);
        root.addView(addressRow);

        // ---- control row ----
        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setPadding(dp(8), dp(2), dp(8), dp(6));
        controls.setBackgroundColor(Color.WHITE);
        backBtn = smallButton("\u2190");
        forwardBtn = smallButton("\u2192");
        reloadBtn = smallButton("\u21BB");
        Button homeBtn = smallButton("\u2302");
        Button findBtn = smallButton("\u2315");
        Button zoomOut = smallButton("\u2212");
        Button zoomIn = smallButton("+");
        Button clearBtn = smallButton("\u232B");
        controls.addView(backBtn);
        controls.addView(forwardBtn);
        controls.addView(reloadBtn);
        controls.addView(homeBtn);
        controls.addView(findBtn);
        controls.addView(zoomOut);
        controls.addView(zoomIn);
        controls.addView(clearBtn);
        root.addView(controls);

        // ---- find row (hidden until requested) ----
        findRow = new LinearLayout(this);
        findRow.setOrientation(LinearLayout.HORIZONTAL);
        findRow.setPadding(dp(8), dp(2), dp(8), dp(6));
        findRow.setBackgroundColor(Color.parseColor("#F3E5F5"));
        findInput = new EditText(this);
        findInput.setSingleLine(true);
        findInput.setTextSize(12);
        findInput.setHint("Find on page");
        findInput.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        findCount = new TextView(this);
        findCount.setTextSize(11);
        findCount.setPadding(dp(6), 0, dp(6), 0);
        Button findPrev = smallButton("\u2191");
        Button findNext = smallButton("\u2193");
        Button findClose = smallButton("\u2715");
        findRow.addView(findInput);
        findRow.addView(findCount);
        findRow.addView(findPrev);
        findRow.addView(findNext);
        findRow.addView(findClose);
        findRow.setVisibility(View.GONE);
        root.addView(findRow);

        // ---- the isolated browser ----
        web = new WebView(this);
        LinearLayout.LayoutParams webParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f);
        root.addView(web, webParams);
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(true);
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
                refreshControls();
            }

            @Override
            public void onPageFinished(WebView view, String pageUrl) {
                inject(view, pageUrl);
                recordHistory(view, pageUrl);
                refreshControls();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Keep every hop inside the isolated profile instead of handing
                // it to an external browser, which would break isolation.
                return false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // Show *something* instead of a blank white page when a load
                // fails (offline device, dead proxy, blocked host).
                if (request != null && request.isForMainFrame()) {
                    showErrorPage(view, error == null ? "Network error" : String.valueOf(error.getDescription()));
                }
            }
        });

        /**
         * Deny-by-default permission gate. A profile must never leak location,
         * notifications or camera/microphone to a site without an explicit
         * per-profile decision; on Android those decisions live with the
         * desktop app's permission panel, so requests are refused here and the
         * refusal is visible in the toast.
         */
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        request.deny();
                    }
                });
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, false, false);
                Toast.makeText(BrowserActivity.this, "Location blocked for this profile", Toast.LENGTH_SHORT).show();
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (address != null && !address.hasFocus() && view.getUrl() != null) {
                    address.setText(view.getUrl());
                }
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> filePathCallback,
                                             android.webkit.WebChromeClient.FileChooserParams params) {
                // No file picker is wired in this build: cancel cleanly rather
                // than leaving the page waiting forever for a callback.
                filePathCallback.onReceiveValue(null);
                return true;
            }
        });

        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String downloadUrl, String userAgent, String contentDisposition,
                                        String mimeType, long contentLength) {
                try {
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(downloadUrl));
                    req.setMimeType(mimeType);
                    req.addRequestHeader("User-Agent", userAgent);
                    req.setTitle(android.webkit.URLUtil.guessFileName(downloadUrl, contentDisposition, mimeType));
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,
                            android.webkit.URLUtil.guessFileName(downloadUrl, contentDisposition, mimeType));
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    dm.enqueue(req);
                    Toast.makeText(BrowserActivity.this, "Download started", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(BrowserActivity.this, "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
        });

        web.setFindListener(new WebView.FindListener() {
            @Override
            public void onFindResultReceived(int activeMatchOrdinal, int numberOfMatches, boolean isDoneCounting) {
                if (isDoneCounting && findCount != null) {
                    findCount.setText(numberOfMatches == 0 ? "0/0" : (activeMatchOrdinal + 1) + "/" + numberOfMatches);
                }
            }
        });

        // ---- control wiring (no lambdas: the APK toolchain cannot desugar them) ----
        goBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { navigateTo(address.getText().toString()); }
        });
        address.setOnEditorActionListener(new TextView.OnEditorActionListener() {
            @Override
            public boolean onEditorAction(TextView v, int actionId, KeyEvent event) {
                navigateTo(address.getText().toString());
                return true;
            }
        });
        backBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { if (web.canGoBack()) web.goBack(); }
        });
        forwardBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { if (web.canGoForward()) web.goForward(); }
        });
        reloadBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                if (web.getProgress() < 100) web.stopLoading();
                else web.reload();
            }
        });
        homeBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { web.loadUrl(homeUrl); }
        });
        findBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                boolean open = findRow.getVisibility() == View.VISIBLE;
                findRow.setVisibility(open ? View.GONE : View.VISIBLE);
                if (!open) findInput.requestFocus();
                else { web.clearMatches(); findInput.setText(""); }
            }
        });
        findPrev.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { web.findNext(false); }
        });
        findNext.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { web.findNext(true); }
        });
        findClose.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                findRow.setVisibility(View.GONE);
                web.clearMatches();
                findInput.setText("");
            }
        });
        findInput.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {}
            @Override
            public void afterTextChanged(Editable s) {
                if (s.length() > 0) web.findAllAsync(s.toString());
                else { web.clearMatches(); findCount.setText(""); }
            }
        });
        zoomOut.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { web.zoomOut(); }
        });
        zoomIn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) { web.zoomIn(); }
        });
        clearBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                android.webkit.CookieManager.getInstance().removeAllCookies(null);
                web.clearCache(true);
                web.clearHistory();
                web.clearFormData();
                Toast.makeText(BrowserActivity.this, "Cookies and site data cleared", Toast.LENGTH_SHORT).show();
            }
        });

        seedCookies(cookies, homeUrl);
        web.loadUrl(homeUrl);
        refreshControls();
    }

    /** Address bar text to a navigable URL: URLs as-is, bare hosts with https, anything else as a search. */
    private void navigateTo(String raw) {
        String target = raw == null ? "" : raw.trim();
        if (target.isEmpty()) return;
        if (target.startsWith("http://") || target.startsWith("https://")) {
            web.loadUrl(target);
        } else if (target.matches("^[\\w-]+(\\.[\\w-]+)+(/.*)?$")) {
            web.loadUrl("https://" + target);
        } else {
            web.loadUrl("https://www.google.com/search?q=" + Uri.encode(target));
        }
    }

    /** Enable/disable controls to match the WebView's real state. */
    private void refreshControls() {
        if (backBtn == null) return;
        backBtn.setEnabled(web.canGoBack());
        forwardBtn.setEnabled(web.canGoForward());
        reloadBtn.setText(web.getProgress() < 100 ? "\u2715" : "\u21BB");
        if (address != null && !address.hasFocus() && web.getUrl() != null) {
            address.setText(web.getUrl());
        }
    }

    private Button smallButton(String label) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextSize(14);
        b.setMinWidth(0);
        b.setMinimumWidth(dp(40));
        b.setPadding(dp(8), dp(4), dp(8), dp(4));
        b.setAllCaps(false);
        b.setBackgroundColor(Color.TRANSPARENT);
        b.setTextColor(Color.parseColor("#1C191D"));
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.setMargins(dp(2), 0, dp(2), 0);
        b.setLayoutParams(p);
        return b;
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
