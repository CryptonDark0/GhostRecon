import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Image, Alert, ActivityIndicator, Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Camera, Eye, Clock, Trash2, Shield } from 'lucide-react-native';
import { COLORS } from '../src/constants';
import { apiCall, getUser } from '../src/api';

export default function ProfilePhotoScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const [user, setUserState] = useState<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoInfo, setPhotoInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [maxViews, setMaxViews] = useState(1);
  const [expirySeconds, setExpirySeconds] = useState<number | null>(null);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const u = await getUser();
    setUserState(u);

    if (userId && userId !== u?.id) {
      // Viewing someone else's photo
      setViewMode(true);
      try {
        const data = await apiCall(`/profile/photo/${userId}`);
        setPhoto(data.photo_data);
        setPhotoInfo(data);

        // Auto-fade for disappearing effect
        if (data.max_views && data.view_count >= data.max_views - 1) {
          setTimeout(() => {
            Animated.timing(fadeAnim, { toValue: 0, duration: 3000, useNativeDriver: true }).start(() => {
              setPhoto(null);
              Alert.alert('Photo Disappeared', 'This photo has reached its view limit.');
            });
          }, 5000);
        }
      } catch {
        setPhoto(null);
      }
    } else {
      // Own photo management
      try {
        const data = await apiCall(`/profile/photo/${u?.id}`);
        setPhoto(data.photo_data);
        setPhotoInfo(data);
      } catch {}
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera access needed');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const uploadPhoto = async () => {
    if (!photo) return;
    setLoading(true);
    try {
      await apiCall('/profile/photo', {
        method: 'POST',
        body: JSON.stringify({
          photo_data: photo,
          disappear_after_views: maxViews,
          disappear_after_seconds: expirySeconds,
        }),
      });
      Alert.alert('Uploaded', `Photo will disappear after ${maxViews} view(s)`);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = async () => {
    try {
      await apiCall('/profile/photo', { method: 'DELETE' });
      setPhoto(null);
      setPhotoInfo(null);
      Alert.alert('Deleted', 'Profile photo removed');
    } catch {}
  };

  const viewOptions = [1, 3, 5, 10];
  const expiryOptions = [null, 3600, 86400, 604800];
  const expiryLabel = (s: number | null) => {
    if (!s) return 'NONE';
    if (s === 3600) return '1H';
    if (s === 86400) return '1D';
    return '7D';
  };

  if (viewMode) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={24} color={COLORS.ghost_white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>DISAPPEARING PHOTO</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.viewContent}>
          {photo ? (
            <Animated.View style={[styles.photoContainer, { opacity: fadeAnim }]}>
              <Image source={{ uri: photo }} style={styles.fullPhoto} />
              <View style={styles.viewOverlay}>
                <Eye size={16} color={COLORS.critical_red} />
                <Text style={styles.viewCount}>
                  View {(photoInfo?.view_count || 0) + 1} of {photoInfo?.max_views || 1}
                </Text>
              </View>
            </Animated.View>
          ) : (
            <View style={styles.noPhotoView}>
              <Shield size={48} color={COLORS.stealth_grey} />
              <Text style={styles.noPhotoText}>NO PHOTO AVAILABLE</Text>
              <Text style={styles.noPhotoSub}>Photo may have disappeared</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} activeOpacity={0.7}>
          <ChevronLeft size={24} color={COLORS.ghost_white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROFILE PHOTO</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.photoPreview}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholder}>
              <Camera size={40} color={COLORS.stealth_grey} />
              <Text style={styles.placeholderText}>NO PHOTO</Text>
            </View>
          )}
        </View>

        <View style={styles.photoActions}>
          <TouchableOpacity testID="pick-photo-btn" style={styles.actionBtn} onPress={pickImage} activeOpacity={0.7}>
            <Text style={styles.actionBtnText}>GALLERY</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="take-photo-btn" style={styles.actionBtn} onPress={takePhoto} activeOpacity={0.7}>
            <Camera size={16} color={COLORS.terminal_green} />
            <Text style={styles.actionBtnText}>CAMERA</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingSection}>
          <Text style={styles.settingLabel}>DISAPPEAR AFTER VIEWS</Text>
          <View style={styles.optionsRow}>
            {viewOptions.map((v) => (
              <TouchableOpacity
                key={v}
                testID={`views-${v}`}
                style={[styles.optionBtn, maxViews === v && styles.optionBtnActive]}
                onPress={() => setMaxViews(v)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, maxViews === v && styles.optionTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.settingLabel, { marginTop: 20 }]}>AUTO-EXPIRE</Text>
          <View style={styles.optionsRow}>
            {expiryOptions.map((e) => (
              <TouchableOpacity
                key={String(e)}
                testID={`expiry-${e || 'none'}`}
                style={[styles.optionBtn, expirySeconds === e && styles.optionBtnActive]}
                onPress={() => setExpirySeconds(e)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, expirySeconds === e && styles.optionTextActive]}>{expiryLabel(e)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {photo && (
          <View style={styles.bottomActions}>
            <TouchableOpacity
              testID="upload-photo-btn"
              style={styles.uploadBtn}
              onPress={uploadPhoto}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.void_black} />
              ) : (
                <Text style={styles.uploadBtnText}>SET DISAPPEARING PHOTO</Text>
              )}
            </TouchableOpacity>

            {photoInfo && (
              <TouchableOpacity testID="delete-photo-btn" style={styles.deleteBtn} onPress={deletePhoto} activeOpacity={0.7}>
                <Trash2 size={16} color={COLORS.critical_red} />
                <Text style={styles.deleteBtnText}>DELETE PHOTO</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  photoPreview: { alignItems: 'center', marginBottom: 24 },
  previewImage: { width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: COLORS.terminal_green },
  placeholder: {
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 2, borderColor: COLORS.border_subtle, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.gunmetal,
  },
  placeholderText: { color: COLORS.stealth_grey, fontSize: 10, fontFamily: 'monospace', marginTop: 8 },
  photoActions: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 32 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.terminal_green,
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 2,
  },
  actionBtnText: { color: COLORS.terminal_green, fontSize: 12, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  settingSection: {},
  settingLabel: { color: COLORS.muted_text, fontSize: 10, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1, marginBottom: 10 },
  optionsRow: { flexDirection: 'row', gap: 8 },
  optionBtn: { paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border_subtle, borderRadius: 2 },
  optionBtnActive: { borderColor: COLORS.terminal_green, backgroundColor: 'rgba(0,255,65,0.1)' },
  optionText: { color: COLORS.muted_text, fontSize: 13, fontWeight: '600', fontFamily: 'monospace' },
  optionTextActive: { color: COLORS.terminal_green },
  bottomActions: { marginTop: 32, gap: 12 },
  uploadBtn: { height: 52, backgroundColor: COLORS.terminal_green, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  uploadBtnText: { color: COLORS.void_black, fontSize: 14, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 1 },
  deleteBtn: {
    height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.critical_red, borderRadius: 2,
  },
  deleteBtnText: { color: COLORS.critical_red, fontSize: 12, fontWeight: '600', fontFamily: 'monospace', letterSpacing: 1 },
  viewContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoContainer: { alignItems: 'center' },
  fullPhoto: { width: 300, height: 300, borderRadius: 8, borderWidth: 1, borderColor: COLORS.terminal_green },
  viewOverlay: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(255,59,48,0.15)', borderWidth: 1, borderColor: COLORS.critical_red, borderRadius: 2,
  },
  viewCount: { color: COLORS.critical_red, fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  noPhotoView: { alignItems: 'center' },
  noPhotoText: { color: COLORS.stealth_grey, fontSize: 14, fontFamily: 'monospace', letterSpacing: 2, marginTop: 16 },
  noPhotoSub: { color: COLORS.stealth_grey, fontSize: 11, fontFamily: 'monospace', marginTop: 4 },
});
