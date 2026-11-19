package com.joebrowser.app;

import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Client for the validated Supabase edge relay (joe-command-validate).
 *
 * The publishable key is kept away from the commands table by row-level
 * security, so every direction goes through the edge function: send queues an
 * envelope, poll returns this device's pending commands, ack marks them
 * handled. No external dependencies, no lambdas (the APK toolchain here
 * cannot desugar them — see scripts/check-java.mjs).
 */
public class SyncHttp {

    public static final String DEFAULT_URL = "https://rajxyaatbvlrxxzjntmo.supabase.co";
    private static final String WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

    private static String base(SharedPreferences p) {
        String url = p.getString("supabase_url", DEFAULT_URL);
        if (url == null || url.isEmpty()) url = DEFAULT_URL;
        return url.replaceAll("/+$", "");
    }

    private static String key(SharedPreferences p) {
        return p.getString("anon_key", "");
    }

    private static String read(HttpURLConnection c) throws Exception {
        BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = r.readLine()) != null) sb.append(line);
        r.close();
        return sb.toString();
    }

    /** POST one action to the relay. Returns the response body, or null. */
    private static String call(SharedPreferences p, JSONObject body) {
        String k = key(p);
        if (k == null || k.isEmpty()) return null;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(base(p) + "/functions/v1/joe-command-validate").openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.setRequestProperty("apikey", k);
            c.setRequestProperty("Authorization", "Bearer " + k);
            c.setRequestProperty("Content-Type", "application/json");
            c.setDoOutput(true);
            OutputStream os = c.getOutputStream();
            os.write(body.toString().getBytes("UTF-8"));
            os.close();
            int code = c.getResponseCode();
            if (code < 200 || code >= 300) return null;
            return read(c);
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** Queue a command so the desktop EXE (or the web dashboard) can pick it up. */
    public static boolean post(SharedPreferences p, String topic, String from, String to, String payloadJson) {
        try {
            JSONObject body = new JSONObject();
            body.put("action", "send");
            body.put("id", from + "-" + System.currentTimeMillis());
            body.put("workspace", WORKSPACE_ID);
            body.put("topic", topic);
            body.put("from", from);
            if (to != null) body.put("to", to);
            try {
                body.put("payload", new JSONObject(payloadJson));
            } catch (Exception e) {
                body.put("payload", new JSONObject().put("raw", payloadJson));
            }
            body.put("seq", System.currentTimeMillis());
            String resp = call(p, body);
            if (resp == null) return false;
            return new JSONObject(resp).optBoolean("ok", false);
        } catch (Exception e) {
            return false;
        }
    }

    /** Poll commands addressed to this APK since the last poll timestamp. */
    public static String commandsSince(SharedPreferences p, String isoTimestamp) {
        try {
            JSONObject body = new JSONObject();
            body.put("action", "poll");
            body.put("device", "android-apk");
            body.put("since", isoTimestamp);
            String resp = call(p, body);
            if (resp == null) return null;
            JSONObject parsed = new JSONObject(resp);
            if (!parsed.optBoolean("ok", false)) return null;
            JSONArray arr = parsed.optJSONArray("commands");
            return arr == null ? "[]" : arr.toString();
        } catch (Exception e) {
            return null;
        }
    }

    /** Mark handled commands delivered so the queue drains across devices. */
    public static void ack(SharedPreferences p, JSONArray ids) {
        if (ids == null || ids.length() == 0) return;
        try {
            JSONObject body = new JSONObject();
            body.put("action", "ack");
            body.put("ids", ids);
            call(p, body);
        } catch (Exception ignored) {
            // Bookkeeping only: the poll cursor already prevents re-delivery.
        }
    }
}
