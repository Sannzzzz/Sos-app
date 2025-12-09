import { Platform, PermissionsAndroid } from 'react-native';
import * as Location from 'expo-location';

// HM10 BLE Module UUIDs (standard for HM-10)
const HM10_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const HM10_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

// SOS Signal that ATtiny85 will send
const SOS_SIGNAL = 'SOS';

// Define Device interface for web compatibility
export interface Device {
    id: string;
    name: string | null;
    rssi?: number | null;
}

// Lazy load BleManager only on native platforms
let BleManager: any = null;
let State: any = null;
let bleModuleAvailable = false;

if (Platform.OS !== 'web') {
    try {
        const blePlx = require('react-native-ble-plx');
        BleManager = blePlx.BleManager;
        State = blePlx.State;
        bleModuleAvailable = true;
    } catch (e) {
        console.log('BLE module not available (expected in Expo Go):', e);
        bleModuleAvailable = false;
    }
}

class BLEService {
    private manager: any = null;
    private connectedDevice: Device | null = null;
    private onSOSCallback: (() => void) | null = null;
    private isScanning: boolean = false;
    private initAttempted: boolean = false;
    private initError: string | null = null;

    constructor() {
        // Don't initialize in constructor - do it lazily
    }

    // Lazy initialization of BLE manager
    private initManager(): boolean {
        if (this.initAttempted) {
            return this.manager !== null;
        }

        this.initAttempted = true;

        if (Platform.OS === 'web') {
            this.initError = 'BLE is not available on web platform';
            return false;
        }

        if (!bleModuleAvailable || !BleManager) {
            this.initError = 'BLE native module not available. Please use a development build instead of Expo Go.';
            console.log(this.initError);
            return false;
        }

        try {
            this.manager = new BleManager();
            console.log('BLE Manager initialized successfully');
            return true;
        } catch (e: any) {
            this.initError = `Failed to initialize BLE: ${e.message}. Please use a development build.`;
            console.log(this.initError);
            return false;
        }
    }

    // Get initialization error message
    getInitError(): string | null {
        return this.initError;
    }

    // Check if BLE is available (not on web)
    isAvailable(): boolean {
        // Try to init if not already attempted
        if (!this.initAttempted) {
            this.initManager();
        }
        return Platform.OS !== 'web' && this.manager !== null;
    }

    // Request necessary permissions for Android
    async requestPermissions(): Promise<boolean> {
        if (Platform.OS === 'web') return false;

        if (Platform.OS === 'android') {
            try {
                const apiLevel = Platform.Version;

                if (apiLevel >= 31) {
                    // Android 12+ requires these permissions
                    const results = await PermissionsAndroid.requestMultiple([
                        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    ]);

                    const allGranted = Object.values(results).every(
                        (result) => result === PermissionsAndroid.RESULTS.GRANTED
                    );

                    return allGranted;
                } else {
                    // Older Android versions
                    const result = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                    );
                    return result === PermissionsAndroid.RESULTS.GRANTED;
                }
            } catch (error) {
                console.error('Permission request error:', error);
                return false;
            }
        }

