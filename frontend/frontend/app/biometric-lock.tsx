import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Shield, Fingerprint, Lock } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'ghostrecon_biometric_enabled';

export async function isBiometricEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
  return v === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
}

export default function BiometricLockScreen() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pulseAnim] = useState(new Animated.Value(1));
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    checkAndAuthenticate();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const checkAndAuthenticate = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setAvailable(hasHardware && isEnrolled);

    if (hasHardware && isEnrolled) {
      authenticate();
    } else {
      // No biometric hardware, skip to home
      router.replace('/home');
    }
  };

  const authenticate = async () => {
    setError('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access GhostRecon',
        fallbackLabel: 'Use Passphrase',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        router.replace('/home');
      } else {
        setError('Authentication failed. Try again.');
      }
    } catch (err) {
      setError('Biometric error. Tap to retry.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topSection}>
          <Shield size={32} color={COLORS.terminal_green} />
          <Text style={styles.appName}>GHOSTRECON</Text>
          <Text style={styles.subtitle}>LOCKED</Text>
        </View>

        <TouchableOpacity
          testID="biometric-auth-btn"
          style={styles.authArea}
          onPress={authenticate}
          activeOpacity={0.7}
        >
          <Animated.View style={[styles.fingerCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Fingerprint size={64} color={COLORS.terminal_green} />
          </Animated.View>
          <Text style={styles.authText}>
            {Platform.OS === 'ios' ? 'FACE ID / TOUCH ID' : 'BIOMETRIC AUTH'}
          </Text>
          <Text style={styles.authSubtext}>Tap to authenticate</Text>
        </TouchableOpacity>

        {error ? (
          <View style={styles.errorBox}>
            <Lock size={14} color={COLORS.critical_red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Your data is encrypted at rest.{'\n'}
            Biometric authentication protects{'\n'}
            against unauthorized device access.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  topSection: { alignItems: 'center', marginBottom: 48 },
  appName: { color: COLORS.terminal_green, fontSize: 24, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 4, marginTop: 12 },
  subtitle: { color: COLORS.critical_red, fontSize: 12, fontFamily: 'monospace', letterSpacing: 4, marginTop: 4 },
  authArea: { alignItems: 'center', paddingVertical: 32 },
  fingerCircle: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 2, borderColor: COLORS.terminal_green,
    backgroundColor: 'rgba(0,255,65,0.05)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  authText: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  authSubtext: { color: COLORS.muted_text, fontSize: 11, fontFamily: 'monospace', marginTop: 8 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderWidth: 1, borderColor: COLORS.critical_red,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 2, marginTop: 16,
  },
  errorText: { color: COLORS.critical_red, fontSize: 12, fontFamily: 'monospace' },
  infoBox: { marginTop: 48 },
  infoText: { color: COLORS.stealth_grey, fontSize: 11, fontFamily: 'monospace', textAlign: 'center', lineHeight: 18 },
});
