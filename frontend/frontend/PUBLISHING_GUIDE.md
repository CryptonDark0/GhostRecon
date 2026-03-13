# 📱 GhostRecon App - Publishing Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Building APK for Android](#building-apk-for-android)
3. [Building for iOS](#building-for-ios)
4. [Publishing to Google Play Store](#publishing-to-google-play-store)
5. [Publishing to Apple App Store](#publishing-to-apple-app-store)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Install EAS CLI
```bash
npm install -g eas-cli
```

### 2. Create Expo Account
- Go to https://expo.dev/signup
- Create a free account

### 3. Login to EAS
```bash
eas login
```

### 4. Configure Project ID
```bash
cd frontend
eas init
```

---

## Building APK for Android

### Option A: Build APK in Cloud (Recommended)

#### Development APK (for testing)
```bash
cd frontend
eas build --platform android --profile development
```

#### Preview APK (for internal testing)
```bash
cd frontend
eas build --platform android --profile preview
```

#### Production APK (for distribution)
```bash
cd frontend
eas build --platform android --profile production-apk
```

#### Production AAB (for Google Play Store)
```bash
cd frontend
eas build --platform android --profile production
```

### Option B: Build APK Locally

#### Prerequisites for Local Build
- Java Development Kit (JDK) 17+
- Android SDK
- Android Studio (recommended)

#### Steps:
```bash
# Navigate to android folder
cd frontend/android

# Build debug APK
./gradlew assembleDebug

# Build release APK (requires signing config)
./gradlew assembleRelease

# APK location:
# Debug: android/app/build/outputs/apk/debug/app-debug.apk
# Release: android/app/build/outputs/apk/release/app-release.apk
```

---

## Building for iOS

### Prerequisites
- Mac computer with Xcode installed
- Apple Developer Account ($99/year)
- Valid iOS Distribution Certificate
- App Store Provisioning Profile

### Option A: Build in Cloud with EAS

#### Development Build (Simulator)
```bash
cd frontend
eas build --platform ios --profile development
```

#### Preview Build (TestFlight)
```bash
cd frontend
eas build --platform ios --profile preview
```

#### Production Build (App Store)
```bash
cd frontend
eas build --platform ios --profile production
```

### Option B: Build Locally with Xcode

```bash
# Navigate to ios folder
cd frontend/ios

# Install CocoaPods dependencies
pod install

# Open Xcode workspace
open GhostRecon.xcworkspace

# In Xcode:
# 1. Select your development team
# 2. Configure signing & capabilities
# 3. Select "Any iOS Device (arm64)"
# 4. Product → Archive
# 5. Distribute to App Store / Ad Hoc / Development
```

---

## Publishing to Google Play Store

### Step 1: Create Google Play Developer Account
- Go to https://play.google.com/console
- Pay one-time $25 registration fee
- Complete identity verification

### Step 2: Create App in Play Console
1. Click "Create app"
2. Fill in app details:
   - App name: **GhostRecon**
   - Default language: English
   - App type: App (not Game)
   - Free or Paid: Choose your pricing

### Step 3: Prepare Store Listing
Required assets:
- **App icon**: 512x512 PNG
- **Feature graphic**: 1024x500 PNG
- **Screenshots**: Minimum 2, up to 8 per device type
  - Phone: 16:9 or 9:16 aspect ratio
  - Tablet (optional): 16:9 or 9:16
- **Short description**: Max 80 characters
- **Full description**: Max 4000 characters
- **Privacy policy URL**: Required

### Step 4: Configure App Content
Complete these sections in Play Console:
- [ ] App access (if login required, provide test credentials)
- [ ] Ads declaration
- [ ] Content rating questionnaire
- [ ] Target audience
- [ ] News app declaration
- [ ] COVID-19 declaration
- [ ] Data safety form

### Step 5: Setup Service Account for Automated Submission

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create a new project or select existing
3. Enable "Google Play Android Developer API"
4. Create Service Account:
   - IAM & Admin → Service Accounts → Create
   - Name: "EAS Submit"
   - Grant role: "Service Account User"
5. Create JSON key:
   - Click on service account → Keys → Add Key → Create new key → JSON
6. Download and save as `google-service-account.json` in `/frontend/`
7. In Play Console:
   - Users and permissions → Invite new users
   - Add service account email
   - Grant "Release manager" permissions

### Step 6: Submit Your App

#### Using EAS Submit (Automated)
```bash
# Build production AAB first
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android

# Or build and submit in one command
eas build --platform android --profile production --auto-submit
```

#### Manual Upload
1. Download AAB from EAS dashboard
2. Go to Play Console → Release → Production
3. Create new release
4. Upload AAB file
5. Add release notes
6. Review and rollout

### Step 7: Review Process
- Initial review: 1-7 days
- Updates: Usually 1-3 days
- Address any policy violations promptly

---

## Publishing to Apple App Store

### Step 1: Apple Developer Program
- Enroll at https://developer.apple.com/programs/
- Cost: $99/year (individual) or $299/year (organization)
- Verification takes 1-2 business days

### Step 2: Configure App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click "My Apps" → "+" → "New App"
3. Fill in details:
   - **Platform**: iOS
   - **Name**: GhostRecon
   - **Primary language**: English
   - **Bundle ID**: com.ghostrecon.app
   - **SKU**: ghostrecon-ios-app

### Step 3: Prepare App Information

#### Required Metadata
- **Subtitle**: Max 30 characters
- **Promotional Text**: Max 170 characters
- **Description**: Max 4000 characters
- **Keywords**: Max 100 characters total
- **Support URL**: Your website/support page
- **Privacy Policy URL**: Required

#### Required Screenshots
| Device | Size | Count |
|--------|------|-------|
| iPhone 6.9" | 1320 x 2868 | 1-10 |
| iPhone 6.7" | 1290 x 2796 | 1-10 |
| iPhone 6.5" | 1242 x 2688 | 1-10 |
| iPhone 5.5" | 1242 x 2208 | 1-10 |
| iPad Pro 13" | 2048 x 2732 | Optional |
| iPad Pro 12.9" | 2048 x 2732 | Optional |

#### App Icon
- 1024 x 1024 PNG
- No alpha/transparency
- No rounded corners (iOS adds them)

### Step 4: Configure eas.json for iOS Submission

Update `/frontend/eas.json`:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "1234567890",  // App Store Connect App ID
        "appleTeamId": "XXXXXXXXXX" // Your Team ID
      }
    }
  }
}
```

#### Finding Your IDs:
- **Apple ID**: Your Apple account email
- **ASC App ID**: App Store Connect → Your App → General → Apple ID
- **Team ID**: Developer Portal → Membership → Team ID

### Step 5: Build and Submit

#### Using EAS (Recommended)
```bash
# Build for App Store
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios

