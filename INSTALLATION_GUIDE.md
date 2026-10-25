# 📲 RakshaPulse App Installation Guide

You can install and use **RakshaPulse** as a standalone application on your digital wristwatches (Wear OS, Apple Watch, Galaxy Watch), smartphones, and computers using two distinct methods:

---

## ⚡ Method 1: Instant Standalone PWA Install (Recommended)

RakshaPulse is configured as an installable **Progressive Web App (PWA)** with a service worker (`sw.js`), web manifest (`manifest.json`), and standalone application modes.

### A. Installing on Samsung Galaxy Watch / Wear OS Watches
1. Open the browser on your smartwatch (e.g., **Samsung Internet for Galaxy Watch** or **Wear Internet Browser**).
2. Enter the URL: `http://<YOUR_COMPUTER_IP>:3000/watch.html` (or `http://localhost:3000/watch.html` in an emulator).
3. Tap the browser menu (**⋮**) and select **"Add page to"** ➔ **"App Screen"** or **"Install App"**.
4. **Done!** The **RakshaPulse** app icon will appear directly in your smartwatch app drawer. It launches in full-screen standalone AMOLED mode without any browser frames or URL bars.

### B. Installing on Android / iPhone / Desktop
1. Open [http://localhost:3000](http://localhost:3000) (or via local network IP) in Google Chrome, Safari, or Edge.
2. Click the glowing **"Install App on Watch / Device"** button in the header, or click the browser's install icon (in the address bar) ➔ **"Install RakshaPulse"**.
3. On iOS (Safari): Tap the **Share** button ➔ select **"Add to Home Screen"**.
4. The app is now installed locally as a native windowed application with offline capability!

---

## ⌚ Method 2: Dedicated Standalone Watch Display Mode

If you are using the app directly on a smartwatch or in a small smartwatch viewport:
- Navigate to: **[http://localhost:3000/watch.html](http://localhost:3000/watch.html)**
- **Features**:
  - Full-screen pure AMOLED black background (`#000000`) for maximum watch battery savings.
  - Automatically formats for circular watch faces (`@media (shape: round)`).
  - Tap the center vitals to reveal on-watch test controls (Simulate Night Fear Spike, Jogging, or Connect Real Bluetooth HR Sensor).
  - Large tactile "CANCEL FALSE ALARM" button on the 10-second countdown ring.

---

## 🛠️ Method 3: Native Android Wear OS APK (Samsung Galaxy Watch & Pixel Watch)

The directory `/Applications/RakshaPulse/wear-os-native/` contains the full native Android Studio Kotlin project.

### Prerequisites:
- Android Studio Hedgehog / Iguana / Jellyfish
- Galaxy Watch 4/5/6/7 or Google Pixel Watch 1/2/3

### Steps to Build & Install:
1. Open Android Studio and choose **"Open Existing Project"** ➔ Select `/Applications/RakshaPulse/wear-os-native`.
2. Allow Gradle to sync.
3. Build the APK:
   - From Android Studio: **Build** ➔ **Build Bundle(s) / APK(s)** ➔ **Build APK(s)**.
4. **Install to Smartwatch via Wireless ADB**:
   - On your Galaxy Watch / Pixel Watch, go to **Settings** ➔ **About Watch** ➔ **Software info** ➔ Tap **Software version** 7 times to enable **Developer Options**.
   - Go to **Settings** ➔ **Developer Options** ➔ Enable **ADB Debugging** and **Wireless Debugging**.
   - Connect via your terminal:
     ```bash
     adb connect <WATCH_IP>:<PORT>
     adb install app-debug.apk
     ```
   - Alternatively, you can use phone apps like **Wear Installer 2** from Google Play Store to install the `.apk` directly onto your watch over Wi-Fi without needing a PC.

---

## 🧪 Testing the Installed App

1. Launch **RakshaPulse** from your smartwatch or phone home screen.
2. Tap *"Connect Real Bluetooth HR Sensor"* to pair your watch's PPG heart monitor.
3. To test emergency dispatch: Tap *"Simulate Night Fear Spike (158 BPM)"*.
4. Observe the **10-second vibrating countdown ring**.
5. When countdown finishes, verify:
   - Voice alert broadcast speaks out loud.
   - GPS coordinates and address are locked.
   - Alert arrives at the **112 Police Command Radar** ([http://localhost:3000/police-dashboard.html](http://localhost:3000/police-dashboard.html)).
