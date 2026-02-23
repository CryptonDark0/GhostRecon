import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, Lock, Eye, Fingerprint } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { getToken } from '../src/api';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [glowAnim] = useState(new Animated.Value(0.3));

  useEffect(() => {
    checkAuth();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const checkAuth = async () => {
    const token = await getToken();
    if (token) {
      router.replace('/home');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.logoArea, { opacity: fadeAnim }]}>
          <Animated.View style={[styles.shieldContainer, { opacity: glowAnim }]}>
            <Shield size={80} color={COLORS.terminal_green} strokeWidth={1.5} />
          </Animated.View>
          <Text style={styles.appName}>GHOSTRECON</Text>
          <Text style={styles.tagline}>ZERO TRACE COMMUNICATIONS</Text>
        </Animated.View>

        <Animated.View style={[styles.features, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.featureRow}>
            <Lock size={16} color={COLORS.terminal_green} />
            <Text style={styles.featureText}>AES-256 End-to-End Encryption</Text>
          </View>
          <View style={styles.featureRow}>
            <Eye size={16} color={COLORS.terminal_green} />
            <Text style={styles.featureText}>Zero Metadata Architecture</Text>
          </View>
          <View style={styles.featureRow}>
            <Fingerprint size={16} color={COLORS.terminal_green} />
            <Text style={styles.featureText}>Anonymous Registration</Text>
          </View>
          <View style={styles.featureRow}>
            <Shield size={16} color={COLORS.terminal_green} />
            <Text style={styles.featureText}>Military-Grade Key Management</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity
            testID="anonymous-register-btn"
            style={styles.primaryBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/register-anonymous')}
          >
            <Fingerprint size={20} color={COLORS.void_black} />
            <Text style={styles.primaryBtnText}>ANONYMOUS ACCESS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="pseudonym-register-btn"
            style={styles.secondaryBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/register-pseudonym')}
          >
            <Text style={styles.secondaryBtnText}>PSEUDONYM REGISTRATION</Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="login-btn"
            style={styles.ghostBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.ghostBtnText}>ALREADY HAVE ACCESS? LOGIN</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text style={styles.versionText}>v1.0.0 // PROTOCOL: SECURE</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.void_black,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  shieldContainer: {
    marginBottom: 20,
  },
  appName: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.terminal_green,
    letterSpacing: 6,
    fontFamily: 'monospace',
  },
  tagline: {
    fontSize: 11,
    color: COLORS.muted_text,
    letterSpacing: 3,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  features: {
    marginBottom: 48,
    paddingHorizontal: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  featureText: {
    color: COLORS.ghost_white,
    fontSize: 13,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  actions: {
    gap: 12,
  },
  primaryBtn: {
    height: 52,
    backgroundColor: COLORS.terminal_green,
    borderRadius: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryBtnText: {
    color: COLORS.void_black,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  secondaryBtn: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.terminal_green,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: COLORS.terminal_green,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  ghostBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: {
    color: COLORS.muted_text,
    fontSize: 12,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  versionText: {
    color: COLORS.stealth_grey,
    fontSize: 10,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 32,
    letterSpacing: 1,
  },
});
