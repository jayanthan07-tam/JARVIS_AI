package com.jayanthan.jarvisai;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.http.SslError;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public final class MainActivity extends Activity {
    private static final String PREFS_NAME = "jarvis_android_settings";
    private static final String SERVER_URL_KEY = "server_url";
    private static final int MEDIA_PERMISSION_REQUEST = 4107;
    private static final String LOCAL_ASSET_ORIGIN = "https://appassets.androidplatform.net/";

    private WebView webView;
    private boolean showingSetup = true;
    private String setupMessage = "Connect to your secured J.A.R.V.I.S. server to load the app.";
    private PermissionRequest pendingMediaRequest;
    private String[] pendingMediaResources = new String[0];
    private String[] pendingAndroidPermissions = new String[0];

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(0, 14, 26));
        getWindow().setNavigationBarColor(Color.rgb(0, 14, 26));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(0, 14, 26));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        webView.setWebViewClient(new JarvisWebViewClient());
        webView.setWebChromeClient(new JarvisWebChromeClient());
        webView.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.graphics.Insets system = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(system.left, system.top, system.right, system.bottom);
            } else {
                view.setPadding(
                        insets.getSystemWindowInsetLeft(),
                        insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(),
                        insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(webView);

        String configuredUrl = getSavedServerUrl();
        if (configuredUrl.isEmpty()) {
            showSetup("Connect to your secured J.A.R.V.I.S. server to load the app.");
        } else {
            loadConfiguredServer();
        }
    }

    private SharedPreferences preferences() {
        return getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
    }

    private String getSavedServerUrl() {
        return preferences().getString(SERVER_URL_KEY, "").trim();
    }

    private String normalizeServerUrl(String candidate) {
        if (candidate == null || candidate.trim().isEmpty()) return null;
        try {
            Uri uri = Uri.parse(candidate.trim());
            String scheme = uri.getScheme();
            String host = uri.getHost();
            String path = uri.getPath();
            if (scheme == null || !"https".equalsIgnoreCase(scheme)) return null;
            if (host == null || host.isEmpty() || uri.getUserInfo() != null) return null;
            if (uri.getPort() != -1 && uri.getPort() != 443) return null;
            if (path != null && !path.isEmpty() && !"/".equals(path)) return null;
            if (uri.getQuery() != null || uri.getFragment() != null) return null;

            String normalizedHost = host.toLowerCase();
            if ("localhost".equals(normalizedHost)
                    || normalizedHost.endsWith(".localhost")
                    || "127.0.0.1".equals(normalizedHost)
                    || "::1".equals(normalizedHost)) {
                return null;
            }
            return "https://" + uri.getAuthority() + "/";
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private void loadConfiguredServer() {
        String saved = getSavedServerUrl();
        String normalized = normalizeServerUrl(saved);
        if (normalized == null) {
            preferences().edit().remove(SERVER_URL_KEY).apply();
            showSetup("Enter a valid HTTPS server origin. Localhost addresses are not accepted.");
            return;
        }

        showingSetup = false;
        setupMessage = "";
        webView.stopLoading();
        webView.removeJavascriptInterface("JarvisNative");
        webView.clearHistory();
        if (getPackageName().endsWith(".wear")) {
            normalized = Uri.parse(normalized).buildUpon()
                    .appendQueryParameter("mode", "wearable")
                    .appendQueryParameter("native", "wearos")
                    .build()
                    .toString();
        }
        webView.loadUrl(normalized);
    }

    private void showSetup(String message) {
        showingSetup = true;
        setupMessage = message;
        if (pendingMediaRequest != null) {
            pendingMediaRequest.deny();
            pendingMediaRequest = null;
        }
        webView.stopLoading();
        webView.removeJavascriptInterface("JarvisNative");
        webView.addJavascriptInterface(new SetupBridge(), "JarvisNative");
        webView.clearHistory();
        String html = readSetupPage();
        webView.loadDataWithBaseURL(LOCAL_ASSET_ORIGIN, html, "text/html", "UTF-8", null);
    }

    private String readSetupPage() {
        try (InputStream input = getAssets().open("setup.html");
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toString(StandardCharsets.UTF_8.name());
        } catch (IOException ignored) {
            return "<!doctype html><meta name='viewport' content='width=device-width,initial-scale=1'>"
                    + "<body style='background:#000e1a;color:#fff;font:16px sans-serif;padding:24px'>"
                    + "J.A.R.V.I.S. setup could not be loaded. Please reinstall the app.</body>";
        }
    }

    private boolean isTrustedOrigin(Uri uri) {
        String saved = normalizeServerUrl(getSavedServerUrl());
        if (saved == null || uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return false;
        if (uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) return false;
        Uri trusted = Uri.parse(saved);
        return trusted.getHost() != null && trusted.getHost().equalsIgnoreCase(uri.getHost());
    }

    private void openExternalLink(Uri uri) {
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (RuntimeException ignored) {
            // No compatible browser is installed.
        }
    }

    private void handleMediaPermissionRequest(PermissionRequest request) {
        if (showingSetup || !isTrustedOrigin(Uri.parse(request.getOrigin().toString()))) {
            request.deny();
            return;
        }

        List<String> resources = new ArrayList<>();
        List<String> permissions = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) {
                resources.add(resource);
                permissions.add(Manifest.permission.CAMERA);
            } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) {
                resources.add(resource);
                permissions.add(Manifest.permission.RECORD_AUDIO);
            }
        }
        if (resources.isEmpty()) {
            request.deny();
            return;
        }

        List<String> needed = new ArrayList<>();
        for (String permission : permissions) {
            if (!needed.contains(permission)
                    && checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                needed.add(permission);
            }
        }
        if (needed.isEmpty()) {
            request.grant(resources.toArray(new String[0]));
            return;
        }

        if (pendingMediaRequest != null) pendingMediaRequest.deny();
        pendingMediaRequest = request;
        pendingMediaResources = resources.toArray(new String[0]);
        pendingAndroidPermissions = needed.toArray(new String[0]);
        requestPermissions(pendingAndroidPermissions, MEDIA_PERMISSION_REQUEST);
    }

    private final class SetupBridge {
        @JavascriptInterface
        public String getSavedServerUrl() {
            return MainActivity.this.getSavedServerUrl();
        }

        @JavascriptInterface
        public String getSetupMessage() {
            return setupMessage;
        }

        @JavascriptInterface
        public boolean saveServerUrl(String candidate) {
            String normalized = normalizeServerUrl(candidate);
            if (normalized == null) return false;
            preferences().edit().putString(SERVER_URL_KEY, normalized).apply();
            runOnUiThread(MainActivity.this::loadConfiguredServer);
            return true;
        }

        @JavascriptInterface
        public void retry() {
            runOnUiThread(MainActivity.this::loadConfiguredServer);
        }

        @JavascriptInterface
        public void clearServerUrl() {
            preferences().edit().remove(SERVER_URL_KEY).apply();
            runOnUiThread(() -> showSetup("Enter the HTTPS origin for your secured J.A.R.V.I.S. server."));
        }
    }

    private final class JarvisWebViewClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isTrustedOrigin(uri)) return false;
            if (request.isForMainFrame()) openExternalLink(uri);
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame() && !showingSetup) {
                showSetup("J.A.R.V.I.S. could not reach that server. Check the URL and your connection, then try again.");
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request.isForMainFrame() && !showingSetup && response.getStatusCode() >= 400) {
                showSetup("The server returned HTTP " + response.getStatusCode() + ". Check the server URL and access settings.");
            }
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel();
            if (!showingSetup) {
                showSetup("The server certificate could not be verified. J.A.R.V.I.S. requires a valid HTTPS certificate.");
            }
        }

    }

    private final class JarvisWebChromeClient extends WebChromeClient {
        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> handleMediaPermissionRequest(request));
        }

        @Override
        public void onPermissionRequestCanceled(PermissionRequest request) {
            if (pendingMediaRequest == request) {
                pendingMediaRequest = null;
                pendingMediaResources = new String[0];
                pendingAndroidPermissions = new String[0];
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != MEDIA_PERMISSION_REQUEST) return;

        PermissionRequest request = pendingMediaRequest;
        String[] resources = pendingMediaResources;
        String[] requestedPermissions = pendingAndroidPermissions;
        pendingMediaRequest = null;
        pendingMediaResources = new String[0];
        pendingAndroidPermissions = new String[0];
        if (request == null) return;

        boolean granted = requestedPermissions.length > 0;
        for (String permission : requestedPermissions) {
            if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                granted = false;
                break;
            }
        }
        if (granted) request.grant(resources);
        else request.deny();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && !showingSetup) {
            if (webView.canGoBack()) {
                webView.goBack();
            } else {
                showSetup("Enter a different server address or reconnect to the current one.");
            }
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (pendingMediaRequest != null) {
            pendingMediaRequest.deny();
            pendingMediaRequest = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
