package com.dantaresearch.dabdashboard;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String DASHBOARD_URL = "https://dab-1-cizz.onrender.com/admin";
    private static final String DASHBOARD_HOST = "dab-1-cizz.onrender.com";
    private static final int DAB_CREAM = Color.rgb(247, 244, 238);
    private static final int DAB_INK = Color.rgb(21, 19, 15);
    private static final int DAB_GOLD = Color.rgb(194, 147, 58);
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        showDashboard();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void showDashboard() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(DAB_CREAM);

        WebView view = new WebView(this);
        view.setBackgroundColor(DAB_CREAM);
        view.setAlpha(0f);
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
        final View launchPanel = createLaunchPanel();
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

            @Override
            public void onPageFinished(WebView browser, String url) {
                super.onPageFinished(browser, url);
                if (!DASHBOARD_HOST.equalsIgnoreCase(Uri.parse(url).getHost())) return;
                launchPanel.setVisibility(View.GONE);
                browser.animate().alpha(1f).setDuration(180).start();
            }
        });
        view.loadUrl(DASHBOARD_URL);
        webView = view;
        root.addView(view, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.addView(launchPanel, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
    }

    private View createLaunchPanel() {
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(48, 48, 48, 48);

        TextView mark = new TextView(this);
        mark.setText("91\nDAB");
        mark.setTextColor(DAB_CREAM);
        mark.setTextSize(20);
        mark.setTypeface(Typeface.DEFAULT_BOLD);
        mark.setGravity(Gravity.CENTER);
        mark.setLetterSpacing(.04f);
        GradientDrawable markBackground = new GradientDrawable();
        markBackground.setShape(GradientDrawable.OVAL);
        markBackground.setColor(DAB_GOLD);
        mark.setBackground(markBackground);
        panel.addView(mark, new LinearLayout.LayoutParams(112, 112));

        TextView title = new TextView(this);
        title.setText("91DAB");
        title.setTextColor(DAB_INK);
        title.setTextSize(24);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        titleParams.topMargin = 22;
        panel.addView(title, titleParams);

        TextView subtitle = new TextView(this);
        subtitle.setText("Opening your private merchant console");
        subtitle.setTextColor(Color.rgb(92, 88, 81));
        subtitle.setTextSize(14);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        subtitleParams.topMargin = 8;
        panel.addView(subtitle, subtitleParams);
        return panel;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}
