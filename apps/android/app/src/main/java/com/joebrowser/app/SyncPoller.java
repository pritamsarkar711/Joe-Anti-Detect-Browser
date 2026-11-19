package com.joebrowser.app;

import android.app.Activity;
import android.content.SharedPreferences;
import android.webkit.WebView;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Polls Supabase for commands sent by the desktop EXE and forwards them to the UI. */
public class SyncPoller extends Thread {

    private final Activity activity;
    private final WebView web;
    private final SharedPreferences prefs;
    private volatile boolean running = true;

    public SyncPoller(Activity activity, WebView web, SharedPreferences prefs) {
        super("joe-sync");
        this.activity = activity;
        this.web = web;
        this.prefs = prefs;
    }

    public void stopPolling() { running = false; interrupt(); }

    @Override
    public void run() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        fmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        String since = prefs.getString("last_poll", "1970-01-01T00:00:00Z");

        while (running) {
            try {
                // A blank key cannot authorise anything; sending it just makes
                // one doomed request per tick.
                // No session token means no identity, and RLS answers nothing.
                String key = prefs.getString("access_token", "");
                if (key == null || key.length() == 0) {
                    try { Thread.sleep(5000); } catch (InterruptedException e) { return; }
                    continue;
                }
                String payload = SyncHttp.commandsSince(prefs, since);
                final String now = fmt.format(new Date());
                if (payload != null && !payload.equals("[]")) {
                    final String script = "window.__joeOnCommand && window.__joeOnCommand(" + payload + ");";
                    activity.runOnUiThread(new Runnable() {
                        @Override public void run() {
                            web.evaluateJavascript(script, null);
                        }
                    });
                }
                prefs.edit().putString("last_poll", now).apply();
                since = now;
            } catch (Exception ignored) {
                // Offline / unconfigured: keep polling silently.
            }
            try { Thread.sleep(5000); } catch (InterruptedException e) { return; }
        }
    }
}
