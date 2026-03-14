import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Animated, ActivityIndicator, Image, Dimensions, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { LogIn, UserPlus, ShieldCheck, Zap } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { auth } from '../src/firebase';

export default function OnboardingScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && user.emailVerified) {
        router.replace('/home');
      } else {
        setChecking(false);
        startAnimations();
      }
    });

    return () => unsubscribe();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  };

  const navigateSecurely = (path: string) => {
    // 🛡️ Web Accessibility Fix: Clear focus before navigation to prevent aria-hidden errors
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
    router.push(path as any);
  };

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.terminal_green} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.logoArea, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.iconContainer}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.mainLogo}
              resizeMode="contain"
            />
            <View style={styles.scannerLine} />
          </View>
          <Text style={styles.appName}>GHOSTRECON</Text>
          <View style={styles.taglineRow}>
            <ShieldCheck size={12} color={COLORS.terminal_green} />
            <Text style={styles.tagline}>E2EE & AES-256 ENCRYPTION</Text>
          </View>
        </Animated.View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigateSecurely('/register-pseudonym')}
            activeOpacity={0.8}
          >
            <UserPlus size={20} color={COLORS.void_black} />
            <Text style={styles.primaryBtnText}>INITIALIZE NEW IDENTITY</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigateSecurely('/login')}
            activeOpacity={0.8}
          >
            <LogIn size={20} color={COLORS.terminal_green} />
            <Text style={styles.secondaryBtnText}>LOGIN</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footerInfo}>
          <View style={styles.statusBadge}>
            <Zap size={10} color={COLORS.terminal_green} />
            <Text style={styles.statusText}>ENCRYPTION: ACTIVE (E2EE + AES-256)</Text>
          </View>
          <Text style={styles.versionText}>SYSTEM v2.1.1 // ZERO-KNOWLEDGE PROTOCOL</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  loadingContainer: { flex: 1, backgroundColor: COLORS.void_black, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, paddingHorizontal: 40, justifyContent: 'center' },
  logoArea: { alignItems: 'center', marginBottom: 80 },
  iconContainer: { width: 160, height: 160, marginBottom: 24, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  mainLogo: { width: 140, height: 140 },
  scannerLine: {
    position: 'absolute',
    top: '50%',
    width: 160,
    height: 1,
    backgroundColor: COLORS.terminal_green,
    opacity: 0.4,
    ...Platform.select({
      ios: { shadowColor: COLORS.terminal_green, shadowOpacity: 1, shadowRadius: 15 },
      android: { elevation: 10 },
      web: { boxShadow: `0 0 15px ${COLORS.terminal_green}` }
    })
  },
  appName: { fontSize: 36, fontWeight: '900', color: COLORS.terminal_green, letterSpacing: 8, fontFamily: 'monospace' },
  taglineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  tagline: { fontSize: 10, color: COLORS.muted_text, letterSpacing: 1, fontFamily: 'monospace' },
  actions: { gap: 18 },
  primaryBtn: { height: 60, backgroundColor: COLORS.terminal_green, borderRadius: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderLeftWidth: 4, borderLeftColor: COLORS.ghost_white },
  primaryBtnText: { color: COLORS.void_black, fontSize: 14, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 1 },
  secondaryBtn: { height: 60, borderWidth: 1, borderColor: COLORS.terminal_green, borderRadius: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  secondaryBtnText: { color: COLORS.terminal_green, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  footerInfo: { marginTop: 80, alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,255,65,0.05)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 2, borderWidth: 1, borderColor: 'rgba(0,255,65,0.2)', marginBottom: 12 },
  statusText: { color: COLORS.terminal_green, fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold' },
  versionText: { color: COLORS.stealth_grey, fontSize: 9, fontFamily: 'monospace', letterSpacing: 1 },
});
