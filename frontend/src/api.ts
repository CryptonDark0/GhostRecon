import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from './constants';

const TOKEN_KEY = 'ghostrecon_token';
const USER_KEY = 'ghostrecon_user';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function getUser(): Promise<any | null> {
  const u = await AsyncStorage.getItem(USER_KEY);
  return u ? JSON.parse(u) : null;
}

export async function setUser(user: any): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}
