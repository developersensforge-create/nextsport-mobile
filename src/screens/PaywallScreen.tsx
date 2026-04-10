import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type PaywallNavProp = StackNavigationProp<RootStackParamList, 'Paywall'>;

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

  async function handleSubscribe() {
    await WebBrowser.openBrowserAsync('https://nextsport-six.vercel.app/pricing');
  }

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
            <Text style={styles.price}>$14.99</Text>
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
        >
          <Ionicons name="star" size={20} color="#000" style={{ marginRight: 10 }} />
          <Text style={styles.subscribeButtonText}>Subscribe for $14.99/mo</Text>
        </TouchableOpacity>

        <Text style={styles.legalText}>
          Payment processed securely via Stripe. You'll be taken to our website to complete the subscription. Cancel anytime from your account settings.
        </Text>

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
