import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Switch, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft, Shield, Eye, EyeOff, Keyboard, Fingerprint,
  User, Globe, MessageSquare, ShieldAlert, Zap, Ghost, CameraOff
} from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { auth, db } from '../src/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const [settings, setSettings] = useState({
    screenshot_protection: true,
    typing_indicators: true,
    stealth_mode: false,
    read_receipts: false,
    forward_protection: true,
    ip_obfuscation: true,
    auto_delete_default: null as number | null,
    metadata_scrubbing: true,
    ghost_notifications: true,
    burn_on_read: false
  });

  useEffect(() => {
    loadProfile();
    loadDeviceSecurity();
    loadLocalSettings();
  }, []);

  const loadProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) setUserProfile(docSnap.data());
      } catch (e) {}
    }
    setLoading(false);
  };

  const loadDeviceSecurity = async () => {
    const hasHw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricAvailable(hasHw && enrolled);
    const bioEnabled = await AsyncStorage.getItem('ghostrecon_biometric_enabled');
    setBiometricEnabled(bioEnabled === 'true');
  };

  const loadLocalSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('ghostrecon_privacy_settings');
      if (saved) setSettings(JSON.parse(saved));
    } catch (e) {}
  };

  const toggleBiometric = async (enabled: boolean) => {
    if (enabled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authorize Biometric Lock',
      });
      if (!result.success) return;
    }
    setBiometricEnabled(enabled);
    await AsyncStorage.setItem('ghostrecon_biometric_enabled', enabled ? 'true' : 'false');
  };

  const updateSetting = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await AsyncStorage.setItem('ghostrecon_privacy_settings', JSON.stringify(newSettings));

    if (key === 'stealth_mode' && auth.currentUser) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), { isOnline: !value }).catch(()=>{});
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer} aria-busy="true">
        <ActivityIndicator color={COLORS.terminal_green} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.backBtn}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SYSTEM CONFIG</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* OPERATOR IDENTITY */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <User size={32} color={COLORS.terminal_green} />
          </View>
          <View>
            <Text style={styles.profileLabel}>ACTIVE OPERATOR</Text>
            <Text style={styles.profileName}>{userProfile?.alias?.toUpperCase() || "AGENT"}</Text>
            <Text style={styles.profileType}>{userProfile?.accountType?.toUpperCase() || "SECURE"} LINK</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>ELITE PRIVACY CONTROLS</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIcon}><EyeOff size={18} color={COLORS.terminal_green} /></View>
            <View>
              <Text style={styles.settingLabel}>Stealth Mode</Text>
              <Text style={styles.settingDesc}>Mask active status from all nodes</Text>
            </View>
          </View>
          <Switch value={settings.stealth_mode} onValueChange={(v) => updateSetting('stealth_mode', v)} trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }} thumbColor={COLORS.ghost_white} />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIcon}><Zap size={18} color={COLORS.terminal_green} /></View>
            <View>
              <Text style={styles.settingLabel}>Burn on Read</Text>
              <Text style={styles.settingDesc}>Wipe intel immediately after viewing</Text>
            </View>
          </View>
          <Switch value={settings.burn_on_read} onValueChange={(v) => updateSetting('burn_on_read', v)} trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }} thumbColor={COLORS.ghost_white} />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIcon}><CameraOff size={18} color={COLORS.terminal_green} /></View>
            <View>
              <Text style={styles.settingLabel}>Metadata Scrubbing</Text>
              <Text style={styles.settingDesc}>Remove GPS/EXIF from all media</Text>
            </View>
          </View>
          <Switch value={settings.metadata_scrubbing} onValueChange={(v) => updateSetting('metadata_scrubbing', v)} trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }} thumbColor={COLORS.ghost_white} />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIcon}><Ghost size={18} color={COLORS.terminal_green} /></View>
            <View>
              <Text style={styles.settingLabel}>Ghost Notifications</Text>
              <Text style={styles.settingDesc}>Hide sender/content in push alerts</Text>
            </View>
          </View>
          <Switch value={settings.ghost_notifications} onValueChange={(v) => updateSetting('ghost_notifications', v)} trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }} thumbColor={COLORS.ghost_white} />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIcon}><Keyboard size={18} color={COLORS.terminal_green} /></View>
            <View>
              <Text style={styles.settingLabel}>Typing Indicators</Text>
              <Text style={styles.settingDesc}>Broadcast composition status</Text>
            </View>
          </View>
          <Switch value={settings.typing_indicators} onValueChange={(v) => updateSetting('typing_indicators', v)} trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }} thumbColor={COLORS.ghost_white} />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIcon}><ShieldAlert size={18} color={COLORS.terminal_green} /></View>
            <View>
              <Text style={styles.settingLabel}>Forwarding Block</Text>
              <Text style={styles.settingDesc}>Prevent copying of tactical intel</Text>
            </View>
          </View>
          <Switch value={settings.forward_protection} onValueChange={(v) => updateSetting('forward_protection', v)} trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }} thumbColor={COLORS.ghost_white} />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>DEVICE SECURITY</Text>

        {biometricAvailable && (
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIcon}><Fingerprint size={18} color={COLORS.terminal_green} /></View>
              <View>
                <Text style={styles.settingLabel}>Biometric Lock</Text>
                <Text style={styles.settingDesc}>Encrypt system via fingerprint</Text>
              </View>
            </View>
            <Switch value={biometricEnabled} onValueChange={toggleBiometric} trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }} thumbColor={COLORS.ghost_white} />
          </View>
        )}

        <View style={styles.infoBox}>
          <Shield size={14} color={COLORS.terminal_green} />
          <Text style={styles.infoText}>
            Privacy logic is processed client-side. The network is blind to your tactical configuration.
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  loadingContainer: { flex: 1, backgroundColor: COLORS.void_black, justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  backBtn: { padding: 8, zIndex: 100 },
  headerTitle: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  content: { flex: 1, paddingHorizontal: 20 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 20,
    backgroundColor: COLORS.gunmetal, padding: 24, borderRadius: 4,
    marginTop: 24, marginBottom: 32, borderLeftWidth: 3, borderLeftColor: COLORS.terminal_green,
  },
  avatarCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,255,65,0.05)', borderWidth: 1, borderColor: COLORS.terminal_green,
    alignItems: 'center', justifyContent: 'center',
  },
  profileLabel: { color: COLORS.terminal_green, fontSize: 9, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  profileName: { color: COLORS.ghost_white, fontSize: 20, fontWeight: '900', fontFamily: 'monospace', marginTop: 2 },
  profileType: { color: COLORS.muted_text, fontSize: 10, fontFamily: 'monospace', marginTop: 4 },
  sectionTitle: {
    color: COLORS.muted_text, fontSize: 11, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 2, marginTop: 12, marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingIcon: {
    width: 36, height: 36, borderRadius: 4,
    backgroundColor: 'rgba(0,255,65,0.05)',
    alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
  settingDesc: { color: COLORS.muted_text, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(0,255,65,0.02)',
    borderLeftWidth: 2, borderLeftColor: COLORS.terminal_green,
    padding: 16, marginTop: 40,
  },
  infoText: { color: COLORS.stealth_grey, fontSize: 11, fontFamily: 'monospace', lineHeight: 18, flex: 1 },
});
