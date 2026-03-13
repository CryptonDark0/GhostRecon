import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  ScrollView, ActivityIndicator, Alert, Platform, Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Crown, CheckCircle2, ShieldCheck,
  Zap, Globe, Lock, CreditCard
} from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { auth, db } from '../src/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export default function SubscriptionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  const plans = [
    {
      id: 'monthly',
      name: 'ELITE OPERATOR',
      price: '$9.99',
      period: 'per month',
      features: [
        'Secure Vault Access (50MB)',
        'E2EE Voice & Video Calls',
        'Unlimited Group Handshakes',
        'Burn-on-Read Intel'
      ]
    },
    {
      id: 'yearly',
      name: 'COMMAND LEVEL',
      price: '$89.99',
      period: 'per year',
      features: [
        'Everything in Elite',
        'Priority Satellite Relays',
        'Custom Tactical Alias',
        '20% Tactical Discount'
      ],
      save: 'SAVE 25%'
    }
  ];

  const handlePurchase = async () => {
    setLoading(true);

    try {
      // TACTICAL REDIRECTION LOGIC
      // In production, this triggers the App Store / Play Store IAP flow.
      // For now, we point to the secure payment portal or store link.

      const storeUrl = Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/ghost-recon' // Replace with real ID
        : 'https://play.google.com/store/apps/details?id=com.ghostrecon.app'; // Replace with real ID

      if (Platform.OS === 'web') {
        // Redirect to Stripe or custom checkout
        window.location.href = 'https://buy.stripe.com/tactical_handshake'; // Replace with real link
      } else {
        // Check if store can be opened, otherwise use web view
        const supported = await Linking.canOpenURL(storeUrl);
        if (supported) {
          await Linking.openURL(storeUrl);
        } else {
          Alert.alert("Store Link", "Redirecting to secure payment portal...");
        }
      }

      // MOCK SUCCESS (Remove this block when IAP library is fully integrated)
      // This allows you to test the Premium features instantly.
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, "users", user.uid), {
          isSubscribed: true,
          subscriptionType: selectedPlan,
          subscriptionDate: serverTimestamp()
        });

        Alert.alert("AUTHORIZATION GRANTED", "Premium link established. Vault access unlocked.");
        router.replace('/home');
      }

    } catch (error) {
      Alert.alert("Handshake Interrupted", "Payment authorization failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>UPGRADE AUTHORIZATION</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.iconCircle}>
            <Crown size={48} color={COLORS.alert_amber} />
          </View>
          <Text style={styles.title}>GHOSTRECON PREMIUM</Text>
          <Text style={styles.subtitle}>Unlock unrestricted tactical capabilities and secure storage.</Text>
        </View>

        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardActive
              ]}
              onPress={() => setSelectedPlan(plan.id as any)}
              activeOpacity={0.8}
            >
              {plan.save && (
                <View style={styles.saveBadge}>
                  <Text style={styles.saveBadgeText}>{plan.save}</Text>
                </View>
              )}
              <View style={styles.planHeader}>
                <Text style={[styles.planName, selectedPlan === plan.id && { color: COLORS.terminal_green }]}>
                  {plan.name}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceText}>{plan.price}</Text>
                  <Text style={styles.periodText}>{plan.period}</Text>
                </View>
              </View>

              <View style={styles.featuresList}>
                {plan.features.map((feature, idx) => (
                  <View key={idx} style={styles.featureItem}>
                    <CheckCircle2 size={14} color={COLORS.terminal_green} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.securitySeal}>
          <ShieldCheck size={16} color={COLORS.terminal_green} />
          <Text style={styles.securityText}>SECURE ENCRYPTED TRANSACTION</Text>
        </View>

        <TouchableOpacity
          style={styles.purchaseBtn}
          onPress={handlePurchase}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.void_black} />
          ) : (
            <>
              <CreditCard size={20} color={COLORS.void_black} />
              <Text style={styles.purchaseBtnText}>AUTHORIZE PAYMENT</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Subscription will be processed via {Platform.OS === 'ios' ? 'Apple App Store' : Platform.OS === 'android' ? 'Google Play Store' : 'Stripe Secure'}.
          Cancel anytime in tactical settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  header: {
    height: 60, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey
  },
  backBtn: { padding: 8 },
  headerTitle: { color: COLORS.ghost_white, fontSize: 12, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  content: { padding: 24, paddingBottom: 60 },
  hero: { alignItems: 'center', marginBottom: 40 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,176,0,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 1, borderColor: COLORS.alert_amber
  },
  title: { color: COLORS.ghost_white, fontSize: 22, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 1 },
  subtitle: { color: COLORS.muted_text, fontSize: 12, textAlign: 'center', marginTop: 10, fontFamily: 'monospace', lineHeight: 18 },
  plansContainer: { gap: 20 },
  planCard: {
    backgroundColor: COLORS.gunmetal, borderRadius: 4,
    padding: 20, borderWidth: 1, borderColor: COLORS.border_subtle,
    position: 'relative'
  },
  planCardActive: { borderColor: COLORS.terminal_green, borderLeftWidth: 4, borderLeftColor: COLORS.terminal_green },
  saveBadge: {
    position: 'absolute', top: -10, right: 20,
    backgroundColor: COLORS.terminal_green, paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 2
  },
  saveBadgeText: { color: COLORS.void_black, fontSize: 10, fontWeight: '900', fontFamily: 'monospace' },
  planHeader: { marginBottom: 20 },
  planName: { color: COLORS.muted_text, fontSize: 14, fontWeight: '900', fontFamily: 'monospace' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  priceText: { color: COLORS.ghost_white, fontSize: 28, fontWeight: '900', fontFamily: 'monospace' },
  periodText: { color: COLORS.muted_text, fontSize: 10, fontFamily: 'monospace' },
  featuresList: { gap: 12 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { color: COLORS.ghost_white, fontSize: 12, fontFamily: 'monospace' },
  securitySeal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 40, opacity: 0.6 },
  securityText: { color: COLORS.terminal_green, fontSize: 9, fontWeight: '700', fontFamily: 'monospace' },
  purchaseBtn: {
    height: 60, backgroundColor: COLORS.terminal_green,
    borderRadius: 2, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 12, marginTop: 24
  },
  purchaseBtnText: { color: COLORS.void_black, fontSize: 16, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 1 },
  disclaimer: { color: COLORS.stealth_grey, fontSize: 10, textAlign: 'center', marginTop: 24, fontFamily: 'monospace', lineHeight: 16 },
});
