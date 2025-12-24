declare module '@revenuecat/purchases-capacitor' {
  export interface PurchasesConfiguration {
    apiKey: string;
  }

  export interface CustomerInfo {
    originalAppUserId: string;
    activeSubscriptions: string[];
    allPurchasedProductIdentifiers: string[];
    entitlements?: {
      active: Record<string, any>;
      all: Record<string, any>;
    };
  }

  export interface Product {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    currencyCode: string;
    price: number;
  }

  export interface Package {
    product: Product;
    identifier: string;
    packageType: string;
  }

  export interface Offering {
    availablePackages: Package[];
    identifier: string;
  }

  export interface Offerings {
    current: Offering | null;
    all: Record<string, Offering>;
  }

  export interface PurchaseResult {
    customerInfo: CustomerInfo;
    productIdentifier: string;
  }

  export class Purchases {
    static configure(config: PurchasesConfiguration): Promise<void>;
    static getCustomerInfo(): Promise<CustomerInfo>;
    static getOfferings(): Promise<Offerings>;
    static purchasePackage(options: { aPackage: Package }): Promise<PurchaseResult>;
    static restorePurchases(): Promise<CustomerInfo>;
    static logIn(options: { appUserID: string }): Promise<{ customerInfo: CustomerInfo; created: boolean }>;
    static logOut(): Promise<CustomerInfo>;
  }
}
