# Firebase Setup for Smart SOS Scrunchie

To enable the automatic push notifications, you need to set up a free Firebase project.

## 1. Create Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click "Add Project" -> Name it "Smart SOS"
3. Disable Analytics (optional) -> Create Project.

## 2. Add Apps
1. Click the **Android** icon.
   - Package name: `com.sosapp.scrunchie`
   - Download `google-services.json` and place it in the project root (optional for Expo, but good practice).
2. Click the **iOS** icon (if you plan to use iOS).
   - Bundle ID: `com.sosapp.scrunchie`
3. Go to **Project Settings** -> **General**.
   - Copy the configuration object (apiKey, appId, projectId, etc).
   - Paste it into `services/firebase-service.ts`.

## 3. Enable Database (Firestore)
1. Go to **Build** -> **Firestore Database**.
2. Click "Create Database".
3. Choose "Start in Production mode" (or Test mode).
4. Select a location near you.
5. **Rules:** Update rules to allow read/write for now (for development):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

## 4. Deploy Cloud Function (The "Backend" Logic)
This function listens for new SOS alerts and triggers the Push Notifications.

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Init Functions folder (run in a separate folder outside your app, or in root):
   ```bash
   firebase init functions
   # Select "JavaScript"
   # Select "No" for ESLint
   # Select "Yes" to install dependencies
   ```
4. Replace `functions/index.js` with the code below:

### `functions/index.js`

```javascript
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Expo } = require("expo-server-sdk");

admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

exports.sendSOSNotification = functions.firestore
  .document("alerts/{alertId}")
  .onCreate(async (snap, context) => {
    const alertData = snap.data();
    const senderId = alertData.senderId;
    const locationUrl = alertData.locationUrl;

    console.log(`Processing SOS for sender: ${senderId}`);

    // 1. Get Sender Info
    const senderDoc = await db.collection("users").doc(senderId).get();
    const senderName = senderDoc.exists ? (senderDoc.data().name || "Unknown User") : "Unknown User";

    // 2. Get Contacts for this user
    const contactsSnap = await db
      .collection("users")
      .doc(senderId)
      .collection("contacts")
      .get();

    if (contactsSnap.empty) {
      console.log("No contacts found for user.");
      return null;
    }

    // 3. Collect Push Tokens
    const pushTokens = [];
    
    // Iterate through linked contacts
    const contactPromises = contactsSnap.docs.map(async (doc) => {
      const contactUserId = doc.id; // The ID of the contact user
      const userDoc = await db.collection("users").doc(contactUserId).get();
      
      if (userDoc.exists && userDoc.data().pushToken) {
        pushTokens.push(userDoc.data().pushToken);
      }
    });

    await Promise.all(contactPromises);

    if (pushTokens.length === 0) {
      console.log("No valid push tokens found for contacts.");
      return null;
    }

    // 4. Send Notifications via Expo Push API
    const messages = [];
    for (let token of pushTokens) {
      if (!Expo.isExpoPushToken(token)) {
        console.error(`Push token ${token} is not a valid Expo push token`);
        continue;
      }

      messages.push({
        to: token,
        sound: "default",
        title: "🚨 SOS ALERT!",
        body: `${senderName} needs help! Tap to view location.`,
        data: { url: locationUrl, senderId: senderId, type: 'sos_alert' },
        priority: 'head-up',
        channelId: 'default'
      });
    }

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (let chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error(error);
      }
    }
    
    // Update alert status
    await snap.ref.update({ status: 'sent', notificationCount: tickets.length });

    return { success: true, tickets: tickets };
  });
```

5. **Deploy:** `firebase deploy --only functions`

## 5. Build & Run
Push notifications work best on physical devices.
1. `npx eas-cli build --platform android --profile development`
2. Install APK.
3. Share your User ID (from Contacts Tab) with another phone running the app.
4. Add that ID as a contact.
5. Trigger SOS!
