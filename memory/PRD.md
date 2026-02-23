# GhostRecon - Secure Messaging Platform

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
- **Panic Wipe**: Emergency destruction of all data (messages, contacts, calls, conversations)
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

### Contact Management
- Trust network with verification levels
- Contact search by codename
- Trust level assignment and modification

## Technical Stack
- **Frontend**: React Native / Expo (SDK 54)
- **Backend**: Python FastAPI
- **Database**: MongoDB
- **Auth**: JWT (HS256)
- **Encryption**: bcrypt for passwords, SHA-256 for key hashing

## API Endpoints
- POST /api/auth/register/anonymous
- POST /api/auth/register/pseudonym
- POST /api/auth/login
- GET /api/auth/me
- CRUD /api/contacts
- CRUD /api/conversations
- CRUD /api/messages
- CRUD /api/calls
- GET/PUT /api/security/settings
- POST /api/security/rotate-keys
- POST /api/security/panic-wipe
- GET /api/security/session-info
- GET /api/users/search
- POST /api/seed

## Design
- Dark/stealth military theme
- Colors: Void Black (#050505), Terminal Green (#00FF41), Alert Amber (#FFB000), Critical Red (#FF3B30)
- Monospace typography for tactical feel
- Sharp borders, minimal animations
