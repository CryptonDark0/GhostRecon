import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  FlatList, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  MessageSquare, Phone, Users, Shield, Settings, Plus, Search, Lock,
} from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { apiCall, getUser, clearAuth } from '../src/api';
import { getOrCreateKeyPair, getKeyFingerprint } from '../src/encryption';
import { useWebSocket } from '../src/websocket';
import { disconnectWebSocket } from '../src/websocket';

type Tab = 'chats' | 'calls' | 'contacts' | 'security';

export default function HomeScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('chats');
  const [user, setUserState] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [securityInfo, setSecurityInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const u = await getUser();
      setUserState(u);
      const [convs, callHistory, contactList, secInfo] = await Promise.all([
        apiCall('/conversations').catch(() => []),
        apiCall('/calls').catch(() => []),
        apiCall('/contacts').catch(() => []),
        apiCall('/security/session-info').catch(() => null),
      ]);
      setConversations(convs);
      setCalls(callHistory);
      setContacts(contactList);
      setSecurityInfo(secInfo);
    } catch (err) {
      console.log('Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleLogout = async () => {
    await clearAuth();
    router.replace('/');
  };

  const startNewChat = async () => {
    router.push('/new-chat');
  };

  const renderConversation = ({ item }: { item: any }) => {
    const other = item.participant_info?.[0];
    return (
      <TouchableOpacity
        testID={`conv-${item.id}`}
        style={styles.listItem}
        activeOpacity={0.7}
        onPress={() => router.push(`/chat/${item.id}`)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(other?.alias || '?')[0]}</Text>
          {other?.is_online && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle} numberOfLines={1}>{other?.alias || item.name || 'Unknown'}</Text>
            <Lock size={12} color={COLORS.terminal_green} />
          </View>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {item.last_message || 'Encrypted channel established'}
          </Text>
        </View>
        {item.unread_count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unread_count}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderCall = ({ item }: { item: any }) => {
    const isOutgoing = item.caller_id === user?.id;
    return (
      <TouchableOpacity testID={`call-${item.id}`} style={styles.listItem} activeOpacity={0.7}>
        <View style={[styles.avatar, { borderColor: item.call_type === 'video' ? COLORS.alert_amber : COLORS.terminal_green }]}>
          {item.call_type === 'video' ? (
            <Text style={styles.avatarEmoji}>{'📹'}</Text>
          ) : (
            <Phone size={20} color={COLORS.terminal_green} />
          )}
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>
            {isOutgoing ? item.receiver_alias : item.caller_alias}
          </Text>
          <Text style={styles.itemSubtitle}>
            {isOutgoing ? 'Outgoing' : 'Incoming'} {item.call_type} {'\u2022'} {item.encryption}
          </Text>
        </View>
        <Text style={styles.callDuration}>
          {item.duration_seconds ? `${Math.floor(item.duration_seconds / 60)}m` : item.status}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContact = ({ item }: { item: any }) => {
    const info = item.contact_info || {};
    const trustBars = Array.from({ length: 5 }, (_, i) => i < (info.trust_level || item.trust_level || 0));
    return (
      <TouchableOpacity testID={`contact-${item.id}`} style={styles.listItem} activeOpacity={0.7}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.contact_alias || '?')[0]}</Text>
          {info.is_online && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemTitle}>{item.contact_alias}</Text>
          <View style={styles.trustRow}>
            <Text style={styles.trustLabel}>TRUST: </Text>
            {trustBars.map((filled, i) => (
              <View key={i} style={[styles.trustBar, filled && styles.trustBarFilled]} />
            ))}
          </View>
        </View>
        <View style={[styles.statusDot, { backgroundColor: item.verified ? COLORS.terminal_green : COLORS.stealth_grey }]} />
      </TouchableOpacity>
    );
  };

  const renderSecurity = () => (
    <View style={styles.securityContent}>
      <View style={styles.secCard}>
        <Text style={styles.secLabel}>ENCRYPTION STATUS</Text>
        <View style={styles.secRow}>
          <Lock size={16} color={COLORS.terminal_green} />
          <Text style={styles.secValue}>AES-256-GCM + X25519</Text>
        </View>
      </View>

      <View style={styles.secCard}>
        <Text style={styles.secLabel}>KEY FINGERPRINT</Text>
        <Text style={styles.secHash}>{securityInfo?.encryption_key_hash?.slice(0, 32) || '...'}</Text>
      </View>

      <View style={styles.secCard}>
        <Text style={styles.secLabel}>SESSION STATS</Text>
        <Text style={styles.secValue}>Conversations: {securityInfo?.active_conversations || 0}</Text>
        <Text style={styles.secValue}>Contacts: {securityInfo?.total_contacts || 0}</Text>
        <Text style={styles.secValue}>Trust: Level {securityInfo?.trust_level || 0}</Text>
      </View>

      <TouchableOpacity
        testID="rotate-keys-btn"
        style={styles.secBtn}
        activeOpacity={0.7}
        onPress={async () => {
          try {
            await apiCall('/security/rotate-keys', { method: 'POST' });
            await loadData();
          } catch {}
        }}
      >
        <Text style={styles.secBtnText}>ROTATE ENCRYPTION KEYS</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="panic-wipe-btn"
        style={[styles.secBtn, styles.panicBtn]}
        activeOpacity={0.7}
        onPress={() => router.push('/panic-wipe')}
      >
        <Text style={styles.panicBtnText}>PANIC WIPE</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="decoy-mode-btn"
        style={[styles.secBtn, styles.decoyBtn]}
        activeOpacity={0.7}
        onPress={() => router.push('/decoy')}
      >
        <Text style={styles.decoyBtnText}>ACTIVATE DECOY MODE</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="settings-btn"
        style={styles.settingsBtn}
        activeOpacity={0.7}
        onPress={() => router.push('/settings')}
      >
        <Settings size={16} color={COLORS.muted_text} />
        <Text style={styles.settingsBtnText}>SECURITY SETTINGS</Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="logout-btn"
        style={styles.logoutBtn}
        activeOpacity={0.7}
        onPress={handleLogout}
      >
        <Text style={styles.logoutBtnText}>TERMINATE SESSION</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.terminal_green} />
          <Text style={styles.loadingText}>DECRYPTING...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appTitle}>GHOSTRECON</Text>
          <Text style={styles.userAlias}>{user?.alias || 'Unknown Agent'}</Text>
        </View>
        <View style={styles.topBarRight}>
          <TouchableOpacity testID="search-btn" style={styles.iconBtn} activeOpacity={0.7}>
            <Search size={20} color={COLORS.ghost_white} />
          </TouchableOpacity>
          {tab === 'chats' && (
            <TouchableOpacity testID="new-chat-btn" style={styles.iconBtn} activeOpacity={0.7} onPress={startNewChat}>
              <Plus size={20} color={COLORS.terminal_green} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.mainContent}>
        {tab === 'chats' && (
          <FlatList
            testID="chats-list"
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.terminal_green} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MessageSquare size={40} color={COLORS.stealth_grey} />
                <Text style={styles.emptyTitle}>NO ACTIVE CHANNELS</Text>
                <Text style={styles.emptySubtitle}>Tap + to start an encrypted conversation</Text>
              </View>
            }
          />
        )}
        {tab === 'calls' && (
          <FlatList
            testID="calls-list"
            data={calls}
            renderItem={renderCall}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.terminal_green} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Phone size={40} color={COLORS.stealth_grey} />
                <Text style={styles.emptyTitle}>NO CALL HISTORY</Text>
                <Text style={styles.emptySubtitle}>All calls are encrypted with SRTP + ZRTP</Text>
              </View>
            }
          />
        )}
        {tab === 'contacts' && (
          <FlatList
            testID="contacts-list"
            data={contacts}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.terminal_green} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Users size={40} color={COLORS.stealth_grey} />
                <Text style={styles.emptyTitle}>NO TRUSTED CONTACTS</Text>
                <Text style={styles.emptySubtitle}>Add contacts from your encrypted network</Text>
              </View>
            }
          />
        )}
        {tab === 'security' && renderSecurity()}
      </View>

      <View style={styles.tabBar}>
        {([
          { key: 'chats' as Tab, icon: MessageSquare, label: 'CHATS' },
          { key: 'calls' as Tab, icon: Phone, label: 'CALLS' },
          { key: 'contacts' as Tab, icon: Users, label: 'CONTACTS' },
          { key: 'security' as Tab, icon: Shield, label: 'SECURITY' },
        ]).map(({ key, icon: Icon, label }) => (
          <TouchableOpacity
            key={key}
            testID={`tab-${key}`}
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => setTab(key)}
          >
            <Icon size={22} color={tab === key ? COLORS.terminal_green : COLORS.stealth_grey} />
            <Text style={[styles.tabLabel, tab === key && styles.tabLabelActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.terminal_green, fontSize: 12, fontFamily: 'monospace', marginTop: 16, letterSpacing: 2 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  appTitle: { color: COLORS.terminal_green, fontSize: 18, fontWeight: '900', fontFamily: 'monospace', letterSpacing: 3 },
  userAlias: { color: COLORS.muted_text, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  topBarRight: { flexDirection: 'row', gap: 12 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  mainContent: { flex: 1 },
  listItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.gunmetal, borderWidth: 1, borderColor: COLORS.terminal_green,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: COLORS.terminal_green, fontSize: 18, fontWeight: '700', fontFamily: 'monospace' },
  avatarEmoji: { fontSize: 20 },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: COLORS.terminal_green,
    borderWidth: 2, borderColor: COLORS.void_black,
  },
  itemContent: { flex: 1, marginLeft: 12 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitle: { color: COLORS.ghost_white, fontSize: 15, fontWeight: '600', fontFamily: 'monospace' },
  itemSubtitle: { color: COLORS.muted_text, fontSize: 12, fontFamily: 'monospace', marginTop: 3 },
  badge: {
    backgroundColor: COLORS.terminal_green, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: COLORS.void_black, fontSize: 11, fontWeight: '700' },
  callDuration: { color: COLORS.muted_text, fontSize: 11, fontFamily: 'monospace' },
  trustRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  trustLabel: { color: COLORS.muted_text, fontSize: 10, fontFamily: 'monospace', letterSpacing: 1 },
  trustBar: {
    width: 14, height: 4, backgroundColor: COLORS.armour_grey,
    marginRight: 2, borderRadius: 1,
  },
  trustBarFilled: { backgroundColor: COLORS.terminal_green },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { color: COLORS.stealth_grey, fontSize: 14, fontFamily: 'monospace', marginTop: 16, letterSpacing: 2 },
  emptySubtitle: { color: COLORS.stealth_grey, fontSize: 11, fontFamily: 'monospace', marginTop: 8 },
  securityContent: { padding: 16, gap: 12 },
  secCard: {
    backgroundColor: COLORS.gunmetal, borderLeftWidth: 2, borderLeftColor: COLORS.terminal_green,
    padding: 16,
  },
  secLabel: { color: COLORS.terminal_green, fontSize: 10, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1, marginBottom: 8 },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  secValue: { color: COLORS.ghost_white, fontSize: 13, fontFamily: 'monospace', marginTop: 2 },
  secHash: { color: COLORS.alert_amber, fontSize: 11, fontFamily: 'monospace', letterSpacing: 1 },
  secBtn: {
    height: 48, borderWidth: 1, borderColor: COLORS.terminal_green,
    borderRadius: 2, alignItems: 'center', justifyContent: 'center',
  },
  secBtnText: { color: COLORS.terminal_green, fontSize: 13, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  panicBtn: { borderColor: COLORS.critical_red, backgroundColor: 'rgba(255,59,48,0.1)' },
  panicBtnText: { color: COLORS.critical_red, fontSize: 13, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  decoyBtn: { borderColor: COLORS.alert_amber },
  decoyBtnText: { color: COLORS.alert_amber, fontSize: 13, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  settingsBtn: {
    height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.border_subtle, borderRadius: 2,
  },
  settingsBtnText: { color: COLORS.muted_text, fontSize: 12, fontFamily: 'monospace', letterSpacing: 1 },
  logoutBtn: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  logoutBtnText: { color: COLORS.critical_red, fontSize: 12, fontFamily: 'monospace', letterSpacing: 1 },
  tabBar: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.armour_grey,
    backgroundColor: COLORS.gunmetal, paddingBottom: 4,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 4 },
  tabLabel: { color: COLORS.stealth_grey, fontSize: 9, fontFamily: 'monospace', letterSpacing: 1 },
  tabLabelActive: { color: COLORS.terminal_green },
});
