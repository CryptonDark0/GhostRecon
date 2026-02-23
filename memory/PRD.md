# GhostRecon - Secure Messaging Platform v2.0.0

## Overview
GhostRecon is a military-grade secure messaging application designed for privacy-conscious users, security professionals, journalists, and activists. Built with zero-trace communication principles.

## Core Features

### Multi-Layer Encryption
- AES-256-GCM + X25519 encryption protocol for all messages
- SRTP + ZRTP encryption for voice/video calls
- Client-side encryption key management
- Automatic key rotation

### Zero Metadata Architecture
- Minimal server-side data retention
- No message content stored in plaintext
- Forward-protected messages by default
- Self-destructing messages (10s, 30s, 1m, 5m timers)

### Real-time WebSocket Messaging
- WebSocket connection for instant message delivery
- Typing indicators via WebSocket
- Auto-reconnection with keepalive ping
- Server-side connection management per user

### Push Notifications
- Expo push notification registration
- Android notification channels (Messages, Calls)
- Local notifications for incoming messages
- Background notification handling

### Authentication
- **Anonymous Access**: Device fingerprint-only registration, no personal data
- **Pseudonym Registration**: Optional email/phone with codename alias
- JWT token-based session management

### Device-Level Security
- Screenshot protection toggle
- Read receipt blocking
- Typing indicator control
- Link preview prevention (metadata leak protection)
- Auto-delete message scheduling (1, 7, 30, 90 days)

### Advanced Message Control
- Self-destructing messages with configurable timers
- Message recall/unsend capability
- Forward protection on all messages
- End-to-end encryption indicators

### Stealth & Panic Features
- **Decoy Mode**: Calculator disguise app (enter code 1337= to unlock)
- **Panic Wipe**: Emergency destruction of all data
- Two-step confirmation for panic wipe

### Secure Voice & Video Calls
- Voice and video call initiation
- SRTP + ZRTP encryption display
- Call duration tracking
- Mute/camera toggle controls

### Military-Level Key Management
- Key rotation capability
- Key fingerprint display (SHA-256 hash)
- Encryption status visualization
- Trust level system for contacts (1-5 bars)

## Technical Stack
- **Frontend**: React Native / Expo SDK 54
- **Backend**: Python FastAPI with WebSocket support
- **Database**: MongoDB
- **Auth**: JWT (HS256)
- **Real-time**: WebSocket (FastAPI native)
- **Notifications**: expo-notifications
- **Build**: EAS Build (eas.json configured)

## Launch Readiness

### Ready for Launch
- Custom app icon and splash screen (Shield + G branding)
- EAS build config for development, preview, and production
- Android permissions (Camera, Mic, Contacts, Biometrics)
- iOS permissions with App Store-compliant descriptions
- Push notification channels configured

### Requires Production Setup
- Apple Developer account + bundle ID setup
- Google Play Console + keystore
- Production MongoDB Atlas
- Production backend hosting (Railway/Render/AWS)
- Replace EAS submit placeholder credentials
