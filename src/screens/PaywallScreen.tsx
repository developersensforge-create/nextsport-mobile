import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  ensureIapConnection,
  fetchIapProducts,
  purchaseProduct,
  completePurchase,
  onPurchaseUpdated,
  onPurchaseError,
  IAP_SKUS,
  isIapConnected,
  verifyGooglePurchase,
} from '../lib/iap';
import type { Product, Purchase } from 'expo-iap';
import { supabase } from '../lib/supabase';

type PaywallNavProp = StackNavigationProp<RootStackParamList, 'Paywall'>;

type ProductInfo = {
  productId: string;
  localizedPrice: string;
  price: string;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'loaded'; product: ProductInfo }
  | { status: 'error'; message: string }
  | { status: 'purchasing'; product: ProductInfo };


const FEATURES = [
  {
    icon: 'flash',
    title: 'Unlimited Swing Analyses',
    description: 'Analyze as many swings as you want, every week.',
  },
  {
    icon: 'mic',
    title: 'Audio Coaching Feedback',
    description: 'Get personalized audio walkthroughs of your technique.',
  },
  {
    icon: 'trending-up',
    title: 'Progress Tracking',
    description: 'See your score improve over time with detailed history.',
  },
  {
    icon: 'baseball',
    title: 'Advanced Mechanics Analysis',
    description: 'Deeper breakdowns: stance, load, rotation, follow-through.',
  },
  {
    icon: 'people',
    title: 'Priority Support',
    description: 'Get help from our team faster than free users.',
  },
];

function productToInfo(p: Product): ProductInfo {
  return {
    productId: p.id || IAP_SKUS.PREMIUM_MONTHLY,
    localizedPrice: (p as any).localizedPrice || (p as any).displayPrice || '$14.99',
    price: (p as any).price || '$14.99',
  };
}

