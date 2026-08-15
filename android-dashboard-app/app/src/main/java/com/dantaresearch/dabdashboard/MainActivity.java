package com.dantaresearch.dabdashboard;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;

public final class MainActivity extends Activity {
    private static final String DASHBOARD_URL = "https://dab-1-cizz.onrender.com/admin";
    private static final String DASHBOARD_HOST = "dab-1-cizz.onrender.com";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showDashboard();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void showDashboard() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        WebView view = new WebView(this);
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);
        view.getSettings().setDatabaseEnabled(true);
        view.getSettings().setAllowFileAccess(false);
        view.getSettings().setAllowContentAccess(false);
        view.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        view.getSettings().setMediaPlaybackRequiresUserGesture(false);
        view.getSettings().setUserAgentString(view.getSettings().getUserAgentString() + " 91DABDashboard/1.1");
        CookieManager.getInstance().setAcceptCookie(true);
        view.setWebChromeClient(new WebChromeClient());
        view.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView browser, WebResourceRequest request) {
                Uri next = request.getUrl();
                String scheme = next.getScheme();
                if ("https".equals(scheme) && DASHBOARD_HOST.equalsIgnoreCase(next.getHost())) return false;
                if ("mailto".equals(scheme) || "tel".equals(scheme)) {
                    startActivity(new Intent(Intent.ACTION_VIEW, next));
                }
                return true;
            }
        });
        view.loadUrl(DASHBOARD_URL);
        webView = view;
        root.addView(view, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
