import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules, Vibration, Alert, Linking } from 'react-native';
import * as SMS from 'expo-sms';

const STORAGE_KEY = '@contacts';
const SOS_LOG_KEY = '@sos_logs';

interface Contact {
    id: string;
    phone: string;
    name: string;
}

interface SOSLog {
    timestamp: string;
    contacts: string[];
    location: string | null;
    success: boolean;
    message: string;
}

class SOSService {
    private isSending: boolean = false;

    // Main SOS trigger function - call this when SOS signal is received
    async triggerSOS(
        onStatusUpdate?: (status: string) => void
    ): Promise<{ success: boolean; message: string }> {
        // Prevent double-triggering
        if (this.isSending) {
            return { success: false, message: 'SOS already in progress' };
        }

        this.isSending = true;

        try {
            // Vibrate to indicate SOS is being sent
            Vibration.vibrate([0, 500, 200, 500, 200, 500]);

            onStatusUpdate?.('Loading contacts...');

            // Get contacts
            const contacts = await this.getContacts();
            if (contacts.length === 0) {
                this.isSending = false;
                return {
                    success: false,
                    message: 'No emergency contacts configured. Please add contacts first.'
                };
            }

            onStatusUpdate?.('Getting your location...');

            // Get location
            const locationResult = await this.getLocation();

            onStatusUpdate?.('Sending SOS message...');

            // Build message
            const message = this.buildSOSMessage(locationResult.url);

            // Get phone numbers
            const phoneNumbers = contacts.map(c => c.phone);

            // Send SMS
            const result = await this.sendEmergencySMS(phoneNumbers, message);

            // Log the SOS event
            await this.logSOSEvent(phoneNumbers, locationResult.url, result.success, result.message);

            // Vibrate on completion
            if (result.success) {
                Vibration.vibrate([0, 200, 100, 200]);
            }

            this.isSending = false;
            return result;

        } catch (error) {
            console.error('SOS Error:', error);
            this.isSending = false;
            return {
                success: false,
                message: `SOS failed: ${error}`
            };
        }
    }

