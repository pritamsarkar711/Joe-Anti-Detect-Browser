package com.joebrowser.app;

import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

/** Minimal PostgREST client for EXE ⇄ APK sync. No external dependencies. */
public class SyncHttp {

    public static final String DEFAULT_URL = "https://rajxyaatbvlrxxzjntmo.supabase.co";

    private static String base(SharedPreferences p) {
        String url = p.getString("supabase_url", DEFAULT_URL);
        if (url == null || url.isEmpty()) url = DEFAULT_URL;
        return url.replaceAll("/+$", "");
    }

    private static String key(SharedPreferences p) {
        return p.getString("anon_key", "");
    }

    /**
     * The credential to send.
     *
     * A signed-in session token identifies the user, so row-level security can
     * scope the request to their workspace. Without it the anon key leaves
     * `auth.uid()` empty and every write is denied — which is what made the
     * documented phone-to-desktop sync a no-op.
     */
    private static String bearer(SharedPreferences p) {
        String token = p.getString("access_token", "");
        if (token != null && token.length() > 0) return token;
        return key(p);
    }

    /** True when a signed-in session exists; polling without one cannot succeed. */
    public static boolean signedIn(SharedPreferences p) {
        String token = p.getString("access_token", "");
        return token != null && token.length() > 0;
    }

    private static HttpURLConnection open(SharedPreferences p, String path, String method) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(base(p) + path).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(6000);
        c.setReadTimeout(6000);
        c.setRequestProperty("apikey", key(p));
        c.setRequestProperty("Authorization", "Bearer " + bearer(p));
        c.setRequestProperty("Content-Type", "application/json");
        return c;
    }

    private static String read(HttpURLConnection c) throws Exception {
        BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        r.close();
        return sb.toString();
    }

    /** Write a command so the desktop EXE (or the web dashboard) can pick it up. */
    public static boolean post(SharedPreferences p, String topic, String from, String to, String payloadJson) {
        if (key(p) == null || key(p).isEmpty()) return false;
        // An anonymous write is refused by RLS; reporting it as sent would be a lie.
        if (!signedIn(p)) return false;
        HttpURLConnection c = null;
        try {
            c = open(p, "/rest/v1/commands", "POST");
            c.setRequestProperty("Prefer", "return=minimal");
            c.setDoOutput(true);
            JSONObject body = new JSONObject();
            body.put("id", from + "-" + System.currentTimeMillis());
            // workspace_id is intentionally omitted: the database default resolves
            // the caller's own workspace from their membership.
            body.put("topic", topic);
            body.put("from_device", from);
            body.put("to_device", to);
            try { body.put("payload", new JSONObject(payloadJson)); }
            catch (Exception e) { body.put("payload", new JSONObject().put("raw", payloadJson)); }
            OutputStream os = c.getOutputStream();
            os.write(body.toString().getBytes("UTF-8"));
            os.close();
            int code = c.getResponseCode();
            return code >= 200 && code < 300;
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** Poll commands addressed to this APK since the last poll timestamp. */
    public static String commandsSince(SharedPreferences p, String isoTimestamp) {
        if (key(p) == null || key(p).isEmpty()) return null;
        if (!signedIn(p)) return null;
        HttpURLConnection c = null;
        try {
            String path = "/rest/v1/commands?select=id,topic,payload,from_device,created_at"
                    + "&to_device=eq.android-apk&status=eq.pending"
                    + "&created_at=gt." + URLEncoder.encode(isoTimestamp, "UTF-8")
                    + "&order=created_at.asc&limit=20";
            c = open(p, path, "GET");
            int code = c.getResponseCode();
            if (code < 200 || code >= 300) return null;
            JSONArray arr = new JSONArray(read(c));
            return arr.toString();
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }
}
