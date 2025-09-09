declare module '@revenuecat/purchases-capacitor' {
  export interface PurchasesConfiguration {
    apiKey: string;
  }

  export interface CustomerInfo {
    originalAppUserId: string;
    activeSubscriptions: string[];
    allPurchasedProductIdentifiers: string[];
  }

  export interface Product {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    currencyCode: string;
  }

  export interface Package {
    product: Product;
    identifier: string;
  }

  export interface Offering {
    availablePackages: Package[];
    identifier: string;
  }

  export interface Offerings {
    current: Offering | null;
  }

  export interface PurchaseResult {
    customerInfo: CustomerInfo;
  }

  export class Purchases {
    static configure(config: PurchasesConfiguration): Promise<void>;
    static getCustomerInfo(): Promise<CustomerInfo>;
    static getOfferings(): Promise<Offerings>;
    static purchasePackage(options: { aPackage: Package }): Promise<PurchaseResult>;
    static restorePurchases(): Promise<CustomerInfo>;
  }
}