    // Get saved contacts
    private async getContacts(): Promise<Contact[]> {
        try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (!saved) return [];

            const parsed = JSON.parse(saved);
            if (!Array.isArray(parsed) || parsed.length === 0) return [];

            // Handle both old format (strings) and new format (objects)
            if (typeof parsed[0] === 'string') {
                return parsed.map((phone: string, index: number) => ({
                    id: `contact_${index}`,
                    phone,
                    name: `Contact ${index + 1}`,
                }));
            }

            return parsed;
        } catch (error) {
            console.error('Error loading contacts:', error);
            return [];
        }
    }

    // Get current location with timeout
    private async getLocation(): Promise<{ url: string | null; coords: { lat: number; lng: number } | null }> {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();

            if (status !== 'granted') {
                console.log('Location permission denied');
                return { url: null, coords: null };
            }

            // Add timeout to prevent hanging - 10 seconds max
            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced, // Balanced is faster than High
            });

            const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Location timeout')), 10000)
            );

            const location = await Promise.race([locationPromise, timeoutPromise]);

            if (!location) {
                return { url: null, coords: null };
            }

            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            const url = `https://maps.google.com/?q=${lat},${lng}`;

            return { url, coords: { lat, lng } };
        } catch (error) {
            console.error('Location error:', error);
            return { url: null, coords: null };
        }
    }

    // Build the SOS message
    private buildSOSMessage(locationUrl: string | null): string {
        const timestamp = new Date().toLocaleString();
        const locationText = locationUrl
            ? `📍 Location: ${locationUrl}`
            : '📍 Location: Unable to get location';

        return `🚨 *EMERGENCY SOS ALERT!*

⚠️ This is an EMERGENCY alert!
I need IMMEDIATE help!

${locationText}

🕐 Time: ${timestamp}

This message was sent automatically from Smart SOS Scrunchie app.`;
    }

    // Request SMS permission for automatic sending
    private async requestSmsPermission(): Promise<boolean> {
        if (Platform.OS !== 'android') return false;

        try {
            const { PermissionsAndroid } = require('react-native');
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.SEND_SMS,
                {
                    title: 'SMS Permission Required',
                    message: 'This app needs SMS permission to send emergency alerts automatically without opening the messaging app.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                }
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.error('SMS permission request error:', err);
            return false;
        }
    }

    // Send SMS to all emergency contacts
    private async sendEmergencySMS(
        phoneNumbers: string[],
        message: string
    ): Promise<{ success: boolean; message: string }> {

        if (Platform.OS === 'android') {
            // First, request SMS permission
            const hasPermission = await this.requestSmsPermission();

            if (!hasPermission) {
                console.log('SMS permission not granted, falling back to SMS app');
            }

            // Try native direct SMS first (available in development builds)
            if (NativeModules.DirectSms) {
                try {
                    console.log('Using DirectSms native module for automatic sending...');
                    const numbersString = phoneNumbers.join(',');
                    await NativeModules.DirectSms.sendSmsToMultiple(numbersString, message);
                    return {
                        success: true,
                        message: `🚨 SOS sent automatically to ${phoneNumbers.length} contact(s)!`
                    };
                } catch (error: any) {
                    console.error('Native SMS error:', error);
                    // Check if it's a permission error
                    if (error.code === 'PERMISSION_DENIED') {
                        // Try requesting permission again
                        const permGranted = await this.requestSmsPermission();
                        if (permGranted) {
                            // Retry sending
                            try {
                                const numbersString = phoneNumbers.join(',');
                                await NativeModules.DirectSms.sendSmsToMultiple(numbersString, message);
                                return {
                                    success: true,
                                    message: `🚨 SOS sent automatically to ${phoneNumbers.length} contact(s)!`
                                };
                            } catch (retryError) {
                                console.error('Retry SMS error:', retryError);
                            }
                        }
                    }
                    // Fall through to Linking
                }
            } else {
                console.log('DirectSms native module not available. Build a development APK for automatic SMS.');
            }
        }

        // Fallback: Open SMS app via Linking (NON-BLOCKING - won't hang!)
        // This is much better than expo-sms which waits for user action
        try {
            // For multiple contacts, we need to open SMS for each
            // But to avoid flooding, just open for the first one with all numbers
            const allNumbers = phoneNumbers.join(',');
            const smsUri = Platform.OS === 'ios'
                ? `sms:${allNumbers}&body=${encodeURIComponent(message)}`
                : `sms:${allNumbers}?body=${encodeURIComponent(message)}`;

            const canOpen = await Linking.canOpenURL(smsUri);
            if (canOpen) {
                Linking.openURL(smsUri);
                return {
                    success: true,
                    message: `📱 SMS app opened for ${phoneNumbers.length} contact(s). Please tap SEND!\n(Build development APK for automatic sending)`
                };
            }
        } catch (error) {
            console.error('SMS Linking error:', error);
        }

        // Try individual numbers if combined didn't work
        try {
            const smsUri = `sms:${phoneNumbers[0]}?body=${encodeURIComponent(message)}`;
            Linking.openURL(smsUri);
            return {
                success: true,
                message: `📱 SMS app opened. Please send to all ${phoneNumbers.length} contacts manually.`
            };
        } catch (error) {
            console.error('Individual SMS error:', error);
        }

        return {
            success: false,
            message: 'Could not open SMS app. Please send emergency message manually.'
        };
    }

    // Log SOS event for history
    private async logSOSEvent(
        contacts: string[],
        location: string | null,
        success: boolean,
        message: string
    ): Promise<void> {
        try {
            const log: SOSLog = {
                timestamp: new Date().toISOString(),
                contacts,
                location,
                success,
                message,
            };

            const existingLogs = await AsyncStorage.getItem(SOS_LOG_KEY);
            const logs: SOSLog[] = existingLogs ? JSON.parse(existingLogs) : [];

            // Keep last 50 logs
            logs.unshift(log);
            if (logs.length > 50) {
                logs.pop();
            }

            await AsyncStorage.setItem(SOS_LOG_KEY, JSON.stringify(logs));
        } catch (error) {
            console.error('Error logging SOS:', error);
        }
    }

    // Get SOS history
    async getSOSHistory(): Promise<SOSLog[]> {
        try {
            const logs = await AsyncStorage.getItem(SOS_LOG_KEY);
            return logs ? JSON.parse(logs) : [];
        } catch (error) {
            console.error('Error getting SOS history:', error);
            return [];
        }
    }

    // Check if SOS is currently being sent
    isSendingInProgress(): boolean {
        return this.isSending;
    }
}

export const sosService = new SOSService();
