import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  type Purchase,
  type Product,
} from 'expo-iap';

// ─── Product IDs (must match App Store Connect) ──────────────────────────
export const IAP_SKUS = {
  PREMIUM_MONTHLY: 'com.nextsport.app.premium.monthly',
} as const;

export const IAP_PRODUCT_IDS = Object.values(IAP_SKUS);

// ─── Connection State ────────────────────────────────────────────────────
let connected = false;
let connectionPromise: Promise<boolean> | null = null;

export function isIapConnected(): boolean {
  return connected;
}

/**
 * Initialize IAP connection. Safe to call multiple times — only connects once.
 * Must be called before any other IAP operations.
 */
export async function ensureIapConnection(): Promise<boolean> {
  if (!Platform.select({ ios: true, android: true, default: false })) {
    console.log('[IAP] Unsupported platform, skipping');
    return false;
  }

  if (connected) {
    return true;
  }

  // Prevent duplicate connection attempts
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    try {
      const result = await initConnection();
      connected = result;
      console.log('[IAP] Connection initialized:', result);
      return result;
    } catch (error) {
      console.error('[IAP] initConnection failed:', error);
      connected = false;
      return false;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Clean up IAP connection.
 */
export async function closeIapConnection(): Promise<void> {
  if (!connected) return;
  try {
    await endConnection();
  } catch (error) {
    console.error('[IAP] endConnection failed:', error);
  } finally {
    connected = false;
  }
}

// ─── Product Fetching ────────────────────────────────────────────────────
export async function fetchIapProducts(): Promise<Product[]> {
  try {
    // type: 'subs' is required for subscription products — omitting it defaults
    // to 'in-app' which returns an empty array for subscriptions on iOS.
    const products = await fetchProducts({ skus: IAP_PRODUCT_IDS, type: 'subs' });
    return (Array.isArray(products) ? products : products ? [products] : []) as Product[];
  } catch (error) {
    console.error('[IAP] fetchProducts failed:', error);
    return [];
  }
}

// ─── Purchase Flow ───────────────────────────────────────────────────────

/**
 * Start a subscription purchase.
 * The result is delivered via purchaseUpdatedListener — the return value is the
 * initial dispatch response and may be null.
 */
export async function purchaseProduct(sku: string): Promise<Purchase | Purchase[] | null> {
  return requestPurchase({
    request: {
      apple: { sku },
    },
    type: 'subs',
  });
}

export async function completePurchase(
  purchase: Purchase,
  isConsumable: boolean = false,
): Promise<void> {
  try {
    await finishTransaction({ purchase, isConsumable });
  } catch (error) {
    console.error('[IAP] finishTransaction failed:', error);
  }
}

// ─── Event Listeners ─────────────────────────────────────────────────────
export function onPurchaseUpdated(callback: (purchase: Purchase) => void) {
  return purchaseUpdatedListener(callback);
}

export function onPurchaseError(callback: (error: { code?: string; message: string; debugMessage?: string | null }) => void) {
  return purchaseErrorListener(callback as any);
}