import { NativeModules, Platform, Linking } from 'react-native';
import * as SMS from 'expo-sms';

// For direct SMS sending on Android, we need to use native module
// This will be available in the development build (APK), not Expo Go

interface SMSSendResult {
    success: boolean;
    message: string;
}

class SMSService {

    // Send SMS using the best available method
    async sendSMS(
        phoneNumbers: string[],
        message: string
    ): Promise<SMSSendResult> {
        if (Platform.OS === 'android') {
            return this.sendSMSAndroid(phoneNumbers, message);
        } else if (Platform.OS === 'ios') {
            return this.sendSMSiOS(phoneNumbers, message);
        } else {
            return this.sendSMSWeb(phoneNumbers, message);
        }
    }

    // Android: Try to send SMS directly (requires SEND_SMS permission)
    private async sendSMSAndroid(
        phoneNumbers: string[],
        message: string
    ): Promise<SMSSendResult> {
        try {
            // First, try to use the Native SMS Module if available (in development build)
            if (NativeModules.DirectSms) {
                // This module would be available if we have the native code
                for (const phone of phoneNumbers) {
                    await NativeModules.DirectSms.sendDirectSms(phone, message);
                }
                return { success: true, message: 'SMS sent successfully!' };
            }

            // Fallback: Try using the SmsManager via intent with auto-send
            // This is a workaround that uses an implicit intent
            for (const phone of phoneNumbers) {
                const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
                const canOpen = await Linking.canOpenURL(smsUrl);
                if (canOpen) {
                    await Linking.openURL(smsUrl);
                }
            }

            // With expo-sms, we at least open the SMS app
            const isAvailable = await SMS.isAvailableAsync();
            if (isAvailable) {
                await SMS.sendSMSAsync(phoneNumbers, message);
                return { success: true, message: 'SMS app opened with message' };
            }

            return {
                success: false,
                message: 'SMS not available. Please build as APK with native modules.'
            };
        } catch (error) {
            console.error('SMS error:', error);
            return { success: false, message: `Failed to send SMS: ${error}` };
        }
    }

    // iOS: Use expo-sms (requires user confirmation)
    private async sendSMSiOS(
        phoneNumbers: string[],
        message: string
    ): Promise<SMSSendResult> {
        try {
            const isAvailable = await SMS.isAvailableAsync();
            if (!isAvailable) {
                return { success: false, message: 'SMS not available on this device' };
            }

            const { result } = await SMS.sendSMSAsync(phoneNumbers, message);

            if (result === 'sent') {
                return { success: true, message: 'SMS sent successfully!' };
            } else if (result === 'cancelled') {
                return { success: false, message: 'SMS was cancelled' };
            }

            return { success: true, message: 'SMS app opened' };
        } catch (error) {
            console.error('iOS SMS error:', error);
            return { success: false, message: `Failed to send SMS: ${error}` };
        }
    }

    // Web: Open sms: URL
    private async sendSMSWeb(
        phoneNumbers: string[],
        message: string
    ): Promise<SMSSendResult> {
        const smsUrl = `sms:${phoneNumbers.join(',')}?body=${encodeURIComponent(message)}`;

        try {
            const canOpen = await Linking.canOpenURL(smsUrl);
            if (canOpen) {
                await Linking.openURL(smsUrl);
                return { success: true, message: 'SMS app opened with message' };
            }
            return { success: false, message: 'Cannot open SMS app on web' };
        } catch (error) {
            return { success: false, message: `Failed to open SMS: ${error}` };
        }
    }

    // Check if direct SMS sending is available (for APK builds)
    async isDirectSMSAvailable(): Promise<boolean> {
        if (Platform.OS === 'android') {
            return !!NativeModules.DirectSms;
        }
        return false;
    }
}

export const smsService = new SMSService();
