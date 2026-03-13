import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  FlatList, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Search, UserPlus, MessageSquare } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { apiCall, getUser } from '../src/api';

export default function NewChatScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUserState] = useState<any>(null);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    const u = await getUser();
    setUserState(u);
    const c = await apiCall('/contacts').catch(() => []);
    setContacts(c);
  };

  const searchUsers = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await apiCall(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(res);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  const startChat = async (targetId: string) => {
    try {
      const conv = await apiCall('/conversations', {
        method: 'POST',
        body: JSON.stringify({ participant_ids: [targetId], is_group: false }),
      });
      router.replace(`/chat/${conv.id}`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const addContact = async (targetId: string) => {
    try {
      await apiCall('/contacts', {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetId, trust_level: 1 }),
      });
      await loadContacts();
      Alert.alert('Contact Added', 'Added to your trust network');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const renderUser = ({ item }: { item: any }) => (
    <View style={styles.userItem}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.alias || '?')[0]}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.alias}</Text>
        <Text style={styles.userType}>{item.registration_type?.toUpperCase()}</Text>
      </View>
      <TouchableOpacity testID={`add-contact-${item.id}`} style={styles.addBtn} onPress={() => addContact(item.id)} activeOpacity={0.7}>
        <UserPlus size={16} color={COLORS.terminal_green} />
      </TouchableOpacity>
      <TouchableOpacity testID={`start-chat-${item.id}`} style={styles.chatBtn} onPress={() => startChat(item.id)} activeOpacity={0.7}>
        <MessageSquare size={16} color={COLORS.void_black} />
      </TouchableOpacity>
    </View>
  );

  const renderContact = ({ item }: { item: any }) => (
    <TouchableOpacity
      testID={`contact-chat-${item.contact_id}`}
      style={styles.userItem}
      onPress={() => startChat(item.contact_id)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.contact_alias || '?')[0]}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.contact_alias}</Text>
        <Text style={styles.userType}>TRUST LEVEL: {item.trust_level}</Text>
      </View>
      <MessageSquare size={18} color={COLORS.terminal_green} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NEW SECURE CHANNEL</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color={COLORS.stealth_grey} />
        <TextInput
          testID="search-input"
          style={styles.searchInput}
          value={query}
          onChangeText={searchUsers}
          placeholder="Search agents by codename..."
          placeholderTextColor={COLORS.stealth_grey}
          autoCapitalize="none"
        />
      </View>

      {loading && <ActivityIndicator color={COLORS.terminal_green} style={{ marginTop: 20 }} />}

      {results.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>SEARCH RESULTS</Text>
          <FlatList data={results} renderItem={renderUser} keyExtractor={(item) => item.id} />
        </>
      ) : (
        <>
          <Text style={styles.sectionLabel}>YOUR TRUST NETWORK</Text>
          <FlatList
            data={contacts}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No contacts yet. Search to add agents.</Text>
            }
          />
        </>
      )}
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
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 16, backgroundColor: COLORS.gunmetal,
    borderWidth: 1, borderColor: COLORS.border_subtle, borderRadius: 2,
    paddingHorizontal: 12, height: 48,
  },
  searchInput: { flex: 1, color: COLORS.ghost_white, fontSize: 14, fontFamily: 'monospace' },
  sectionLabel: {
    color: COLORS.terminal_green, fontSize: 10, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 8,
  },
  userItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
    gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.gunmetal, borderWidth: 1, borderColor: COLORS.terminal_green,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: COLORS.terminal_green, fontSize: 16, fontWeight: '700', fontFamily: 'monospace' },
  userInfo: { flex: 1 },
  userName: { color: COLORS.ghost_white, fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
  userType: { color: COLORS.muted_text, fontSize: 10, fontFamily: 'monospace', letterSpacing: 1, marginTop: 2 },
  addBtn: {
    width: 36, height: 36, borderWidth: 1, borderColor: COLORS.terminal_green,
    borderRadius: 2, alignItems: 'center', justifyContent: 'center',
  },
  chatBtn: {
    width: 36, height: 36, backgroundColor: COLORS.terminal_green,
    borderRadius: 2, alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { color: COLORS.stealth_grey, fontSize: 12, fontFamily: 'monospace', textAlign: 'center', marginTop: 40 },
});
