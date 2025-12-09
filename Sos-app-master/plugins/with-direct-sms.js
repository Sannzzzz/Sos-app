const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Native Java code for DirectSms module
const DIRECT_SMS_MODULE_JAVA = `
package com.sosapp.scrunchie;

import android.Manifest;
import android.content.pm.PackageManager;
import android.telephony.SmsManager;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.ArrayList;

public class DirectSmsModule extends ReactContextBaseJavaModule {
    private static final String TAG = "DirectSmsModule";

    public DirectSmsModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "DirectSms";
    }

    @ReactMethod
    public void sendSms(String phoneNumber, String message, Promise promise) {
        try {
            if (ContextCompat.checkSelfPermission(getReactApplicationContext(), Manifest.permission.SEND_SMS)
                    != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "SMS permission not granted");
                return;
            }

            SmsManager smsManager = SmsManager.getDefault();
            
            // Handle long messages by dividing into parts
            ArrayList<String> parts = smsManager.divideMessage(message);
            
            if (parts.size() > 1) {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
            } else {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null);
            }
            
            Log.d(TAG, "SMS sent successfully to: " + phoneNumber);
            promise.resolve("SMS sent successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to send SMS: " + e.getMessage());
            promise.reject("SMS_ERROR", "Failed to send SMS: " + e.getMessage());
        }
    }

    @ReactMethod
    public void sendSmsToMultiple(String phoneNumbers, String message, Promise promise) {
        try {
            if (ContextCompat.checkSelfPermission(getReactApplicationContext(), Manifest.permission.SEND_SMS)
                    != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "SMS permission not granted");
                return;
            }

            String[] numbers = phoneNumbers.split(",");
            SmsManager smsManager = SmsManager.getDefault();
            ArrayList<String> parts = smsManager.divideMessage(message);
            int successCount = 0;
            
            for (String number : numbers) {
                try {
                    String trimmedNumber = number.trim();
                    if (parts.size() > 1) {
                        smsManager.sendMultipartTextMessage(trimmedNumber, null, parts, null, null);
                    } else {
                        smsManager.sendTextMessage(trimmedNumber, null, message, null, null);
                    }
                    successCount++;
                    Log.d(TAG, "SMS sent to: " + trimmedNumber);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to send SMS to " + number + ": " + e.getMessage());
                }
            }
            
            if (successCount > 0) {
                promise.resolve("SMS sent to " + successCount + " contact(s)");
            } else {
                promise.reject("SMS_ERROR", "Failed to send SMS to any contact");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to send SMS: " + e.getMessage());
            promise.reject("SMS_ERROR", "Failed to send SMS: " + e.getMessage());
        }
    }
}
`;

// Package registration code
const DIRECT_SMS_PACKAGE_JAVA = `
package com.sosapp.scrunchie;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class DirectSmsPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new DirectSmsModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;

// This plugin adds the DirectSms native module to Android
const withDirectSms = (config) => {
    // Add SMS permission to AndroidManifest
    config = withAndroidManifest(config, async (config) => {
        const manifest = config.modResults.manifest;

        // Ensure permissions array exists
        if (!manifest['uses-permission']) {
            manifest['uses-permission'] = [];
        }

        // Add SEND_SMS permission if not present
        const hasSmsPermission = manifest['uses-permission'].some(
            (perm) => perm.$['android:name'] === 'android.permission.SEND_SMS'
        );

        if (!hasSmsPermission) {
            manifest['uses-permission'].push({
                $: { 'android:name': 'android.permission.SEND_SMS' },
            });
        }

        return config;
    });

    // Add the native Java files
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            const projectRoot = config.modRequest.projectRoot;
            const packagePath = path.join(
                projectRoot,
                'android',
                'app',
                'src',
                'main',
                'java',
                'com',
                'sosapp',
                'scrunchie'
            );

            // Create directory if it doesn't exist
            if (!fs.existsSync(packagePath)) {
                fs.mkdirSync(packagePath, { recursive: true });
            }

            // Write the DirectSmsModule.java file
            const modulePath = path.join(packagePath, 'DirectSmsModule.java');
            fs.writeFileSync(modulePath, DIRECT_SMS_MODULE_JAVA.trim());
            console.log('Created DirectSmsModule.java');

            // Write the DirectSmsPackage.java file
            const packageFilePath = path.join(packagePath, 'DirectSmsPackage.java');
            fs.writeFileSync(packageFilePath, DIRECT_SMS_PACKAGE_JAVA.trim());
            console.log('Created DirectSmsPackage.java');

            return config;
        },
    ]);

    return config;
};

module.exports = withDirectSms;
