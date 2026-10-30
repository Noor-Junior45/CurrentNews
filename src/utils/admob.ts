import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdOptions,
  BannerAdSize,
  BannerAdPosition,
  BannerAdPluginEvents,
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

// 4. SECOND AD UNIT (Optional): Interstitial Ad Unit (full screen between articles)
export const ADMOB_INTERSTITIAL_ID = 'ca-app-pub-5865716270182311/YYYYYYYYYY';

// 5. THIRD AD UNIT: Native Advanced (currentnew_native for inside articles & feed)
export const ADMOB_NATIVE_ID = 'ca-app-pub-5865716270182311/1743128281';

// Google Official Safe Test IDs (automatically used until production IDs are provided)
export const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
export const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
export const TEST_NATIVE_ID = 'ca-app-pub-3940256099942544/2247696110';

class AdMobManager {
  private initialized = false;
  private bannerVisible = false;
  private initializingPromise: Promise<boolean> | null = null;
  private nativeFeed: NativeAdFeed | null = null;
  private nativeFeedPromise: Promise<NativeAdFeed | null> | null = null;

  public isNative(): boolean {
    return Capacitor.isNativePlatform() && (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios');
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

        // Setup lifecycle listeners
        AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
          this.bannerVisible = true;
          console.debug('[AdMob] Native Banner loaded successfully.');
        });

        AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (err) => {
          this.bannerVisible = false;
          console.debug('[AdMob] Native Banner failed to load:', err);
        });

        this.initialized = true;
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

  public async prepareAndShowInterstitial(customAdId?: string): Promise<void> {
    if (!this.isNative()) return;

    try {
      const ok = await this.initialize();
      if (!ok) return;

      const hasProductionInterstitial = ADMOB_INTERSTITIAL_ID && !ADMOB_INTERSTITIAL_ID.includes('YYYYYYYYYY');
      const adId = customAdId || (hasProductionInterstitial ? ADMOB_INTERSTITIAL_ID : TEST_INTERSTITIAL_ID);

      const options: AdOptions = {
        adId,
        isTesting: !hasProductionInterstitial,
      };

      await AdMob.prepareInterstitial(options);
      await AdMob.showInterstitial();
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
