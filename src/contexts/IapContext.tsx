/**
 * IapContext — Global IAP connection + purchase listener.
 *
 * Must wrap the entire app so that the purchaseUpdatedListener is registered
 * before any purchase can complete. Registering inside PaywallScreen alone
 * can miss StoreKit callbacks that arrive before the screen mounts.
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
};

const IapContext = createContext<IapContextValue>({
  connected: false,
  onPurchaseSuccess: { current: null },
  onPurchaseFailure: { current: null },
});

export function useIapContext() {
  return useContext(IapContext);
}

export function IapProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);

  // Refs so PaywallScreen can plug in callbacks without re-registering listeners
  const onPurchaseSuccess = useRef<(() => void) | null>(null);
  const onPurchaseFailure = useRef<((err: string) => void) | null>(null);

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
      console.log(
        '[IAP] purchaseUpdated:',
        (purchase as any).transactionId ?? (purchase as any).id,
        'platform:', Platform.OS,
      );

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');
        const authHeaders = { Authorization: `Bearer ${session.access_token}` };

        if (Platform.OS === 'android') {
          const purchaseToken =
            (purchase as any).purchaseToken ?? (purchase as any).dataAndroid;
          const productId = (purchase as any).productId ?? IAP_SKUS.PREMIUM_MONTHLY;
          if (!purchaseToken) throw new Error('Missing purchaseToken (Android)');
          await verifyGooglePurchase(purchaseToken, productId, authHeaders);
          await completePurchase(purchase, false);
        } else {
          // StoreKit 2: purchaseToken is JWS
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
        console.error('[IAP] Purchase processing failed:', err?.message ?? err);
        onPurchaseFailure.current?.(err?.message ?? 'Activation failed');
        Alert.alert(
          'Purchase Error',
          'Payment received but activation failed. Please restart the app or contact support.',
        );
      }
    });

    const errorSub = onPurchaseError((error) => {
      console.error('[IAP] Purchase error:', error.code, error.message);
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
    <IapContext.Provider value={{ connected, onPurchaseSuccess, onPurchaseFailure }}>
      {children}
    </IapContext.Provider>
  );
}
