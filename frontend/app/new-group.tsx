import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  FlatList, TextInput, ActivityIndicator, Alert, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Search, Users, ShieldCheck, Check } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { auth, db } from '../src/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { createConversation } from '../src/firestoreService';

export default function NewGroupScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  const currentUser = auth.currentUser;

  const searchUsers = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const searchKey = text.trim().toLowerCase();
      const q = query(
        usersRef,
        where("alias_lowercase", ">=", searchKey),
        where("alias_lowercase", "<=", searchKey + '\uf8ff'),
        limit(15)
      );

      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.id !== currentUser?.uid);

      setResults(users);
    } catch (err) {
      console.error("[GHOST-SEARCH] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAgent = (agent: any) => {
    if (selectedAgents.find(a => a.id === agent.id)) {
      setSelectedAgents(prev => prev.filter(a => a.id !== agent.id));
    } else {
      setSelectedAgents(prev => [...prev, agent]);
    }
  };

  const startGroupChat = async () => {
    if (!currentUser || selectedAgents.length < 1 || !groupName.trim()) {
      Alert.alert("Required", "Tactical designation and at least one agent required.");
      return;
    }

    try {
      setLoading(true);
      const participantIds = [currentUser.uid, ...selectedAgents.map(a => a.id)];
      const conv = await createConversation(participantIds, groupName.trim(), true);
      router.replace(`/chat/${conv.id}`);
    } catch (err: any) {
      console.error("[GHOST-GROUP] Handshake failed:", err);
      Alert.alert('Link Error', "Failed to initialize tactical group.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // 🛡️ Safe Back Handshake: Forces return to home if stack is empty
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };

  const renderUser = ({ item }: { item: any }) => {
    const isSelected = selectedAgents.find(a => a.id === item.id);
    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => toggleSelectAgent(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.alias || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.alias}</Text>
          <Text style={styles.userType}>GHOST AGENT</Text>
        </View>
        {isSelected && <Check size={20} color={COLORS.terminal_green} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>INITIALIZE GROUP</Text>
        <TouchableOpacity onPress={startGroupChat} disabled={selectedAgents.length === 0 || !groupName || loading}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.terminal_green} />
          ) : (
            <ShieldCheck size={24} color={selectedAgents.length > 0 && groupName ? COLORS.terminal_green : COLORS.stealth_grey} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.nameSection}>
        <Text style={styles.label}>TACTICAL GROUP DESIGNATION</Text>
        <TextInput
          id="group-name-input"
          name="groupName"
          style={styles.nameInput}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="e.g. Task_Force_X"
          placeholderTextColor={COLORS.stealth_grey}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color={COLORS.stealth_grey} />
        <TextInput
          id="group-search-input"
          name="agentSearch"
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={searchUsers}
          placeholder="Search agents to add..."
          placeholderTextColor={COLORS.stealth_grey}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading && !searchQuery && <ActivityIndicator color={COLORS.terminal_green} style={{ marginTop: 20 }} />}

      <Text style={styles.sectionLabel}>
        {selectedAgents.length > 0 && searchQuery.length < 2 ? `SELECTED AGENTS (${selectedAgents.length})` : "IDENTIFIED AGENTS"}
      </Text>

      <FlatList
        data={searchQuery.length < 2 ? selectedAgents : results}
        renderItem={renderUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {searchQuery.length < 2 ? "Select agents from the secure network." : "No agents found in range."}
          </Text>
        }
      />
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
  headerBtn: { padding: 8 },
  headerTitle: { color: COLORS.ghost_white, fontSize: 13, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 2 },
  nameSection: { padding: 20, backgroundColor: COLORS.gunmetal, borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey },
  label: { color: COLORS.terminal_green, fontSize: 9, fontWeight: '700', fontFamily: 'monospace', marginBottom: 8 },
  nameInput: { color: COLORS.ghost_white, fontSize: 16, fontFamily: 'monospace', fontWeight: '700', borderBottomWidth: 1, borderBottomColor: COLORS.border_subtle, paddingVertical: 8 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    margin: 16, backgroundColor: COLORS.gunmetal,
    borderWidth: 1, borderColor: COLORS.border_subtle, borderRadius: 2,
    paddingHorizontal: 16, height: 52,
  },
  searchInput: { flex: 1, color: COLORS.ghost_white, fontSize: 14, fontFamily: 'monospace' },
  sectionLabel: {
    color: COLORS.muted_text, fontSize: 10, fontWeight: '700',
    fontFamily: 'monospace', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 8,
  },
  userItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
    gap: 16,
  },
  userItemSelected: { backgroundColor: 'rgba(0,255,65,0.05)' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.gunmetal, borderWidth: 1, borderColor: COLORS.terminal_green,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: COLORS.terminal_green, fontSize: 18, fontWeight: '700', fontFamily: 'monospace' },
  userInfo: { flex: 1 },
  userName: { color: COLORS.ghost_white, fontSize: 15, fontWeight: '600', fontFamily: 'monospace' },
  userType: { color: COLORS.muted_text, fontSize: 9, fontFamily: 'monospace', marginTop: 4 },
  emptyText: { color: COLORS.stealth_grey, fontSize: 12, fontFamily: 'monospace', textAlign: 'center', marginTop: 60 },
});
