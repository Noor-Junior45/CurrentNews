import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdOptions,
  BannerAdSize,
  BannerAdPosition,
  BannerAdPluginEvents,
  InterstitialAdPluginEvents,
  AdMobInitializationOptions,
  AdOptions,
  NativeAdFeed,
  NativeAdTemplate,
} from '@capacitor-community/admob';

// =========================================================================
// GOOGLE ADMOB HARDCODED PRODUCTION CONFIGURATION
// =========================================================================

// 1. Publisher ID
export const ADMOB_PUBLISHER_ID = 'pub-5865716270182311';

// 2. AdMob App ID (Current News: News & Feed)
export const ADMOB_APP_ID = 'ca-app-pub-5865716270182311~4645476456';

// 3. FIRST AD UNIT: Adaptive Banner (CurrentNews_Bottom_Banner)
export const ADMOB_BANNER_ID = 'ca-app-pub-5865716270182311/2031114923';

// 4. SECOND AD UNIT: Interstitial Ad Unit (currentnews_Interstitial)
export const ADMOB_INTERSTITIAL_ID = 'ca-app-pub-5865716270182311/2535355843';

// 5. THIRD AD UNIT: Native Advanced (currentnew_native for inside articles & feed)
export const ADMOB_NATIVE_ID = 'ca-app-pub-5865716270182311/1743128281';

// Google Official Safe Test IDs (automatically used if a production ID is absent/placeholder)
export const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
export const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
export const TEST_NATIVE_ID = 'ca-app-pub-3940256099942544/2247696110';

const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000; // Minimum 3 minutes between interstitials
const INTERSTITIAL_MIN_QUALIFIED_READS = 2; // Never show on 1st article; show after 2nd+ completed article transition
const INTERSTITIAL_RETRY_BACKOFF_MS = 60 * 1000; // Wait 60s before re-requesting after failed load

class AdMobManager {
  private initialized = false;
  private bannerVisible = false;
  private initializingPromise: Promise<boolean> | null = null;
  private nativeFeed: NativeAdFeed | null = null;
  private nativeFeedPromise: Promise<NativeAdFeed | null> | null = null;

  private interstitialListenersRegistered = false;
  private interstitialLoaded = false;
  private interstitialShowing = false;
  private interstitialPreparingPromise: Promise<boolean> | null = null;
  private lastInterstitialShownAt = 0;
  private lastInterstitialLoadAttemptAt = 0;
  private qualifiedArticleTransitions = 0;
  private reloadTimeoutId: ReturnType<typeof setTimeout> | null = null;

  public isNative(): boolean {
    return Capacitor.isNativePlatform() && (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios');
  }

  private isNonPersonalizedAds(): boolean {
    try {
      return localStorage.getItem('google_ads_personalized_consent') !== 'granted';
    } catch {
      return true;
    }
  }

  private resolveInterstitialAdConfig(customAdId?: string): { adId: string; isTesting: boolean } {
    const hasProductionInterstitial = Boolean(
      ADMOB_INTERSTITIAL_ID &&
      !ADMOB_INTERSTITIAL_ID.includes('YYYYYYYYYY') &&
      !ADMOB_INTERSTITIAL_ID.includes('XXXXXXXXXX')
    );
    const adId = customAdId || (hasProductionInterstitial ? ADMOB_INTERSTITIAL_ID : TEST_INTERSTITIAL_ID);
    const isTesting = !customAdId && !hasProductionInterstitial;
    return { adId, isTesting };
  }

  private registerInterstitialListeners(): void {
    if (this.interstitialListenersRegistered) return;
    this.interstitialListenersRegistered = true;

    AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
      this.interstitialLoaded = true;
      console.debug('[AdMob] Interstitial preloaded and ready.');
    });

    AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (err) => {
      this.interstitialLoaded = false;
      console.debug('[AdMob] Interstitial failed to load:', err);
    });

    AdMob.addListener(InterstitialAdPluginEvents.Showed, () => {
      this.interstitialShowing = true;
      this.interstitialLoaded = false;
      this.lastInterstitialShownAt = Date.now();
    });

    AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (err) => {
      this.interstitialShowing = false;
      this.interstitialLoaded = false;
      console.debug('[AdMob] Interstitial failed to show:', err);
      this.scheduleNextInterstitialPreload(15000);
    });

    AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
      this.interstitialShowing = false;
      this.interstitialLoaded = false;
      // Quietly pre-cache the next interstitial after user returns to content
      this.scheduleNextInterstitialPreload(2500);
    });
  }

  private scheduleNextInterstitialPreload(delayMs: number): void {
    if (!this.isNative()) return;
    if (this.reloadTimeoutId) {
      clearTimeout(this.reloadTimeoutId);
    }
    this.reloadTimeoutId = setTimeout(() => {
      this.reloadTimeoutId = null;
      void this.preloadInterstitial();
    }, delayMs);
  }

  public async initialize(): Promise<boolean> {
    if (!this.isNative()) {
      return false;
    }
    if (this.initialized) {
      return true;
    }
    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      try {
        const isTesting = !ADMOB_BANNER_ID || ADMOB_BANNER_ID.includes('XXXXXXXXXX');
        const options: AdMobInitializationOptions = {
          initializeForTesting: isTesting,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        };

        await AdMob.initialize(options);

        // Setup banner lifecycle listeners
        AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
          this.bannerVisible = true;
          console.debug('[AdMob] Native Banner loaded successfully.');
        });

        AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
          this.bannerVisible = false;
          console.debug('[AdMob] Native Banner failed to load:', err);
        });

        // Setup interstitial lifecycle listeners & warm-cache first interstitial
        this.registerInterstitialListeners();

        this.initialized = true;
        this.scheduleNextInterstitialPreload(2000);
        return true;
      } catch (err) {
        console.warn('[AdMob] Initialization skipped or handled:', err);
        return false;
      } finally {
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  public async showBanner(customAdId?: string, position = BannerAdPosition.BOTTOM_CENTER): Promise<void> {
    if (!this.isNative()) return;

    try {
      const ok = await this.initialize();
      if (!ok) return;

      const hasProductionBanner = ADMOB_BANNER_ID && !ADMOB_BANNER_ID.includes('XXXXXXXXXX');
      const adId = customAdId || (hasProductionBanner ? ADMOB_BANNER_ID : TEST_BANNER_ID);

      const options: BannerAdOptions = {
        adId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position,
        margin: 0,
        isTesting: !hasProductionBanner,
        npa: this.isNonPersonalizedAds(),
      };

      await AdMob.showBanner(options);
      this.bannerVisible = true;
    } catch (err) {
      console.debug('[AdMob] Show banner handled cleanly:', err);
    }
  }

  public async hideBanner(): Promise<void> {
    if (!this.isNative() || !this.initialized) return;

    try {
      await AdMob.hideBanner();
      this.bannerVisible = false;
    } catch (err) {
      console.debug('[AdMob] Hide banner handled:', err);
    }
  }

  public async removeBanner(): Promise<void> {
    if (!this.isNative() || !this.initialized) return;

    try {
      await AdMob.removeBanner();
      this.bannerVisible = false;
    } catch (err) {
      console.debug('[AdMob] Remove banner handled:', err);
    }
  }

  /**
   * Preloads an interstitial silently in the background so showing it on a natural
   * transition never stalls navigation or blocks user interaction.
   */
  public async preloadInterstitial(customAdId?: string): Promise<boolean> {
    if (!this.isNative()) return false;
    if (this.interstitialLoaded) return true;
    if (this.interstitialPreparingPromise) return this.interstitialPreparingPromise;

    const now = Date.now();
    if (this.lastInterstitialLoadAttemptAt > 0 && now - this.lastInterstitialLoadAttemptAt < INTERSTITIAL_RETRY_BACKOFF_MS) {
      return false;
    }

    this.interstitialPreparingPromise = (async () => {
      try {
        const ok = await this.initialize();
        if (!ok) return false;
        this.registerInterstitialListeners();

        this.lastInterstitialLoadAttemptAt = Date.now();
        const { adId, isTesting } = this.resolveInterstitialAdConfig(customAdId);
        const options: AdOptions = {
          adId,
          isTesting,
          npa: this.isNonPersonalizedAds(),
        };

        await AdMob.prepareInterstitial(options);
        this.interstitialLoaded = true;
        return true;
      } catch (err) {
        this.interstitialLoaded = false;
        console.debug('[AdMob] Interstitial preload handled:', err);
        return false;
      } finally {
        this.interstitialPreparingPromise = null;
      }
    })();

    return this.interstitialPreparingPromise;
  }

  /**
   * Displays an already-preloaded interstitial only if cooldown and UI-safety checks pass.
   * Never blocks navigation if no ad is ready.
   */
  public async showPreloadedInterstitialIfReady(customAdId?: string): Promise<boolean> {
    if (!this.isNative()) return false;

    const now = Date.now();
    if (this.interstitialShowing) return false;
    if (this.lastInterstitialShownAt > 0 && now - this.lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) {
      return false;
    }

    if (!this.interstitialLoaded) {
      void this.preloadInterstitial(customAdId);
      return false;
    }

    try {
      const { adId } = this.resolveInterstitialAdConfig(customAdId);
      this.interstitialShowing = true;
      await AdMob.showInterstitial({ adId });
      this.interstitialLoaded = false;
      this.lastInterstitialShownAt = Date.now();
      return true;
    } catch (err) {
      this.interstitialShowing = false;
      this.interstitialLoaded = false;
      console.debug('[AdMob] Show preloaded interstitial handled:', err);
      this.scheduleNextInterstitialPreload(15000);
      return false;
    }
  }

  /**
   * Records a qualified post-reading navigation transition (leaving an article after reading)
   * and shows a preloaded interstitial strictly between content screens with frequency capping.
   */
  public async recordArticleTransitionAndMaybeShowInterstitial(): Promise<boolean> {
    if (!this.isNative()) return false;

    this.qualifiedArticleTransitions += 1;

    // Never show on app launch or first article; wait until 2+ completed reads
    if (this.qualifiedArticleTransitions < INTERSTITIAL_MIN_QUALIFIED_READS) {
      void this.preloadInterstitial();
      return false;
    }

    return this.showPreloadedInterstitialIfReady();
  }

  public async prepareAndShowInterstitial(customAdId?: string): Promise<void> {
    if (!this.isNative()) return;

    try {
      const shownImmediately = await this.showPreloadedInterstitialIfReady(customAdId);
      if (shownImmediately) return;

      const ok = await this.preloadInterstitial(customAdId);
      if (ok) {
        await this.showPreloadedInterstitialIfReady(customAdId);
      }
    } catch (err) {
      console.debug('[AdMob] Interstitial handled:', err);
    }
  }

  public async getNativeFeed(): Promise<NativeAdFeed | null> {
    if (!this.isNative()) return null;
    if (this.nativeFeed) return this.nativeFeed;
    if (this.nativeFeedPromise) return this.nativeFeedPromise;

    this.nativeFeedPromise = (async () => {
      try {
        await this.initialize();
        const hasProductionNative = ADMOB_NATIVE_ID && !ADMOB_NATIVE_ID.includes('XXXXXXXXXX');
        const adId = hasProductionNative ? ADMOB_NATIVE_ID : TEST_NATIVE_ID;

        this.nativeFeed = await NativeAdFeed.create({
          feedId: 'currentnews-native-ads',
          adId,
          template: NativeAdTemplate.Medium,
          isTesting: !hasProductionNative,
        });

        return this.nativeFeed;
      } catch (err) {
        console.warn('[AdMob] NativeAdFeed initialization handled:', err);
        return null;
      } finally {
        this.nativeFeedPromise = null;
      }
    })();

    return this.nativeFeedPromise;
  }

  public async attachNativeAd(slotKey: string, element: HTMLElement): Promise<void> {
    if (!this.isNative() || !element) return;
    try {
      const feed = await this.getNativeFeed();
      if (feed) {
        feed.attach(slotKey, element);
      }
    } catch (err) {
      console.debug('[AdMob] attachNativeAd handled:', err);
    }
  }

  public detachNativeAd(element: HTMLElement): void {
    if (!this.isNative() || !element || !this.nativeFeed) return;
    try {
      this.nativeFeed.detach(element);
    } catch (err) {
      console.debug('[AdMob] detachNativeAd handled:', err);
    }
  }
}

export const admobManager = new AdMobManager();