        // For iOS, permissions are requested automatically
        return true;
    }

    // Request SMS permission for Android
    async requestSMSPermission(): Promise<boolean> {
        if (Platform.OS !== 'android') return false;

        try {
            const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.SEND_SMS,
                {
                    title: 'SMS Permission',
                    message: 'This app needs SMS permission to send emergency alerts automatically.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                }
            );
            return result === PermissionsAndroid.RESULTS.GRANTED;
        } catch (error) {
            console.error('SMS permission error:', error);
            return false;
        }
    }

    // Check if Bluetooth is enabled
    async isBluetoothEnabled(): Promise<boolean> {
        if (!this.manager || !State) return false;
        const state = await this.manager.state();
        return state === State.PoweredOn;
    }

    // Wait for Bluetooth to be powered on
    waitForBluetoothPoweredOn(): Promise<void> {
        if (!this.manager || !State) {
            return Promise.reject(new Error('BLE not available'));
        }

        return new Promise((resolve, reject) => {
            const subscription = this.manager.onStateChange((state: any) => {
                if (state === State.PoweredOn) {
                    subscription.remove();
                    resolve();
                }
            }, true);

            // Timeout after 10 seconds
            setTimeout(() => {
                subscription.remove();
                reject(new Error('Bluetooth not enabled'));
            }, 10000);
        });
    }

    // Scan for HM10 devices
    async scanForDevices(
        onDeviceFound: (device: Device) => void,
        onError: (error: Error) => void
    ): Promise<void> {
        // Try to initialize the BLE manager
        if (!this.initManager()) {
            const errorMsg = this.initError || 'Bluetooth is not available on this platform';
            onError(new Error(errorMsg));
            return;
        }

        if (!this.isAvailable()) {
            onError(new Error('Bluetooth is not available on this platform'));
            return;
        }

        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
            onError(new Error('Bluetooth permissions not granted'));
            return;
        }

        try {
            await this.waitForBluetoothPoweredOn();
        } catch (error) {
            onError(new Error('Please enable Bluetooth'));
            return;
        }

        this.isScanning = true;

        // Scan for devices
        this.manager.startDeviceScan(
            null,
            { allowDuplicates: false },
            (error: any, device: any) => {
                if (error) {
                    console.error('Scan error:', error);
                    onError(error);
                    return;
                }

                if (device && device.name &&
                    (device.name.includes('HM') ||
                        device.name.includes('BT') ||
                        device.name.includes('SOS') ||
                        device.name.includes('MLT') ||
                        device.name.includes('BLE'))) {
                    onDeviceFound({
                        id: device.id,
                        name: device.name,
                        rssi: device.rssi,
                    });
                }
            }
        );
    }

    // Stop scanning
    stopScan(): void {
        if (this.manager) {
            this.isScanning = false;
            this.manager.stopDeviceScan();
        }
    }

    // Connect to a device
    async connectToDevice(device: Device): Promise<boolean> {
        if (!this.manager) return false;

        try {
            this.stopScan();

            console.log('Connecting to device:', device.name || device.id);

            const connectedDevice = await this.manager.connectToDevice(device.id, {
                autoConnect: true,
                requestMTU: 512,
            });

            console.log('Discovering services...');
            const deviceWithServices = await connectedDevice.discoverAllServicesAndCharacteristics();

            this.connectedDevice = {
                id: deviceWithServices.id,
                name: deviceWithServices.name,
                rssi: deviceWithServices.rssi,
            };

            // Subscribe to notifications from HM10
            await this.subscribeToNotifications(deviceWithServices);

            console.log('Successfully connected to:', device.name || device.id);
            return true;
        } catch (error) {
            console.error('Connection error:', error);
            this.connectedDevice = null;
            return false;
        }
    }

    // Subscribe to receive data from HM10
    private async subscribeToNotifications(device: any): Promise<void> {
        try {
            // Try to subscribe with the standard HM10 UUIDs
            device.monitorCharacteristicForService(
                HM10_SERVICE_UUID,
                HM10_CHARACTERISTIC_UUID,
                (error: any, characteristic: any) => {
                    if (error) {
                        console.error('Notification error:', error);
                        return;
                    }

                    if (characteristic?.value) {
                        // Decode the base64 value
                        const data = this.base64Decode(characteristic.value);
                        console.log('Received data:', data);

                        // Check if it's an SOS signal
                        if (data.includes(SOS_SIGNAL) || data.includes('1')) {
                            console.log('🚨 SOS SIGNAL RECEIVED!');
                            if (this.onSOSCallback) {
                                this.onSOSCallback();
                            }
                        }
                    }
                }
            );
        } catch (error) {
            console.error('Subscribe error:', error);

            // Try to find and subscribe to any available characteristic
            try {
                const services = await device.services();
                for (const service of services) {
                    const characteristics = await service.characteristics();
                    for (const char of characteristics) {
                        if (char.isNotifiable) {
                            char.monitor((error: any, characteristic: any) => {
                                if (characteristic?.value) {
                                    const data = this.base64Decode(characteristic.value);
                                    console.log('Received data from char:', data);

                                    if (data.includes(SOS_SIGNAL) || data.includes('1')) {
                                        console.log('🚨 SOS SIGNAL RECEIVED!');
                                        if (this.onSOSCallback) {
                                            this.onSOSCallback();
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            } catch (e) {
                console.error('Error subscribing to characteristics:', e);
            }
        }
    }

    // Decode base64 to string
    private base64Decode(base64: string): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let output = '';
        let chr1, chr2, chr3;
        let enc1, enc2, enc3, enc4;
        let i = 0;

        base64 = base64.replace(/[^A-Za-z0-9\+\/\=]/g, '');

        while (i < base64.length) {
            enc1 = chars.indexOf(base64.charAt(i++));
            enc2 = chars.indexOf(base64.charAt(i++));
            enc3 = chars.indexOf(base64.charAt(i++));
            enc4 = chars.indexOf(base64.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output += String.fromCharCode(chr1);
            if (enc3 !== 64) output += String.fromCharCode(chr2);
            if (enc4 !== 64) output += String.fromCharCode(chr3);
        }

        return output;
    }

    // Set SOS callback
    setSOSCallback(callback: () => void): void {
        this.onSOSCallback = callback;
    }

    // Disconnect from device
    async disconnect(): Promise<void> {
        if (this.manager && this.connectedDevice) {
            try {
                await this.manager.cancelDeviceConnection(this.connectedDevice.id);
            } catch (error) {
                console.error('Disconnect error:', error);
            }
            this.connectedDevice = null;
        }
    }

    // Check if connected
    isConnected(): boolean {
        return this.connectedDevice !== null;
    }

    // Get connected device info
    getConnectedDevice(): Device | null {
        return this.connectedDevice;
    }

    // Destroy manager
    destroy(): void {
        this.disconnect();
        if (this.manager) {
            this.manager.destroy();
        }
    }
}

// Export singleton instance
export const bleService = new BLEService();
