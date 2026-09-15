declare module '@capacitor-community/admob' {
  export interface AdMobInitializationOptions {
    testingDevices?: string[];
    initializeForTesting?: boolean;
  }

  export interface RewardVideoAdOptions {
    adId: string;
    isTesting?: boolean;
  }

  export enum RewardAdPluginEvents {
    Dismissed = 'dismissed',
    FailedToShow = 'failedToShow',
    Rewarded = 'rewarded'
  }

  export interface AdMob {
    initialize(options: AdMobInitializationOptions): Promise<void>;
    prepareRewardVideoAd(options: RewardVideoAdOptions): Promise<void>;
    showRewardVideoAd(): Promise<void>;
    addListener(event: string, callback: (data?: any) => void): Promise<{ remove(): void }>;
  }

  export const AdMob: AdMob;
  export { RewardAdPluginEvents };
}