export default function PaywallScreen() {
  const navigation = useNavigation<PaywallNavProp>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  // ── Load IAP products on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Ensure IAP connection first
      const ok = await ensureIapConnection();
      if (!ok) {
        if (!cancelled) setState({ status: 'error', message: 'Store connection failed. Please try again later.' });
        return;
      }

      const products = await fetchIapProducts();
      if (cancelled) return;

      const premium = products.find((p) => p.id === IAP_SKUS.PREMIUM_MONTHLY);
      if (premium) {
        setState({ status: 'loaded', product: productToInfo(premium) });
      } else {
        // Fallback: show hardcoded price if StoreKit products aren't available yet
        setState({
          status: 'loaded',
          product: { productId: IAP_SKUS.PREMIUM_MONTHLY, localizedPrice: '$14.99', price: '$14.99' },
        });
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Listen for purchase updates/errors ──────────────────────────────
  useEffect(() => {
    const purchaseSub = onPurchaseUpdated(async (purchase: Purchase) => {
      console.log('[Paywall] Purchase updated:', (purchase as any).transactionId, 'platform:', Platform.OS);
      try {
        if (Platform.OS === 'android') {
          // Android: verify with Google Play backend, then finish transaction
          const purchaseToken = (purchase as any).purchaseToken ?? (purchase as any).dataAndroid;
          const productId = (purchase as any).productId ?? IAP_SKUS.PREMIUM_MONTHLY;

          if (!purchaseToken) {
            throw new Error('Missing purchaseToken in Android purchase');
          }

          // Get auth headers
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error('Not authenticated');
          const authHeaders = { Authorization: `Bearer ${session.access_token}` };

          // Verify with backend (activates premium + grants tokens)
          await verifyGooglePurchase(purchaseToken, productId, authHeaders);

          // Acknowledge the purchase (required by Google within 3 days)
          await completePurchase(purchase, false);

        } else {
          // iOS: finish transaction (Apple receipt verified separately via webhook)
          await completePurchase(purchase, false);
        }
      } catch (err) {
        console.error('[Paywall] purchase processing failed:', err);
      }
      Alert.alert('Purchase Complete', 'Your premium subscription is now active!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    });

    const errorSub = onPurchaseError((error) => {
      console.error('[Paywall] Purchase error:', error.code, error.message);
      setState((prev) => {
        if (prev.status === 'purchasing') {
          return { status: 'loaded', product: prev.product };
        }
        return prev;
      });
      // E_USER_CANCELLED is not an error to show
      if (error.code !== 'E_USER_CANCELLED') {
        Alert.alert('Purchase Failed', error.message || 'Something went wrong. Please try again.');
      }
    });

    return () => {
      purchaseSub.remove();
      errorSub.remove();
    };
  }, [navigation]);

  // ── Handle subscribe ────────────────────────────────────────────────
  const handleSubscribe = useCallback(async () => {
    if (state.status !== 'loaded') return;

    const product = state.product;
    setState({ status: 'purchasing', product });

    // Re-check connection before purchase
    if (!isIapConnected()) {
      const ok = await ensureIapConnection();
      if (!ok) {
        setState({ status: 'error', message: 'Store connection failed. Please try again later.' });
        return;
      }
    }

    try {
      await purchaseProduct(product.productId);
      // Result handled by purchaseUpdatedListener (both iOS and Android)
    } catch (error: any) {
      console.error('[Paywall] purchaseProduct failed:', error?.code, error?.message, error);
      setState({ status: 'loaded', product });
      const msg = error?.message || error?.debugMessage || 'Could not start purchase. Please try again.';
      Alert.alert('Error', msg);
    }
  }, [state]);

  // ── Handle close ────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    try {
      navigation.goBack();
    } catch (error) {
      console.error('[Paywall] goBack failed:', error);
    }
  }, [navigation]);

  // ── Loading state ───────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.muted} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingText}>Loading offer...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.muted} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.muted} />
          <Text style={styles.errorText}>{state.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleClose}>
            <Text style={styles.retryText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Loaded / Purchasing state ───────────────────────────────────────
  const { product } = state;
  const priceText = product.localizedPrice || '$14.99';
  const isPurchasing = state.status === 'purchasing';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton} disabled={isPurchasing}>
          <Ionicons name="close" size={24} color={isPurchasing ? 'rgba(255,255,255,0.2)' : COLORS.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.starBadge}>
            <Ionicons name="star" size={28} color="#f59e0b" />
          </View>
          <Text style={styles.heroTitle}>Upgrade to{'\n'}Premium</Text>
          <Text style={styles.heroSubtitle}>
            Take your game to the next level with unlimited AI-powered swing coaching.
          </Text>
        </View>

        {/* Pricing badge */}
        <View style={styles.pricingCard}>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{priceText}</Text>
            <Text style={styles.pricePer}>/month</Text>
          </View>
          <Text style={styles.pricingNote}>Cancel anytime. No commitment.</Text>
        </View>

        {/* Features list */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresHeader}>What you get</Text>
          {FEATURES.map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={feature.icon as any} size={20} color={COLORS.accent} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Testimonial */}
        <View style={styles.testimonialCard}>
          <Text style={styles.testimonialText}>
            "My batting average went up 40 points in 3 weeks. The AI coaching is like having a real coach in my pocket."
          </Text>
          <Text style={styles.testimonialAuthor}>— Marcus T., high school varsity</Text>
        </View>

        {/* Subscribe CTA */}
        <TouchableOpacity
          style={[styles.subscribeButton, isPurchasing && styles.subscribeButtonDisabled]}
          onPress={handleSubscribe}
          activeOpacity={0.85}
          disabled={isPurchasing}
        >
          {isPurchasing ? (
            <ActivityIndicator size="small" color="#000" style={{ marginRight: 10 }} />
          ) : (
            <Ionicons name="star" size={20} color="#000" style={{ marginRight: 10 }} />
          )}
          <Text style={styles.subscribeButtonText}>
            {isPurchasing ? 'Processing...' : `Subscribe for ${priceText}/mo`}
          </Text>
        </TouchableOpacity>

        <Text style={styles.legalText}>
          {Platform.OS === 'android'
            ? 'Payment will be charged to your Google Play account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage subscriptions in Google Play → Subscriptions.'
            : 'Payment will be charged to your Apple ID account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage subscriptions in Account Settings.'}
        </Text>

        <TouchableOpacity
          style={styles.noThanksButton}
          onPress={handleClose}
          disabled={isPurchasing}
        >
          <Text style={styles.noThanksText}>Not now</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButton: {
    padding: 8,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 15,
    marginTop: 16,
  },
  errorText: {
    color: COLORS.muted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.muted,
  },
  retryText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  starBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 10,
  },
  heroSubtitle: {
    color: COLORS.muted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  pricingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    color: COLORS.text,
    fontSize: 48,
    fontWeight: '900',
  },
  pricePer: {
    color: COLORS.muted,
    fontSize: 18,
    marginLeft: 6,
  },
  pricingNote: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },
  featuresCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  featuresHeader: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    flexShrink: 0,
  },
  featureText: { flex: 1 },
  featureTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  testimonialCard: {
    backgroundColor: 'rgba(34,197,94,0.06)',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    marginBottom: 24,
  },
  testimonialText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  testimonialAuthor: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  subscribeButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '900',
  },
  legalText: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  noThanksButton: {
    alignItems: 'center',
    padding: 10,
  },
  noThanksText: {
    color: COLORS.muted,
    fontSize: 14,
  },
});