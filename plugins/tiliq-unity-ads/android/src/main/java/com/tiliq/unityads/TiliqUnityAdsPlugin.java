package com.tiliq.unityads;

import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.unity3d.ads.BannerAd;
import com.unity3d.ads.BannerConfiguration;
import com.unity3d.ads.BannerShowListener;
import com.unity3d.ads.BannerSize;
import com.unity3d.ads.InitializationConfiguration;
import com.unity3d.ads.InterstitialAd;
import com.unity3d.ads.InterstitialShowListener;
import com.unity3d.ads.LoadConfiguration;
import com.unity3d.ads.RewardedAd;
import com.unity3d.ads.RewardedShowListener;
import com.unity3d.ads.ShowConfiguration;
import com.unity3d.ads.ShowFinishState;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsError;

@CapacitorPlugin(name = "TiliqUnityAds")
public class TiliqUnityAdsPlugin extends Plugin {
    private InterstitialAd interstitial;
    private RewardedAd rewarded;
    private BannerAd banner;
    private FrameLayout bannerContainer;
    private boolean initialized;
    private boolean interstitialLoading;
    private boolean rewardedLoading;

    private void emit(String event) {
        notifyListeners(event, new JSObject());
    }

    private void emit(String event, JSObject data) {
        notifyListeners(event, data);
    }

    private void emitError(String event, UnityAdsError error) {
        JSObject data = new JSObject();
        data.put("message", error == null ? "Unity Ads error" : error.getMessage());
        notifyListeners(event, data);
    }

    private String placement(PluginCall call) {
        String id = call.getString("adId", "");
        if (id.isEmpty()) call.reject("Unity Ads placement ID is missing");
        return id;
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        String gameId = call.getString("gameId", "");
        if (gameId.isEmpty()) { call.reject("Unity Ads Game ID is missing"); return; }
        if (initialized || UnityAds.isInitialized()) {
            initialized = true;
            call.resolve();
            return;
        }
        boolean testMode = Boolean.TRUE.equals(call.getBoolean("testMode", true));
        InitializationConfiguration configuration =
            new InitializationConfiguration.Builder(gameId).withTestMode(testMode).build();
        UnityAds.initialize(configuration, error -> {
            if (error == null) {
                initialized = true;
                call.resolve();
            } else {
                call.reject(error.getMessage());
            }
        });
    }

    @PluginMethod
    public void setPrivacy(PluginCall call) {
        Boolean consent = call.getBoolean("userConsent");
        Boolean optOut = call.getBoolean("userOptOut");
        Boolean nonBehavioral = call.getBoolean("nonBehavioral");
        if (consent != null) UnityAds.setUserConsent(consent);
        if (optOut != null) UnityAds.setUserOptOut(optOut);
        if (nonBehavioral != null) UnityAds.setNonBehavioral(nonBehavioral);
        call.resolve();
    }

    @PluginMethod
    public void prepareInterstitial(PluginCall call) {
        String id = placement(call);
        if (id.isEmpty()) return;
        if (!initialized) { call.reject("Unity Ads is not initialized"); return; }
        if (interstitial != null) { call.resolve(); return; }
        if (interstitialLoading) { call.reject("Interstitial load is already running"); return; }
        interstitialLoading = true;
        InterstitialAd.load(new LoadConfiguration.Builder(id).build(), (ad, error) -> {
            interstitialLoading = false;
            if (ad == null || error != null) { call.reject(error == null ? "No interstitial fill" : error.getMessage()); return; }
            interstitial = ad;
            ad.setOnAdExpired(expired -> { if (interstitial == expired) interstitial = null; });
            call.resolve();
        });
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        InterstitialAd ad = interstitial;
        if (ad == null) { call.reject("Interstitial is not loaded"); return; }
        interstitial = null;
        getActivity().runOnUiThread(() -> ad.show(getActivity(), new ShowConfiguration.Builder().build(), new InterstitialShowListener() {
            @Override public void onStarted(InterstitialAd current) { emit("interstitialAdShowed"); }
            @Override public void onClicked(InterstitialAd current) { emit("interstitialAdClicked"); }
            @Override public void onCompleted(InterstitialAd current, ShowFinishState state) {
                emit("interstitialAdDismissed");
                call.resolve();
            }
            @Override public void onFailed(InterstitialAd current, UnityAdsError error) {
                emitError("interstitialAdFailedToShow", error);
                call.reject(error.getMessage());
            }
        }));
    }

