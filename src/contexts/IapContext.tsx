/**
 * IapContext — Global IAP connection + purchase listener.
 *
 * Must wrap the entire app so that the purchaseUpdatedListener is registered
 * before any purchase can complete. Registering inside PaywallScreen alone
 * can miss StoreKit callbacks that arrive before the screen mounts.
 *
 * Two purchase scenarios handled:
 *  1. App startup — StoreKit replays unfinished pending transactions.
 *     These are processed silently: verify if possible, always finishTransaction.
 *     NO alert on failure (the user didn't just tap "Buy").
 *  2. User-initiated purchase — flagged via `markUserInitiatedPurchase()`.
 *     On failure, show an alert so the user knows to retry / contact support.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform, Alert } from 'react-native';
import type { Purchase } from 'expo-iap';
import { supabase } from '../lib/supabase';
import {
  ensureIapConnection,
  onPurchaseUpdated,
  onPurchaseError,
  completePurchase,
  verifyApplePurchase,
  verifyGooglePurchase,
  IAP_SKUS,
} from '../lib/iap';

type IapContextValue = {
  /** True once initConnection() has succeeded */
  connected: boolean;
  /** Call this when a purchase completes successfully (set by PaywallScreen) */
  onPurchaseSuccess: React.MutableRefObject<(() => void) | null>;
  /** Call this when a purchase fails (set by PaywallScreen) */
  onPurchaseFailure: React.MutableRefObject<((err: string) => void) | null>;
  /** PaywallScreen calls this before requestPurchase() to flag user intent */
  markUserInitiatedPurchase: () => void;
};

const IapContext = createContext<IapContextValue>({
  connected: false,
  onPurchaseSuccess: { current: null },
  onPurchaseFailure: { current: null },
  markUserInitiatedPurchase: () => {},
});

export function useIapContext() {
  return useContext(IapContext);
}

export function IapProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);

  // Refs so PaywallScreen can plug in callbacks without re-registering listeners
  const onPurchaseSuccess = useRef<(() => void) | null>(null);
  const onPurchaseFailure = useRef<((err: string) => void) | null>(null);

  // True only when the user just tapped "Subscribe" — cleared after each purchase event
  const userInitiated = useRef(false);

  function markUserInitiatedPurchase() {
    userInitiated.current = true;
  }

  useEffect(() => {
    // Connect once on app start
    ensureIapConnection().then((ok) => {
      setConnected(ok);
      if (!ok) {
        console.warn('[IAP] initConnection failed — purchases unavailable');
      }
    });

    // ── Global purchase listener ────────────────────────────────────────
    const purchaseSub = onPurchaseUpdated(async (purchase: Purchase) => {
      const txId = (purchase as any).transactionId ?? (purchase as any).id ?? 'unknown';
      const wasUserInitiated = userInitiated.current;
      // Reset immediately so the next event starts clean
      userInitiated.current = false;

      console.log(
        '[IAP] purchaseUpdated:', txId,
        'platform:', Platform.OS,
        'userInitiated:', wasUserInitiated,
      );

      // Wait for session (AsyncStorage is async — may not be ready at app start)
      let session = null;
      for (let i = 0; i < 10; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          session = data.session;
          break;
        }
        console.log(`[IAP] Session not ready, retrying (${i + 1}/10)...`);
        await new Promise((r) => setTimeout(r, 500));
      }

      if (!session?.access_token) {
        console.warn('[IAP] No session — finishing transaction silently');
        // Must still finish the transaction so StoreKit doesn't replay forever
        await completePurchase(purchase, false).catch(() => {});
        if (wasUserInitiated) {
          onPurchaseFailure.current?.('Not authenticated');
        }
        return;
      }

      try {
        const authHeaders = { Authorization: `Bearer ${session.access_token}` };

        if (Platform.OS === 'android') {
          const purchaseToken =
            (purchase as any).purchaseToken ?? (purchase as any).dataAndroid;
          const productId = (purchase as any).productId ?? IAP_SKUS.PREMIUM_MONTHLY;
          if (!purchaseToken) throw new Error('Missing purchaseToken (Android)');
          await verifyGooglePurchase(purchaseToken, productId, authHeaders);
          await completePurchase(purchase, false);
        } else {
          // StoreKit 2: purchaseToken is JWS signed transaction
          const jwsToken =
            (purchase as any).purchaseToken ??
            (purchase as any).jws ??
            '';
          const transactionId =
            (purchase as any).transactionId ??
            (purchase as any).id ??
            '';
          if (!jwsToken && !transactionId) {
            throw new Error('Missing purchaseToken/transactionId (iOS)');
          }
          await verifyApplePurchase(jwsToken, transactionId, authHeaders);
          await completePurchase(purchase, false);
        }

        console.log('[IAP] Purchase verified and completed ✓');
        onPurchaseSuccess.current?.();
      } catch (err: any) {
        const msg = err?.message ?? 'Activation failed';
        console.error('[IAP] Purchase processing failed:', msg);

        // Always finish the transaction to prevent infinite StoreKit replay
        await completePurchase(purchase, false).catch(() => {});

        if (wasUserInitiated) {
          // User just tapped Buy — show alert
          onPurchaseFailure.current?.(msg);
          Alert.alert(
            'Purchase Error',
            'Payment received but activation failed. Please restart the app or contact support.',
          );
        } else {
          // Background/startup replay — silent, no alert
          console.warn('[IAP] Background purchase replay failed silently:', msg);
        }
      }
    });

    const errorSub = onPurchaseError((error) => {
      console.error('[IAP] Purchase error:', error.code, error.message);
      userInitiated.current = false;
      if (error.code !== 'E_USER_CANCELLED' && (error as any).code !== 'user-cancelled') {
        onPurchaseFailure.current?.(error.message ?? 'Purchase failed');
      } else {
        // User cancelled — just reset button, no alert
        onPurchaseFailure.current?.('cancelled');
      }
    });

    return () => {
      purchaseSub.remove();
      errorSub.remove();
    };
  }, []);

  return (
    <IapContext.Provider value={{ connected, onPurchaseSuccess, onPurchaseFailure, markUserInitiatedPurchase }}>
      {children}
    </IapContext.Provider>
  );
}
