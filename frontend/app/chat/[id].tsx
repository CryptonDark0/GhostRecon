import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Send, Lock, Clock, Shield, Phone, Video, Trash2 } from 'lucide-react-native';
import { COLORS } from '../../src/constants';
import { apiCall, getUser } from '../../src/api';
import { useWebSocket, sendWsMessage } from '../../src/websocket';
import { sendLocalNotification } from '../../src/notifications';

export default function ChatDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [user, setUserState] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [selfDestruct, setSelfDestruct] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // WebSocket for real-time messages
  const onWsMessage = useCallback((msg: any) => {
    if (msg.type === 'new_message' && msg.message?.conversation_id === id) {
      setMessages(prev => [...prev, msg.message]);
      sendLocalNotification(
        `${msg.message.sender_alias}`,
        msg.message.content,
        { conversationId: id }
      );
    }
    if (msg.type === 'typing' && msg.conversation_id === id) {
      setTyping(true);
      setTimeout(() => setTyping(false), 3000);
    }
  }, [id]);

  useWebSocket(onWsMessage);

  useEffect(() => {
    loadChat();
  }, []);

  const loadChat = async () => {
    try {
      const u = await getUser();
      setUserState(u);
      const conv = await apiCall(`/conversations/${id}`);
      setConversation(conv);
      await loadMessages();
    } catch (err) {
      console.log('Load chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const msgs = await apiCall(`/messages/${id}`);
      setMessages(msgs);
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    try {
      await apiCall('/messages', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: id,
          content: text,
          self_destruct_seconds: selfDestruct,
          forward_protected: true,
        }),
      });
      await loadMessages();
    } catch {}
  };

  const recallMessage = async (messageId: string) => {
    try {
      await apiCall(`/messages/${messageId}`, { method: 'DELETE' });
      await loadMessages();
    } catch {}
  };

  const timerOptions = [null, 10, 30, 60, 300];
  const timerLabel = (s: number | null) => {
    if (s === null) return 'OFF';
    if (s < 60) return `${s}s`;
    return `${s / 60}m`;
  };

  const encryptionHash = conversation?.encryption_protocol || 'AES-256-GCM';

  const renderMessage = ({ item }: { item: any }) => {
    const isMine = item.sender_id === user?.id;
    return (
      <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
        <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
          {!isMine && <Text style={styles.msgSender}>{item.sender_alias}</Text>}
          <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
          <View style={styles.msgMeta}>
            {item.self_destruct_seconds && (
              <View style={styles.timerBadge}>
                <Clock size={10} color={COLORS.critical_red} />
                <Text style={styles.timerText}>{item.self_destruct_seconds}s</Text>
              </View>
            )}
            <Lock size={10} color={isMine ? COLORS.void_black : COLORS.terminal_green} />
            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          {isMine && (
            <TouchableOpacity
              testID={`recall-${item.id}`}
              style={styles.recallBtn}
              onPress={() => recallMessage(item.id)}
              activeOpacity={0.7}
            >
              <Trash2 size={12} color={COLORS.critical_red} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.terminal_green} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="chat-back-btn" onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerRow}>
            <Shield size={14} color={COLORS.terminal_green} />
            <Text style={styles.headerTitle}>ENCRYPTED CHANNEL</Text>
          </View>
          <Text style={styles.headerHash}>{encryptionHash}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity testID="voice-call-btn" style={styles.headerIconBtn} activeOpacity={0.7}
            onPress={() => router.push(`/call/voice?target=${conversation?.participants?.find((p: string) => p !== user?.id) || ''}`)}
          >
            <Phone size={18} color={COLORS.terminal_green} />
          </TouchableOpacity>
          <TouchableOpacity testID="video-call-btn" style={styles.headerIconBtn} activeOpacity={0.7}
            onPress={() => router.push(`/call/video?target=${conversation?.participants?.find((p: string) => p !== user?.id) || ''}`)}
          >
            <Video size={18} color={COLORS.terminal_green} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          testID="messages-list"
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Lock size={32} color={COLORS.stealth_grey} />
              <Text style={styles.emptyChatText}>SECURE CHANNEL ESTABLISHED</Text>
              <Text style={styles.emptyChatSub}>Messages are end-to-end encrypted</Text>
            </View>
          }
        />

        <View style={styles.timerRow}>
          <Clock size={14} color={COLORS.muted_text} />
          <Text style={styles.timerRowLabel}>SELF-DESTRUCT:</Text>
          {timerOptions.map((t) => (
            <TouchableOpacity
              key={String(t)}
              testID={`timer-${t || 'off'}`}
              style={[styles.timerOption, selfDestruct === t && styles.timerOptionActive]}
              onPress={() => setSelfDestruct(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.timerOptionText, selfDestruct === t && styles.timerOptionTextActive]}>
                {timerLabel(t)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputArea}>
          <TextInput
            testID="message-input"
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type encrypted message..."
            placeholderTextColor={COLORS.stealth_grey}
            multiline
          />
          <TouchableOpacity
            testID="send-btn"
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim()}
            activeOpacity={0.7}
          >
            <Send size={20} color={input.trim() ? COLORS.void_black : COLORS.stealth_grey} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.void_black },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.armour_grey,
    backgroundColor: COLORS.gunmetal,
  },
  headerCenter: { flex: 1, marginLeft: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { color: COLORS.terminal_green, fontSize: 13, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  headerHash: { color: COLORS.muted_text, fontSize: 9, fontFamily: 'monospace', marginTop: 2, letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border_subtle, borderRadius: 2 },
  messagesList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  msgRow: { marginBottom: 8, alignItems: 'flex-start' },
  msgRowMine: { alignItems: 'flex-end' },
  msgBubble: { maxWidth: '80%', padding: 12, borderRadius: 2, position: 'relative' },
  msgBubbleMine: { backgroundColor: COLORS.terminal_green },
  msgBubbleOther: { backgroundColor: COLORS.gunmetal, borderLeftWidth: 2, borderLeftColor: COLORS.terminal_green },
  msgSender: { color: COLORS.terminal_green, fontSize: 10, fontWeight: '700', fontFamily: 'monospace', marginBottom: 4, letterSpacing: 1 },
  msgText: { color: COLORS.ghost_white, fontSize: 14, lineHeight: 20 },
  msgTextMine: { color: COLORS.void_black },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  timerText: { color: COLORS.critical_red, fontSize: 9, fontFamily: 'monospace' },
  msgTime: { color: COLORS.muted_text, fontSize: 9, fontFamily: 'monospace' },
  msgTimeMine: { color: 'rgba(5,5,5,0.6)' },
  recallBtn: { position: 'absolute', top: 4, right: 4, padding: 4 },
  emptyChat: { alignItems: 'center', paddingTop: 100 },
  emptyChatText: { color: COLORS.stealth_grey, fontSize: 13, fontFamily: 'monospace', marginTop: 12, letterSpacing: 2 },
  emptyChatSub: { color: COLORS.stealth_grey, fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
  timerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: COLORS.armour_grey,
    backgroundColor: COLORS.gunmetal,
  },
  timerRowLabel: { color: COLORS.muted_text, fontSize: 9, fontFamily: 'monospace', letterSpacing: 1 },
  timerOption: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.border_subtle, borderRadius: 2,
  },
  timerOptionActive: { borderColor: COLORS.critical_red, backgroundColor: 'rgba(255,59,48,0.15)' },
  timerOptionText: { color: COLORS.muted_text, fontSize: 10, fontFamily: 'monospace' },
  timerOptionTextActive: { color: COLORS.critical_red },
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
    borderTopWidth: 1, borderTopColor: COLORS.armour_grey,
    backgroundColor: COLORS.gunmetal,
  },
  input: {
    flex: 1, backgroundColor: COLORS.void_black,
    borderWidth: 1, borderColor: COLORS.border_subtle, borderRadius: 2,
    color: COLORS.ghost_white, fontSize: 14, fontFamily: 'monospace',
    paddingHorizontal: 12, paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, backgroundColor: COLORS.terminal_green,
    borderRadius: 2, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.armour_grey },
});
