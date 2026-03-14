// C:/sonsofunity/GhostRecon/frontend/public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD7GwolkRw6yIiEr2IBt8ahzSUqpoYG9JA",
  authDomain: "ghostrecon-9c294.firebaseapp.com",
  projectId: "ghostrecon-9c294",
  storageBucket: "ghostrecon-9c294.firebasestorage.app",
  messagingSenderId: "325419022469",
  appId: "1:325419022469:web:8c1de9b1c46be85d6811ec",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[GHOST-SW] Background Message:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/assets/images/icon.png',
    tag: 'ghost-recon-call',
    renotify: true,
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