# Or combined
eas build --platform ios --profile production --auto-submit
```

### Step 6: App Review Process

1. **Binary uploaded**: Build appears in TestFlight
2. **Submit for Review**: Add version info and submit
3. **Review Queue**: Usually 24-48 hours
4. **In Review**: Apple testing your app
5. **Approved/Rejected**: Action required

#### Common Rejection Reasons:
- Missing privacy policy
- Incomplete metadata
- Login required but no demo account provided
- Crashes or bugs
- Guideline violations (4.3, 4.2, 2.1, etc.)

### Step 7: Encryption Compliance (Important!)

Your app uses encryption (as configured in app.json):
```json
"config": {
  "usesNonExemptEncryption": true
}
```

You'll need to:
1. File encryption registration with US BIS
2. Provide CCATS document if required
3. Answer compliance questionnaire in App Store Connect

---

## App Signing

### Android App Signing

#### Option 1: Let EAS Manage (Recommended)
EAS automatically handles keystore generation and management.

#### Option 2: Use Your Own Keystore
```bash
# Generate keystore
keytool -genkeypair -v -storetype PKCS12 -keystore ghostrecon.keystore -alias ghostrecon -keyalg RSA -keysize 2048 -validity 10000

# Configure in eas.json
{
  "build": {
    "production": {
      "android": {
        "credentialsSource": "local"
      }
    }
  }
}

# Set credentials
eas credentials
```

### iOS App Signing
EAS handles certificates and provisioning profiles automatically when you run:
```bash
eas build --platform ios
```

---

## Environment Variables for Production

Create a production `.env` file:
```bash
# /frontend/.env.production
EXPO_PUBLIC_BACKEND_URL=https://your-production-api.com
APP_VARIANT=production
```

Build with production env:
```bash
eas build --platform android --profile production
```

---

## Troubleshooting

### Build Fails with "Module not found"
```bash
cd frontend
rm -rf node_modules
yarn install
npx expo prebuild --clean
eas build
```

### iOS Build Fails - Certificate Issues
```bash
eas credentials --platform ios
# Select "Clear all credentials" if needed
# Then rebuild
```

### Android Build Fails - Gradle Issues
```bash
cd frontend/android
./gradlew clean
cd ..
eas build --platform android --clear-cache
```

### App Rejected - Missing Permissions Description
Update `app.json` with clear descriptions:
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Clear, user-friendly reason"
      }
    }
  }
}
```

---

## Quick Commands Reference

```bash
# Build Development APK
eas build -p android --profile development

# Build Production APK
eas build -p android --profile production-apk

# Build Production AAB (for Play Store)
eas build -p android --profile production

# Build iOS for App Store
eas build -p ios --profile production

# Submit to Play Store
eas submit -p android

# Submit to App Store
eas submit -p ios

# Build + Submit (both platforms)
eas build --platform all --profile production --auto-submit

# Check build status
eas build:list

# View credentials
eas credentials
```

---

## Support

- Expo Documentation: https://docs.expo.dev
- EAS Build: https://docs.expo.dev/build/introduction/
- EAS Submit: https://docs.expo.dev/submit/introduction/
- Google Play Console Help: https://support.google.com/googleplay/android-developer
- App Store Connect Help: https://developer.apple.com/help/app-store-connect/

---

**GhostRecon v2.0.0** | Built with Expo
