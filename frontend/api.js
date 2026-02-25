// api.js
import { BASE_URL } from './config';

// ========================
// Helper Functions
// ========================

// GET requests
async function getRequest(url, token) {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: token
      ? { Authorization: `Bearer ${token}` }
      : undefined,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Request failed');
  }
  return await res.json();
}

// POST / PUT / DELETE requests
async function sendRequest(url, method, body, token) {
  const res = await fetch(`${BASE_URL}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Request failed');
  }
  return await res.json();
}

// ========================
// AUTH
// ========================
export const auth = {
  login: (identifier, password) =>
    sendRequest('/auth/login', 'POST', { identifier, password }),

  getMe: (token) => getRequest('/auth/me', token),

  // FIXED: send required body for anonymous registration
  registerAnonymous: (device_fingerprint, alias) =>
    sendRequest('/auth/register/anonymous', 'POST', { device_fingerprint, alias }),

  registerPseudonym: (username, password) =>
    sendRequest('/auth/register/pseudonym', 'POST', { username, password }),
};

// ========================
// CONTACTS
// ========================
export const contacts = {
  getAll: (token) => getRequest('/contacts', token),

  add: (token, contact_id) =>
    sendRequest('/contacts', 'POST', { contact_id }, token),

  updateTrust: (token, contact_id, trust_level) =>
    sendRequest(`/contacts/${contact_id}/trust`, 'PUT', { trust_level }, token),

  delete: (token, contact_id) =>
    sendRequest(`/contacts/${contact_id}`, 'DELETE', null, token),
};

// ========================
// CONVERSATIONS & MESSAGES
// ========================
export const conversations = {
  getAll: (token) => getRequest('/conversations', token),

  get: (token, conv_id) => getRequest(`/conversations/${conv_id}`, token),

  create: (token, participants) =>
    sendRequest('/conversations', 'POST', { participants }, token),
};

export const messages = {
  get: (token, conv_id) => getRequest(`/messages/${conv_id}`, token),

  send: (token, conversation_id, content) =>
    sendRequest('/messages', 'POST', { conversation_id, content }, token),

  recall: (token, message_id) =>
    sendRequest(`/messages/${message_id}`, 'DELETE', null, token),
};

// ========================
// CALLS
// ========================
export const calls = {
  getAll: (token) => getRequest('/calls', token),

  initiate: (token, contact_id) =>
    sendRequest('/calls', 'POST', { contact_id }, token),

  end: (token, call_id) => sendRequest(`/calls/${call_id}/end`, 'PUT', null, token),

  accept: (token, call_id) => sendRequest(`/calls/${call_id}/accept`, 'PUT', null, token),

  reject: (token, call_id) => sendRequest(`/calls/${call_id}/reject`, 'PUT', null, token),

  signal: (token, signalData) => sendRequest('/calls/signal', 'POST', signalData, token),
};

// ========================
// SECURITY
// ========================
export const security = {
  getSettings: (token) => getRequest('/security/settings', token),

  updateSettings: (token, settings) =>
    sendRequest('/security/settings', 'PUT', settings, token),

  rotateKeys: (token) => sendRequest('/security/rotate-keys', 'POST', null, token),

  panicWipe: (token) => sendRequest('/security/panic-wipe', 'POST', null, token),

  sessionInfo: (token) => getRequest('/security/session-info', token),
};

// ========================
// KEYS
// ========================
export const keys = {
  publish: (token, public_key) =>
    sendRequest('/keys/publish', 'POST', { public_key }, token),

  getUserKey: (token, user_id) => getRequest(`/keys/${user_id}`, token),
};

// ========================
// GROUPS
// ========================
export const groups = {
  distributeKey: (token, data) =>
    sendRequest('/groups/distribute-key', 'POST', data, token),

  getGroupKey: (token, conv_id) => getRequest(`/groups/${conv_id}/key`, token),

  rotateGroupKey: (token, conv_id) =>
    sendRequest(`/groups/${conv_id}/rotate-key`, 'POST', null, token),
};

// ========================
// PROFILE
// ========================
export const profile = {
  uploadPhoto: (token, formData) =>
    fetch(`${BASE_URL}/profile/photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) throw new Error('Failed to upload photo');
      return res.json();
    }),

  deletePhoto: (token) => sendRequest('/profile/photo', 'DELETE', null, token),

  viewPhoto: (token, user_id) => getRequest(`/profile/photo/${user_id}`, token),
};

// ========================
// WEBRTC
// ========================
export const webrtc = {
  getConfig: (token) => getRequest('/webrtc/config', token),
};

// ========================
// USERS
// ========================
export const users = {
  search: (token, query) =>
    getRequest(`/users/search?query=${encodeURIComponent(query)}`, token),
};

// ========================
// MISC
// ========================
export const misc = {
  seed: (token) => sendRequest('/seed', 'POST', null, token),

  registerPushToken: (token, push_token) =>
    sendRequest('/notifications/register', 'POST', { push_token }, token),

  health: () => getRequest('/health'),

  root: () => getRequest('/'),
};