    @PluginMethod
    public void prepareRewardVideoAd(PluginCall call) {
        String id = placement(call);
        if (id.isEmpty()) return;
        if (!initialized) { call.reject("Unity Ads is not initialized"); return; }
        if (rewarded != null) { call.resolve(); return; }
        if (rewardedLoading) { call.reject("Rewarded load is already running"); return; }
        rewardedLoading = true;
        RewardedAd.load(new LoadConfiguration.Builder(id).build(), (ad, error) -> {
            rewardedLoading = false;
            if (ad == null || error != null) { call.reject(error == null ? "No rewarded fill" : error.getMessage()); return; }
            rewarded = ad;
            ad.setOnAdExpired(expired -> { if (rewarded == expired) rewarded = null; });
            call.resolve();
        });
    }

    @PluginMethod
    public void showRewardVideoAd(PluginCall call) {
        RewardedAd ad = rewarded;
        if (ad == null) { call.reject("Rewarded ad is not loaded"); return; }
        rewarded = null;
        getActivity().runOnUiThread(() -> ad.show(getActivity(), new ShowConfiguration.Builder().build(), new RewardedShowListener() {
            private boolean earned;
            @Override public void onStarted(RewardedAd current) { emit("onRewardedVideoAdShowed"); }
            @Override public void onClicked(RewardedAd current) { emit("onRewardedVideoAdClicked"); }
            @Override public void onRewarded(RewardedAd current) {
                if (earned) return;
                earned = true;
            }
            @Override public void onCompleted(RewardedAd current, ShowFinishState state) {
                boolean completed = state == ShowFinishState.COMPLETED;
                if (earned && completed) {
                    JSObject reward = new JSObject();
                    reward.put("completed", true);
                    emit("onRewardedVideoAdReward", reward);
                }
                JSObject dismissal = new JSObject();
                dismissal.put("completed", completed);
                dismissal.put("earned", earned);
                emit("onRewardedVideoAdDismissed", dismissal);
                call.resolve();
            }
            @Override public void onFailed(RewardedAd current, UnityAdsError error) {
                emitError("onRewardedVideoAdFailedToShow", error);
                call.reject(error.getMessage());
            }
        }));
    }

    @PluginMethod
    public void showBanner(PluginCall call) {
        String id = placement(call);
        if (id.isEmpty()) return;
        if (!initialized) { call.reject("Unity Ads is not initialized"); return; }
        if (banner != null && bannerContainer != null) {
            getActivity().runOnUiThread(() -> bannerContainer.setVisibility(View.VISIBLE));
            call.resolve();
            return;
        }
        BannerShowListener showListener = new BannerShowListener() {
            @Override public void onImpression(BannerAd current) { emit("bannerAdImpression"); }
            @Override public void onClicked(BannerAd current) { emit("bannerAdClicked"); }
            @Override public void onFailedToShow(BannerAd current, UnityAdsError error) {
                emitError("bannerAdFailedToLoad", error);
            }
        };
        BannerConfiguration config = new BannerConfiguration.Builder(id, new BannerSize(320, 50), showListener).build();
        BannerAd.load(config, (ad, error) -> {
            if (ad == null || error != null) {
                emitError("bannerAdFailedToLoad", error);
                call.reject(error == null ? "No banner fill" : error.getMessage());
                return;
            }
            banner = ad;
            ad.setOnAdExpired(expired -> {
                if (banner != expired) return;
                getActivity().runOnUiThread(() -> {
                    if (bannerContainer != null && bannerContainer.getParent() instanceof FrameLayout)
                        ((FrameLayout) bannerContainer.getParent()).removeView(bannerContainer);
                    bannerContainer = null;
                    banner = null;
                    JSObject info = new JSObject();
                    info.put("message", "Banner expired");
                    notifyListeners("bannerAdFailedToLoad", info);
                });
            });
            getActivity().runOnUiThread(() -> {
                FrameLayout root = getActivity().findViewById(android.R.id.content);
                bannerContainer = new FrameLayout(getActivity());
                bannerContainer.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                int height = Math.round(50 * getActivity().getResources().getDisplayMetrics().density);
                FrameLayout.LayoutParams containerParams =
                    new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, height, Gravity.BOTTOM);
                root.addView(bannerContainer, containerParams);
                bannerContainer.addView(ad.getView(), new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.MATCH_PARENT, Gravity.CENTER));
                JSObject size = new JSObject();
                size.put("height", 50);
                notifyListeners("bannerAdSizeChanged", size);
                emit("bannerAdLoaded");
                call.resolve();
            });
        });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (bannerContainer != null) bannerContainer.setVisibility(View.GONE);
            call.resolve();
        });
    }

    @PluginMethod
    public void resumeBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (bannerContainer == null) call.reject("Banner is not loaded");
            else { bannerContainer.setVisibility(View.VISIBLE); call.resolve(); }
        });
    }

    @PluginMethod
    public void removeBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (bannerContainer != null && bannerContainer.getParent() instanceof FrameLayout)
                ((FrameLayout) bannerContainer.getParent()).removeView(bannerContainer);
            bannerContainer = null;
            banner = null;
            call.resolve();
        });
    }
}
