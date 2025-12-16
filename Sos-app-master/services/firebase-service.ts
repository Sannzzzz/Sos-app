import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ REPLACE WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Constants
const USER_ID_KEY = '@user_id_v2';
const PUSH_TOKEN_KEY = '@push_token';

export interface UserProfile {
    userId: string;
    pushToken: string;
    platform: string;
    lastUpdated: any;
}

export interface EmergencyContact {
    userId: string;
    name: string;
    addedAt: any;
}

class FirebaseService {
    private userId: string | null = null;

    async init() {
        this.userId = await this.getOrCreateUserId();
        await this.registerForPushNotificationsAsync();
    }

    // Get or Create a unique User ID (persistent per install)
    async getOrCreateUserId(): Promise<string> {
        if (this.userId) return this.userId;

        try {
            let id = await AsyncStorage.getItem(USER_ID_KEY);

            if (!id) {
                // Generate a simple readable ID if possible, or UUID
                if (Platform.OS === 'android') {
                    id = Application.getAndroidId();
                } else {
                    id = await Application.getIosIdForVendorAsync();
                }

                // Fallback to random if device ID fails
                if (!id) {
                    id = 'user_' + Math.random().toString(36).substr(2, 9);
                }

                await AsyncStorage.setItem(USER_ID_KEY, id);
            }

            this.userId = id;
            return id;
        } catch (e) {
            console.error('Error getting user ID:', e);
            return 'unknown_user';
        }
    }

    getUserId(): string {
        return this.userId || 'unknown';
    }

    // Register for Push Notifications & Save to Firestore
    async registerForPushNotificationsAsync() {
        if (!Device.isDevice) {
            console.log('Push notifications not supported on emulator');
            // Continue, don't return, so we can test logic
        }

        let token;
        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Push notification permission denied');
                return;
            }

            // Get Expo Push Token
            try {
                const tokenData = await Notifications.getExpoPushTokenAsync({
                    projectId: Constants.expoConfig?.extra?.eas?.projectId,
                });
                token = tokenData.data;
                console.log('Push Token:', token);

                await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

                // Save user to Firestore
                await this.saveUserToFirestore(token);

            } catch (e) {
                console.error('Error getting push token:', e);
            }
        }

        if (Platform.OS === 'android') {
            Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }
    }

    // Save/Update User in Firestore
    private async saveUserToFirestore(token: string) {
        if (!this.userId) return;

        try {
            const userRef = doc(db, 'users', this.userId);
            await setDoc(userRef, {
                userId: this.userId,
                pushToken: token,
                platform: Platform.OS,
                lastUpdated: serverTimestamp()
            }, { merge: true });
            console.log('User synced to Firestore:', this.userId);
        } catch (e) {
            console.error('Error syncing user to Firestore:', e);
        }
    }

    // Add an Emergency Contact (Link another user)
    async addContact(contactUserId: string, contactName: string): Promise<{ success: boolean, message: string }> {
        if (!this.userId) return { success: false, message: 'App not initialized' };

        try {
            // Verify the contact exists in users collection
            const contactRef = doc(db, 'users', contactUserId);
            const contactSnap = await getDoc(contactRef);

            if (!contactSnap.exists()) {
                return { success: false, message: 'User ID not found in system. Ask them to open the app first.' };
            }

            // Add to my contacts subcollection
            const myContactsRef = doc(db, 'users', this.userId, 'contacts', contactUserId);
            await setDoc(myContactsRef, {
                userId: contactUserId,
                name: contactName,
                addedAt: serverTimestamp()
            });

            return { success: true, message: 'Contact added successfully!' };

        } catch (e) {
            console.error('Error adding contact:', e);
            return { success: false, message: 'Failed to add contact.' };
        }
    }

    // Remove contact
    async removeContact(contactUserId: string) {
        // Logic would go here (omitted for brevity)
    }

    // Trigger SOS (Create Alert in Firestore)
    async createSOSAlert(location: { lat: number, lng: number }, locationUrl: string) {
        if (!this.userId) throw new Error('User not identified');

        try {
            // Creating an alert document triggers the Cloud Function
            const alertData = {
                senderId: this.userId,
                location: location,
                locationUrl: locationUrl,
                timestamp: serverTimestamp(),
                status: 'active'
            };

            await addDoc(collection(db, 'alerts'), alertData);
            console.log('SOS Alert created in Firestore');
            return true;
        } catch (e) {
            console.error('Error creating SOS alert:', e);
            throw e;
        }
    }

    // Listen to incoming notifications (Setup handler)
    setupNotificationHandler() {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
                priority: Notifications.AndroidNotificationPriority.MAX,
            }),
        });
    }
}

export const firebaseService = new FirebaseService();
