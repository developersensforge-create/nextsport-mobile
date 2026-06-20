import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import {
  getProducts,
  requestSubscription,
  getAvailablePurchases,
  finishTransaction,
  type ProductIOS,
  type SubscriptionIOS,
  type PurchaseError,
} from 'expo-iap';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { getAuthHeaders } from '../lib/api';

type PaywallNavProp = StackNavigationProp<RootStackParamList, 'Paywall'>;

const BASE_URL = 'https://nextsport-sensforge.vercel.app';
const PRODUCT_ID = 'nextsport';

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

export default function PaywallScreen() {
  const navigation = useNavigation<PaywallNavProp>();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [product, setProduct] = useState<ProductIOS | SubscriptionIOS | null>(null);

  useEffect(() => {
    loadProduct();
  }, []);

  async function loadProduct() {
    try {
      const products = await getProducts({ skus: [PRODUCT_ID] });
      if (products && products.length > 0) {
        setProduct(products[0]);
      }
    } catch (err) {
      // Non-fatal: fall back to hardcoded price copy
      console.warn('IAP product load failed:', err);
    }
  }

  async function verifyWithBackend(transactionId: string, receiptData: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE_URL}/api/apple/verify-receipt`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_id: transactionId,
        receipt_data: receiptData,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Receipt verification failed');
    }
    return res.json();
  }

  async function handleSubscribe() {
    if (Platform.OS !== 'ios') {
      Alert.alert('iOS Only', 'Apple subscriptions are available on iPhone and iPad only.');
      return;
    }
    setLoading(true);
    try {
      const purchase = await requestSubscription({ sku: PRODUCT_ID });
      if (purchase) {
        const transactionId = purchase.transactionId ?? '';
        const receiptData =
          (purchase as any).transactionReceipt ?? (purchase as any).originalJson ?? '';
        await verifyWithBackend(transactionId, receiptData);
        await finishTransaction({ purchase, isConsumable: false });
        Alert.alert(
          'Welcome to Premium! 🎉',
          'Your subscription is active. Unlimited swing analyses and AI coaching are now unlocked.',
          [{ text: 'Let\'s Go', onPress: () => navigation.goBack() }]
        );
      }
    } catch (err: any) {
      const purchaseError = err as PurchaseError;
      if (purchaseError?.code === 'E_USER_CANCELLED') {
        // User cancelled — no alert needed
        return;
      }
      Alert.alert(
        'Purchase Failed',
        purchaseError?.message || 'Could not complete your purchase. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const purchases = await getAvailablePurchases();
      const premium = purchases?.find((p) => p.productId === PRODUCT_ID);
      if (premium) {
        const transactionId = premium.transactionId ?? '';
        const receiptData =
          (premium as any).transactionReceipt ?? (premium as any).originalJson ?? '';
        await verifyWithBackend(transactionId, receiptData);
        Alert.alert(
          'Subscription Restored',
          'Your Premium subscription has been restored.',
          [{ text: 'Great', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert(
          'No Subscription Found',
          'We couldn\'t find an active Premium subscription linked to your Apple ID.'
        );
      }
    } catch (err: any) {
      Alert.alert('Restore Failed', err?.message || 'Could not restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  }

  // Prefer live price from App Store; fallback to hardcoded
  const priceDisplay =
    (product as any)?.localizedPrice ?? '$14.99';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={COLORS.muted} />
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
            <Text style={styles.price}>{priceDisplay}</Text>
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
          style={styles.subscribeButton}
          onPress={handleSubscribe}
          activeOpacity={0.85}
          disabled={loading || restoring}
        >
          <Ionicons name="star" size={20} color="#000" style={{ marginRight: 10 }} />
          {loading
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.subscribeButtonText}>Subscribe for {priceDisplay}/mo</Text>
          }
        </TouchableOpacity>

        <Text style={styles.legalText}>
          Payment will be charged to your Apple ID at confirmation of purchase. Subscription
          automatically renews unless auto-renew is turned off at least 24 hours before the end of
          the current period. Manage or cancel in App Store → Settings → Subscriptions.
        </Text>

        {/* Restore purchases */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={loading || restoring}
        >
          {restoring
            ? <ActivityIndicator color={COLORS.muted} size="small" />
            : <Text style={styles.restoreText}>Restore Purchases</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.noThanksButton} onPress={() => navigation.goBack()}>
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
    marginBottom: 12,
  },
  restoreButton: {
    alignItems: 'center',
    padding: 10,
    marginBottom: 4,
  },
  restoreText: {
    color: COLORS.muted,
    fontSize: 13,
    textDecorationLine: 'underline',
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
