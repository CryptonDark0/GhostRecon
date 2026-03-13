// useAPI.js
import { useAuth } from './AuthContext';
import * as api from './api';

export const useAPI = () => {
  const { token } = useAuth();

  // Wrap all API functions to automatically include token
  const wrapWithToken = (fn) => (...args) => fn(token, ...args);

  return {
    auth: {
      login: api.auth.login,
      registerAnonymous: api.auth.registerAnonymous,
      registerPseudonym: api.auth.registerPseudonym,
      getMe: wrapWithToken(api.auth.getMe),
    },
    contacts: {
      getAll: wrapWithToken(api.contacts.getAll),
      add: wrapWithToken(api.contacts.add),
      updateTrust: wrapWithToken(api.contacts.updateTrust),
      delete: wrapWithToken(api.contacts.delete),
    },
    conversations: {
      getAll: wrapWithToken(api.conversations.getAll),
      get: wrapWithToken(api.conversations.get),
      create: wrapWithToken(api.conversations.create),
    },
    messages: {
      get: wrapWithToken(api.messages.get),
      send: wrapWithToken(api.messages.send),
      recall: wrapWithToken(api.messages.recall),
    },
    calls: {
      getAll: wrapWithToken(api.calls.getAll),
      initiate: wrapWithToken(api.calls.initiate),
      end: wrapWithToken(api.calls.end),
      accept: wrapWithToken(api.calls.accept),
      reject: wrapWithToken(api.calls.reject),
      signal: wrapWithToken(api.calls.signal),
    },
    security: {
      getSettings: wrapWithToken(api.security.getSettings),
      updateSettings: wrapWithToken(api.security.updateSettings),
      rotateKeys: wrapWithToken(api.security.rotateKeys),
      panicWipe: wrapWithToken(api.security.panicWipe),
      sessionInfo: wrapWithToken(api.security.sessionInfo),
    },
    keys: {
      publish: wrapWithToken(api.keys.publish),
      getUserKey: wrapWithToken(api.keys.getUserKey),
    },
    groups: {
      distributeKey: wrapWithToken(api.groups.distributeKey),
      getGroupKey: wrapWithToken(api.groups.getGroupKey),
      rotateGroupKey: wrapWithToken(api.groups.rotateGroupKey),
    },
    profile: {
      uploadPhoto: wrapWithToken(api.profile.uploadPhoto),
      deletePhoto: wrapWithToken(api.profile.deletePhoto),
      viewPhoto: wrapWithToken(api.profile.viewPhoto),
    },
    webrtc: {
      getConfig: wrapWithToken(api.webrtc.getConfig),
    },
    users: {
      search: wrapWithToken(api.users.search),
    },
    misc: {
      seed: wrapWithToken(api.misc.seed),
      registerPushToken: wrapWithToken(api.misc.registerPushToken),
      health: api.misc.health,
      root: api.misc.root,
    },
  };
};
