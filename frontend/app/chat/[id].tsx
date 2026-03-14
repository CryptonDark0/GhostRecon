import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  FlatList, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image, Modal, Linking, ScrollView, Dimensions
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Send, Lock, Phone, Video, ImageIcon, Paperclip, Clock, Trash2, ShieldAlert, Smile, Search, Ghost, Target, Flame, Zap } from 'lucide-react-native';
import { COLORS } from '../../src/constants';
import { auth, db } from '../../src/firebase';
import { doc, getDoc, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { uploadMedia, setTypingStatus, listenTypingStatus, markAsRead, deleteMessageForEveryone, deleteMessageForMe, addReaction, sendMessage } from '../../src/firestoreService';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

const { width } = Dimensions.get('window');

// 🛡️ SUPREME TACTICAL EMOJI SET (BEST OF THE BEST)
const EMOJI_PACKS = {
  CORE: ['👍', '❤️', '🔥', '😂', '😮', '🎯', '💯', '🫡', '🤝', '⚡'],
  TACTICAL: ['🥷', '💀', '🕵️', '🔫', '⚔️', '💣', '🛡️', '🛰️', '📡', '🧿'],
  STATUS: ['✅', '❌', '⚠️', '🚨', '📣', '🆘', '🛑', '🟢', '🔴', '🔋'],
  OP: ['💪', '🦾', '🧠', '🕶️', '🧤', '🥾', '🧗', '🚁', '🚀', '🛸'],
  INTEL: ['📈', '📉', '📊', '📋', '📁', '📂', '🔍', '📍', '🗺️', '🔒']
};

const ALL_EMOJIS = [...EMOJI_PACKS.CORE, ...EMOJI_PACKS.TACTICAL, ...EMOJI_PACKS.STATUS, ...EMOJI_PACKS.OP, ...EMOJI_PACKS.INTEL];

export default function ChatDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [targetAgent, setTargetAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [typingAgents, setTypingAgents] = useState<string[]>([]);
  const [selfDestruct, setSelfDestruct] = useState<number | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [emojiBarVisible, setEmojiBarVisible] = useState(false);
  const [giphyVisible, setGiphyVisible] = useState(false);
  const [giphyQuery, setGiphyQuery] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!id || !currentUser) return;
    let unsubscribeMessages: () => void;
    let unsubscribeConv: () => void;
    let unsubscribeTyping: () => void;

    const setupChat = async () => {
      try {
        markAsRead(id, currentUser.uid);
        unsubscribeMessages = onSnapshot(query(collection(db, "conversations", id, "messages"), orderBy("created_at", "asc")), (snapshot) => {
          const allMsgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
          const filtered = allMsgs.filter(m => !m.hiddenFor?.includes(currentUser.uid))
            .map(m => ({ ...m, created_at: m.created_at?.toDate() || new Date() }));
          setMessages(filtered);
          setLoading(false);
        });
        unsubscribeConv = onSnapshot(doc(db, "conversations", id), async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const targetId = data.participants.find((p: string) => p !== currentUser.uid);
            onSnapshot(doc(db, "users", targetId), (targetSnap) => {
              if (targetSnap.exists()) setTargetAgent({ uid: targetSnap.id, ...targetSnap.data() });
            });
          }
        });
        unsubscribeTyping = listenTypingStatus(id, (typingIds) => {
          setTypingAgents(typingIds.filter(uid => uid !== currentUser.uid));
        });
      } catch (err) { setLoading(false); }
    };
    setupChat();
    return () => {
      if (unsubscribeConv) unsubscribeConv();
      if (unsubscribeMessages) unsubscribeMessages();
      if (unsubscribeTyping) unsubscribeTyping();
      setTypingStatus(id, currentUser.uid, false);
    };
  }, [id]);

  const handleSendMessage = async (type: string = 'text', mediaUrl: string | null = null, fileSize: number = 0, filePath: string | null = null) => {
    if ((!input.trim() && !mediaUrl) || !currentUser || !id) return;
    const text = input.trim();
    if (type === 'text') setInput('');
    setEmojiBarVisible(false);
    setTypingStatus(id, currentUser.uid, false);

    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const senderAlias = userDoc.exists() ? userDoc.data().alias : 'Ghost';
      await addDoc(collection(db, "conversations", id, "messages"), {
        conversation_id: id, sender_id: currentUser.uid, sender_alias: senderAlias,
        content: text, type, fileUrl: mediaUrl, filePath, fileSize, created_at: serverTimestamp(),
        self_destruct_seconds: selfDestruct,
        hiddenFor: [],
        reactions: {}
      });
      await updateDoc(doc(db, "conversations", id), {
        lastMessageAt: serverTimestamp(),
        lastMessage: type === 'text' ? text : `[Tactical ${type}]`
      });
    } catch (err) { Alert.alert("Link Failed", "Handshake failed."); }
  };

  const searchGiphy = async () => {
    setGiphyLoading(true);
    try {
      const endpoint = giphyQuery.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(giphyQuery)}&limit=30&rating=pg-13`
        : `https://api.giphy.com/v1/gifs/trending?api_key=dc6zaTOxFJmzC&limit=30&rating=pg-13`;
      const resp = await fetch(endpoint);
      const data = await resp.json();
      setGifs(data.data || []);
    } catch (e) {
      console.log("Giphy retrieval failed.");
    } finally {
      setGiphyLoading(false);
    }
  };

  const handleCall = async (callType: 'voice' | 'video') => {
    if (!targetAgent || !id) return;
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser!.uid));
      const senderAlias = userDoc.exists() ? userDoc.data().alias : 'Ghost';
      await addDoc(collection(db, "conversations", id, "messages"), {
        conversation_id: id, sender_id: currentUser!.uid, sender_alias: senderAlias,
        content: `[OUTGOING ${callType.toUpperCase()} CALL]`, type: 'system',
        created_at: serverTimestamp()
      });
    } catch (e) {}
    router.push(`/call/${callType}?target=${targetAgent.uid}`);
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMine = item.sender_id === auth.currentUser?.uid;
    const reactions = Object.values(item.reactions || {});
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => { setSelectedMsg(item); setMenuVisible(true); }}
        onPress={() => item.fileUrl && Linking.openURL(item.fileUrl)}
        style={[styles.msgRow, isMine && styles.msgRowMine]}
      >
        <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
          {!isMine && <Text style={styles.msgSender}>{item.sender_alias}</Text>}
          {item.type === 'image' ? (
            <Image source={{ uri: item.fileUrl }} style={styles.msgImage} resizeMode="cover" />
          ) : item.type === 'file' ? (
            <View style={styles.fileBox}>
              <Paperclip size={16} color={isMine ? "#000" : COLORS.terminal_green} />
              <Text style={[styles.fileText, isMine && {color: "#000"}]}>TACTICAL_INTEL.DAT</Text>
            </View>
          ) : (
            <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
          )}
          {reactions.length > 0 && <View style={styles.reactionBadge}><Text style={styles.reactionText}>{reactions.join('')}</Text></View>}
          <View style={styles.msgMeta}>
            <Lock size={8} color={isMine ? "rgba(0,0,0,0.4)" : COLORS.terminal_green} />
            <Text style={[styles.msgTime, isMine && {color: 'rgba(0,0,0,0.4)'}]}>
              {item.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/home')} style={styles.headerBtn}><ChevronLeft size={24} color="#FFF" /></TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{targetAgent?.alias?.toUpperCase() || "AGENT"}</Text>
          <Text style={[styles.headerStatus, { color: targetAgent?.isOnline ? COLORS.terminal_green : COLORS.critical_red }]}>
            {typingAgents.length > 0 ? "AGENT COMPOSING..." : (targetAgent?.isOnline ? "SECURE LINK ACTIVE" : "OFFLINE")}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => handleCall('voice')}><Phone size={18} color={COLORS.terminal_green} /></TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => handleCall('video')}><Video size={18} color={COLORS.terminal_green} /></TouchableOpacity>
        </View>
      </View>

      <FlatList ref={flatListRef} data={messages} renderItem={renderMessage} keyExtractor={item => item.id} contentContainerStyle={styles.list} onContentSizeChange={() => flatListRef.current?.scrollToEnd()} />

      {emojiBarVisible && (
        <View style={styles.emojiBarWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiBarContent}>
            {ALL_EMOJIS.map((e, index) => (
              <TouchableOpacity key={index} onPress={() => setInput(prev => prev + e)} style={styles.quickEmojiBtn}>
                <Text style={styles.emojiText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.inputArea}>
          <TouchableOpacity onPress={() => setEmojiBarVisible(!emojiBarVisible)} style={styles.iconBtn}>
            <Smile size={22} color={emojiBarVisible ? COLORS.terminal_green : "#888"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setGiphyVisible(true); searchGiphy(); }} style={styles.iconBtn}>
            <Search size={22} color="#888" />
          </TouchableOpacity>
          <TextInput
            style={styles.input} value={input}
            onChangeText={(t) => { setInput(t); setTypingStatus(id!, currentUser!.uid, t.length > 0); }}
            placeholder="Type tactical intel..." placeholderTextColor="#444" multiline
          />
          <TouchableOpacity onPress={() => handleSendMessage()} style={styles.sendBtn}><Send size={20} color="#000" /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={giphyVisible} transparent animationType="slide">
        <SafeAreaView style={styles.giphyOverlay}>
          <View style={styles.giphyHeader}>
            <View style={styles.giphySearchBox}>
              <Search size={18} color="#666" />
              <TextInput style={styles.giphyInput} placeholder="SEARCH GIPHY..." placeholderTextColor="#666" value={giphyQuery} onChangeText={setGiphyQuery} onSubmitEditing={searchGiphy} autoFocus />
            </View>
            <TouchableOpacity onPress={() => setGiphyVisible(false)}><Text style={styles.exitText}>EXIT</Text></TouchableOpacity>
          </View>
          {giphyLoading ? (
            <View style={styles.giphyLoading}><ActivityIndicator color={COLORS.terminal_green} /></View>
          ) : (
            <ScrollView contentContainerStyle={styles.gifGrid}>
              {gifs.map((gif, i) => (
                <TouchableOpacity key={i} onPress={() => { handleSendMessage('image', gif.images.fixed_height.url); setGiphyVisible(false); }}>
                  <Image source={{ uri: gif.images.fixed_height.url }} style={styles.gifThumb} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContent}>
            <View style={styles.reactionRow}>
              {ALL_EMOJIS.slice(0,6).map((emoji, index) => (
                <TouchableOpacity key={index} onPress={async () => { await addReaction(id!, selectedMsg.id, currentUser!.uid, emoji); setMenuVisible(false); }} style={styles.emojiBtn}>
                  <Text style={styles.emojiTextLarge}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.menuItem} onPress={async () => { await deleteMessageForMe(id!, selectedMsg.id, currentUser!.uid); setMenuVisible(false); }}>
              <Trash2 size={18} color="#FFF" /><Text style={styles.menuText}>DELETE FOR ME</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#121212' },
  headerBtn: { padding: 8 },
  headerCenter: { flex: 1, marginLeft: 16 },
  headerTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', fontFamily: 'monospace' },
  headerStatus: { fontSize: 8, fontFamily: 'monospace', marginTop: 2, letterSpacing: 1 },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333', borderRadius: 4 },
  list: { padding: 12 },
  msgRow: { marginBottom: 12, alignItems: 'flex-start' },
  msgRowMine: { alignItems: 'flex-end' },
  msgBubble: { maxWidth: '85%', padding: 12, borderRadius: 4, position: 'relative' },
  msgBubbleMine: { backgroundColor: COLORS.terminal_green },
  msgBubbleOther: { backgroundColor: '#121212', borderLeftWidth: 3, borderLeftColor: COLORS.terminal_green },
  msgSender: { color: COLORS.terminal_green, fontSize: 9, fontWeight: '700', fontFamily: 'monospace', marginBottom: 4 },
  msgText: { color: '#FFF', fontSize: 14, lineHeight: 20 },
  msgTextMine: { color: '#000', fontWeight: '600' },
  msgImage: { width: 200, height: 200, borderRadius: 4 },
  fileBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.1)', padding: 10 },
  fileText: { color: COLORS.terminal_green, fontSize: 12, fontFamily: 'monospace' },
  msgMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, justifyContent: 'flex-end' },
  msgTime: { fontSize: 8, color: '#666', fontFamily: 'monospace' },
  inputArea: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#121212' },
  emojiBarWrapper: { backgroundColor: '#121212', borderTopWidth: 1, borderTopColor: '#222', height: 60 },
  emojiBarContent: { paddingHorizontal: 15, alignItems: 'center', gap: 20 },
  quickEmojiBtn: { justifyContent: 'center', alignItems: 'center' },
  emojiText: { fontSize: 26, color: '#FFF' },
  emojiTextLarge: { fontSize: 32, color: '#FFF' },
  iconBtn: { padding: 4 },
  input: { flex: 1, backgroundColor: '#000', color: '#FFF', padding: 10, fontFamily: 'monospace', borderRadius: 4 },
  sendBtn: { width: 44, height: 44, backgroundColor: COLORS.terminal_green, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  menuContent: { width: '80%', backgroundColor: '#121212', borderRadius: 4, padding: 20, borderWidth: 1, borderColor: '#333' },
  reactionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  emojiBtn: { padding: 5 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  menuText: { color: '#FFF', fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  reactionBadge: { position: 'absolute', bottom: -8, right: 10, backgroundColor: '#1A1A1A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  reactionText: { fontSize: 10, color: '#FFF' },
  giphyOverlay: { flex: 1, backgroundColor: '#050505' },
  giphyHeader: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  giphySearchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#121212', paddingHorizontal: 12, borderRadius: 4 },
  giphyInput: { flex: 1, height: 44, color: '#FFF', fontFamily: 'monospace', fontSize: 12 },
  giphyLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  exitText: { color: COLORS.critical_red, fontWeight: '900', fontFamily: 'monospace' },
  gifGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8, justifyContent: 'center' },
  gifThumb: { width: (width / 2) - 16, height: 120, borderRadius: 4, backgroundColor: '#111' }
});
