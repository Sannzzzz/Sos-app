import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration } from 'react-native';
import { firebaseService } from './firebase-service';

const SOS_LOG_KEY = '@sos_logs';

interface SOSLog {
    timestamp: string;
    location: string | null;
    success: boolean;
    message: string;
}

class SOSService {
    private isSending: boolean = false;

    // Main SOS trigger function - FAST and NON-BLOCKING
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
            Vibration.vibrate([0, 300, 100, 300]);

            onStatusUpdate?.('🚀 Initializing...');
            await firebaseService.init();

            onStatusUpdate?.('📍 Getting location...');
            // Get location with timeout
            const locationResult = await this.getLocationFast();

            onStatusUpdate?.('📡 Sending Alert to Cloud...');

            // Create Alert in Firebase -> Triggers Push Notifications via Cloud Functions
            if (locationResult.coords) {
                await firebaseService.createSOSAlert(locationResult.coords, locationResult.url || '');
            } else {
                // Fallback if no location, send 0,0 or similar to indicate "No Fix"
                onStatusUpdate?.('⚠️ No GPS Fix, sending without location...');
                await firebaseService.createSOSAlert({ lat: 0, lng: 0 }, 'Location not available');
            }

            const message = 'SOS Alert Sent Successfully to all contacts!';

            // Log the SOS event
            this.logSOSEvent(locationResult.url, true, message);

            // Vibrate on completion
            Vibration.vibrate([0, 100, 50, 100, 50, 100]);

            this.isSending = false;
            return { success: true, message: '🚨 SOS Sent to all apps!' };

        } catch (error: any) {
            console.error('SOS Error:', error);
            this.isSending = false;
            // Log failure
            this.logSOSEvent(null, false, error.toString());
            return {
                success: false,
                message: `SOS failed: ${error.message || 'Unknown error'}`
            };
        }
    }

    // Get location FAST with 3 second timeout
    private async getLocationFast(): Promise<{ url: string | null; coords: { lat: number; lng: number } | null }> {
        try {
            // Check if we already have permission
            const { status } = await Location.getForegroundPermissionsAsync();

            if (status !== 'granted') {
                // Request permission with timeout
                const permResult = await Promise.race([
                    Location.requestForegroundPermissionsAsync(),
                    new Promise<{ status: string }>((resolve) =>
                        setTimeout(() => resolve({ status: 'timeout' }), 2000)
                    )
                ]);

                if (permResult.status !== 'granted') {
                    console.log('Location permission not granted or timeout');
                    return { url: null, coords: null };
                }
            }

            // Get location with 5 second timeout (increased slightly for robustness)
            const location = await Promise.race([
                Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                }),
                new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), 5000)
                )
            ]);

            if (!location) {
                // Try last known location as fallback
                const lastLocation = await Location.getLastKnownPositionAsync();
                if (lastLocation) {
                    const lat = lastLocation.coords.latitude;
                    const lng = lastLocation.coords.longitude;
                    return {
                        url: `https://maps.google.com/?q=${lat},${lng}`,
                        coords: { lat, lng }
                    };
                }
                return { url: null, coords: null };
            }

            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            return {
                url: `https://maps.google.com/?q=${lat},${lng}`,
                coords: { lat, lng }
            };
        } catch (error) {
            console.error('Location error:', error);
            return { url: null, coords: null };
        }
    }

    // Log SOS event
    private async logSOSEvent(
        location: string | null,
        success: boolean,
        message: string
    ): Promise<void> {
        try {
            const log: SOSLog = {
                timestamp: new Date().toISOString(),
                location,
                success,
                message,
            };

            const existingLogs = await AsyncStorage.getItem(SOS_LOG_KEY);
            const logs: SOSLog[] = existingLogs ? JSON.parse(existingLogs) : [];

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

    isSendingInProgress(): boolean {
        return this.isSending;
    }

    resetSendingState(): void {
        this.isSending = false;
    }
}

export const sosService = new SOSService();
