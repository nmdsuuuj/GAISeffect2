# Android App Build Guide (APK)

This guide provides step-by-step instructions to package the Groove Sampler web application into a native Android app (`.apk` file). This process resolves browser-specific issues on mobile devices, such as unintended screen scrolling when using faders, providing a much more stable and app-like experience.

This guide assumes you already have **Node.js** installed on your computer.

## Step 1: Install the Bubblewrap CLI

Bubblewrap is a command-line tool from Google that makes packaging a web app into an Android app incredibly simple.

Open your terminal or command prompt and run the following command to install it globally on your system:

```bash
npm install -g @bubblewrap/cli
```

## Step 2: Build the Android App

Once Bubblewrap is installed, you can build the APK.

1.  Navigate to the root directory of the Groove Sampler project in your terminal.
2.  Run the build command:

    ```bash
    bubblewrap build --manifest=public/manifest.json
    ```

Bubblewrap will automatically read the specified manifest file, ask you a few questions to confirm the settings (you can usually accept the defaults by pressing Enter), and then generate all the necessary Android project files. Finally, it will compile and sign an APK file for you.

## Step 3: Install the App on Your Device

After the build process is complete, you will find the signed APK file inside the project directory, usually named `app-release-signed.apk`.

1.  **Transfer the APK to your Android device.** You can do this via a USB cable, Google Drive, email, or any other file transfer method.
2.  **Enable "Install from unknown sources"** on your phone. On most Android devices, you can find this in `Settings > Security` or `Settings > Apps > Special app access`. When you try to open the APK file, your phone will likely prompt you to allow the installation from your file manager.
3.  **Install the APK.** Open the `app-release-signed.apk` file on your device using a file manager and follow the on-screen instructions to install it.

Once installed, the Groove Sampler icon will appear on your home screen or in your app drawer, ready to be used just like any other native app!