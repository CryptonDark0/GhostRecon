# GhostRecon Setup and Development Guide

This guide provides all the necessary steps to set up, build, and run the GhostRecon application for development and production.

## 1. Prerequisites

Before you begin, ensure you have the following installed on your development machine:
- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Yarn](https://classic.yarnpkg.com/en/docs/install) (the project uses Yarn for package management)
- [Git](https://git-scm.com/)
- [Watchman](https://facebook.github.io/watchman/) (for macOS users)
- An Android Emulator (via [Android Studio](https://developer.android.com/studio)) or a physical Android device.

## 2. Project Setup

Follow these steps to get the project running on your local machine.

### Step 2.1: Clone the Repository
Clone this repository to your local machine:
'''sh
git clone <your-repository-url>
cd GhostRecon/frontend
'''

### Step 2.2: Install Dependencies
Install the required Node.js packages using Yarn:
'''sh
yarn install
'''

## 3. Critical Firebase Configuration (Android)

The project uses Firebase for core features like authentication and notifications. You **must** configure it correctly to avoid API failures.

### Step 3.1: Obtain Firebase Configuration File
1.  Go to your project's settings in the [Firebase Console](https://console.firebase.google.com/).
2.  In the "Your apps" card, select your Android app (package name: `com.sonsofunity.ghostrecon`).
3.  Under "SDK setup and configuration", click the **`google-services.json`** button to download the configuration file.

### Step 3.2: Place the Configuration File
Copy the downloaded `google-services.json` file into the following directory:
'''
frontend/android/app/
'''

### Step 3.3: Upgrade to Firebase Blaze Plan
During development, we discovered that the app quickly exceeds the free "Spark Plan" quota for Firebase services, leading to a `RESOURCE_EXHAUSTED` error that prevents login.

**To fix this, you must upgrade your Firebase project to the "Blaze" (Pay-as-you-go) plan.**
- Go to the **Usage and billing** section in your Firebase console and follow the instructions to upgrade.
- The Blaze plan still includes a generous free tier, but this step is required to prevent the login/initialization process from failing.

## 4. Building and Running the App

This project uses native libraries (like `react-native-webrtc`) that are **not included in the standard Expo Go app**. Therefore, you **must create a custom development build** to run the app.

### Step 4.1: Build the Custom Development Client
1.  Log in to your Expo account using the Expo CLI:
    '''sh
    eas login
    '''
2.  From the `frontend` directory, start the build process:
    '''sh
    eas build --profile development --platform android
    '''
3.  EAS will build your app and provide a link to download the `.apk` file when it's finished.

### Step 4.2: Install and Run the App
1.  Start your Android Emulator or connect your physical device.
2.  **Install the APK**: Drag the downloaded `.apk` file onto your running emulator window.
3.  **Start the Metro Server**: In your terminal (inside the `frontend` directory), run:
    '''sh
    yarn start
    '''
4.  **Open the App**: Launch the "GhostRecon" app on your emulator. It will automatically connect to the Metro server, and you can begin testing.

## 5. Generating Production Builds (AAB/APK)

When you are ready to submit your app to the Google Play Store, you can create a production build.

### To build an Android App Bundle (.aab):
'''sh
eas build --profile production --platform android
'''

### To build a standard APK:
'''sh
eas build --profile production-apk --platform android
'''

Following these steps will ensure a smooth setup and help you avoid the common configuration and runtime errors we've diagnosed.
