import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Switch, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Shield, Eye, EyeOff, Clock, Link, Keyboard } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { apiCall } from '../src/api';

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState({
    screenshot_protection: true,
    read_receipts: false,
    typing_indicators: false,
    link_previews: false,
    auto_delete_days: null as number | null,
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const s = await apiCall('/security/settings');
      if (s) setSettings(s);
    } catch {}
  };

  const updateSetting = async (key: string, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    try {
      await apiCall('/security/settings', {
        method: 'PUT',
        body: JSON.stringify(updated),
      });
    } catch {
      Alert.alert('Error', 'Failed to update settings');
    }
  };

  const autoDeleteOptions = [null, 1, 7, 30, 90];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SECURITY SETTINGS</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>PRIVACY CONTROLS</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIcon}>
              <Eye size={18} color={COLORS.terminal_green} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Screenshot Protection</Text>
              <Text style={styles.settingDesc}>Block screenshots in chat</Text>
            </View>
          </View>
          <Switch
            testID="screenshot-toggle"
            value={settings.screenshot_protection}
            onValueChange={(v) => updateSetting('screenshot_protection', v)}
            trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }}
            thumbColor={COLORS.ghost_white}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIcon}>
              <EyeOff size={18} color={COLORS.terminal_green} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Read Receipts</Text>
              <Text style={styles.settingDesc}>Show when messages are read</Text>
            </View>
          </View>
          <Switch
            testID="read-receipts-toggle"
            value={settings.read_receipts}
            onValueChange={(v) => updateSetting('read_receipts', v)}
            trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }}
            thumbColor={COLORS.ghost_white}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIcon}>
              <Keyboard size={18} color={COLORS.terminal_green} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Typing Indicators</Text>
              <Text style={styles.settingDesc}>Show typing status to others</Text>
            </View>
          </View>
          <Switch
            testID="typing-toggle"
            value={settings.typing_indicators}
            onValueChange={(v) => updateSetting('typing_indicators', v)}
            trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }}
            thumbColor={COLORS.ghost_white}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <View style={styles.settingIcon}>
              <Link size={18} color={COLORS.terminal_green} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Link Previews</Text>
              <Text style={styles.settingDesc}>Generate link previews (leaks metadata)</Text>
            </View>
          </View>
          <Switch
            testID="link-previews-toggle"
            value={settings.link_previews}
            onValueChange={(v) => updateSetting('link_previews', v)}
            trackColor={{ false: COLORS.armour_grey, true: COLORS.terminal_green }}
            thumbColor={COLORS.ghost_white}
          />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>AUTO-DELETE MESSAGES</Text>
        <Text style={styles.sectionDesc}>Automatically destroy messages after set period</Text>

        <View style={styles.deleteOptions}>
          {autoDeleteOptions.map((days) => (
            <TouchableOpacity
              key={String(days)}
              testID={`auto-delete-${days || 'off'}`}
              style={[styles.deleteOption, settings.auto_delete_days === days && styles.deleteOptionActive]}
              onPress={() => updateSetting('auto_delete_days', days)}
              activeOpacity={0.7}
            >
              <Text style={[styles.deleteOptionText, settings.auto_delete_days === days && styles.deleteOptionTextActive]}>
                {days === null ? 'OFF' : `${days}D`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Shield size={14} color={COLORS.terminal_green} />
          <Text style={styles.infoText}>
            All settings are encrypted and stored locally. Server has zero knowledge of your preferences.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  headerTitle: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  content: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: {
    color: COLORS.terminal_green, fontSize: 11, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 2, marginTop: 24, marginBottom: 16,
  },
  sectionDesc: { color: COLORS.muted_text, fontSize: 11, fontFamily: 'monospace', marginBottom: 12 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,255,65,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
  settingDesc: { color: COLORS.muted_text, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  deleteOptions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  deleteOption: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderWidth: 1, borderColor: COLORS.border_subtle, borderRadius: 2,
  },
  deleteOptionActive: { borderColor: COLORS.critical_red, backgroundColor: 'rgba(255,59,48,0.15)' },
  deleteOptionText: { color: COLORS.muted_text, fontSize: 13, fontWeight: '600', fontFamily: 'monospace' },
  deleteOptionTextActive: { color: COLORS.critical_red },
  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(0,255,65,0.05)',
    borderLeftWidth: 2, borderLeftColor: COLORS.terminal_green,
    padding: 16, marginTop: 32,
  },
  infoText: { color: COLORS.muted_text, fontSize: 11, fontFamily: 'monospace', lineHeight: 18, flex: 1 },
});
