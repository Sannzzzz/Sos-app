import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { bleService, Device } from "@/services/ble-service";

export default function DeviceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check initial connection state
  useEffect(() => {
    const device = bleService.getConnectedDevice();
    if (device) {
      setConnectedDevice(device);
    }
  }, []);

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const startScan = async () => {
    if (Platform.OS === "web") {
      showAlert(
        "Not Available",
        "Bluetooth scanning is not available on web. Please use the Android/iOS app."
      );
      return;
    }

    setError(null);
    setDevices([]);
    setIsScanning(true);

    await bleService.scanForDevices(
      (device) => {
        setDevices((prev) => {
          // Avoid duplicates
          if (prev.some((d) => d.id === device.id)) {
            return prev;
          }
          return [...prev, device];
        });
      },
      (err) => {
        setError(err.message);
        setIsScanning(false);
      }
    );

    // Stop scanning after 15 seconds
    setTimeout(() => {
      stopScan();
    }, 15000);
  };

  const stopScan = () => {
    bleService.stopScan();
    setIsScanning(false);
  };

  const connectToDevice = async (device: Device) => {
    setIsConnecting(true);
    setError(null);

    const success = await bleService.connectToDevice(device);

    if (success) {
      setConnectedDevice(device);
      showAlert("Connected!", `Successfully connected to ${device.name || device.id}`);
    } else {
      setError(`Failed to connect to ${device.name || device.id}`);
    }

    setIsConnecting(false);
  };

  const disconnectDevice = async () => {
    await bleService.disconnect();
    setConnectedDevice(null);
    showAlert("Disconnected", "Device has been disconnected");
  };

  const renderDevice = ({ item }: { item: Device }) => (
    <TouchableOpacity
      style={[styles.deviceCard, isDark && styles.deviceCardDark]}
      onPress={() => connectToDevice(item)}
      disabled={isConnecting}
      activeOpacity={0.7}
    >
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceIcon}>📡</Text>
        <View style={styles.deviceDetails}>
          <Text style={[styles.deviceName, isDark && styles.deviceNameDark]}>
            {item.name || "Unknown Device"}
          </Text>
          <Text style={[styles.deviceId, isDark && styles.deviceIdDark]}>
            {item.id}
          </Text>
          {item.rssi && (
            <Text style={styles.deviceRssi}>
              Signal: {item.rssi} dBm
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.connectText}>Tap to connect</Text>
    </TouchableOpacity>
  );

  // Check if BLE is available
  const bleAvailable = bleService.isAvailable();
  const bleError = bleService.getInitError();

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* BLE Not Available Warning */}
      {!bleAvailable && bleError && (
        <View style={styles.bleWarning}>
          <Text style={styles.bleWarningIcon}>⚠️</Text>
          <View style={styles.bleWarningContent}>
            <Text style={styles.bleWarningTitle}>BLE Not Available</Text>
            <Text style={styles.bleWarningText}>
              {bleError}
            </Text>
            <Text style={styles.bleWarningHint}>
              Run: npx expo run:android
            </Text>
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Connect Scrunchie
        </Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
          Scan for your SOS Scrunchie device (HM-10 BLE)
        </Text>
      </View>

      {/* Connected Device */}
      {connectedDevice && (
        <View style={[styles.connectedCard, isDark && styles.connectedCardDark]}>
          <View style={styles.connectedHeader}>
            <View style={styles.connectedIndicator} />
            <Text style={[styles.connectedTitle, isDark && styles.connectedTitleDark]}>
              Connected Device
            </Text>
          </View>
          <View style={styles.connectedInfo}>
            <Text style={styles.connectedIcon}>✅</Text>
            <View style={styles.connectedDetails}>
              <Text style={[styles.connectedName, isDark && styles.connectedNameDark]}>
                {connectedDevice.name || "SOS Device"}
              </Text>
              <Text style={[styles.connectedId, isDark && styles.connectedIdDark]}>
                ID: {connectedDevice.id.substring(0, 17)}...
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={disconnectDevice}
          >
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Scan Controls */}
      {!connectedDevice && (
        <View style={styles.scanSection}>
          <TouchableOpacity
            style={[
              styles.scanButton,
              isScanning && styles.scanButtonActive,
            ]}
            onPress={isScanning ? stopScan : startScan}
            disabled={isConnecting}
          >
            {isScanning ? (
              <>
                <ActivityIndicator color="#ffffff" size="small" />
                <Text style={styles.scanButtonText}>Scanning...</Text>
              </>
            ) : (
              <>
                <Text style={styles.scanButtonIcon}>🔍</Text>
                <Text style={styles.scanButtonText}>Scan for Devices</Text>
              </>
            )}
          </TouchableOpacity>

          {isScanning && (
            <Text style={[styles.scanHint, isDark && styles.scanHintDark]}>
              Make sure your scrunchie is powered on and in pairing mode
            </Text>
          )}
        </View>
      )}

      {/* Loading Overlay */}
      {isConnecting && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, isDark && styles.loadingCardDark]}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={[styles.loadingText, isDark && styles.loadingTextDark]}>
              Connecting to device...
            </Text>
          </View>
        </View>
      )}

      {/* Device List */}
      {!connectedDevice && devices.length > 0 && (
        <View style={styles.listSection}>
          <Text style={[styles.listTitle, isDark && styles.listTitleDark]}>
            Found Devices ({devices.length})
          </Text>
          <FlatList
            data={devices}
            keyExtractor={(item) => item.id}
            renderItem={renderDevice}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        </View>
      )}

      {/* Empty State */}
      {!connectedDevice && !isScanning && devices.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📱</Text>
          <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>
            No Devices Found
          </Text>
          <Text style={[styles.emptySubtitle, isDark && styles.emptySubtitleDark]}>
            Press "Scan for Devices" to find your SOS Scrunchie
          </Text>
        </View>
      )}

      {/* Instructions */}
      <View style={[styles.instructions, isDark && styles.instructionsDark]}>
        <Text style={[styles.instructionsTitle, isDark && styles.instructionsTitleDark]}>
          📖 How to Connect
        </Text>
        <Text style={[styles.instructionsText, isDark && styles.instructionsTextDark]}>
          1. Make sure your scrunchie is powered on{"\n"}
          2. Press the button on scrunchie to enter pairing mode{"\n"}
          3. Tap "Scan for Devices" above{"\n"}
          4. Select your device (usually named "HM-10" or "SOS")
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f8fafc",
  },
  containerDark: {
    backgroundColor: "#0f0f23",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  titleDark: {
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
  },
  subtitleDark: {
    color: "#94a3b8",
  },
  connectedCard: {
    backgroundColor: "#dcfce7",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "#22c55e",
  },
  connectedCardDark: {
    backgroundColor: "#14532d",
    borderColor: "#22c55e",
  },
  connectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  connectedIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    marginRight: 8,
  },
  connectedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
  },
  connectedTitleDark: {
    color: "#86efac",
  },
  connectedInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  connectedIcon: {
    fontSize: 36,
    marginRight: 14,
  },
  connectedDetails: {
    flex: 1,
  },
  connectedName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 4,
  },
  connectedNameDark: {
    color: "#ffffff",
  },
  connectedId: {
    fontSize: 12,
    color: "#15803d",
  },
  connectedIdDark: {
    color: "#86efac",
  },
  disconnectButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  disconnectButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  errorCard: {
    backgroundColor: "#fee2e2",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
  },
  errorText: {
    color: "#991b1b",
    fontSize: 14,
  },
  scanSection: {
    marginBottom: 20,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#667eea",
    padding: 18,
    borderRadius: 14,
    gap: 10,
  },
  scanButtonActive: {
    backgroundColor: "#4f46e5",
  },
  scanButtonIcon: {
    fontSize: 20,
  },
  scanButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  scanHint: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginTop: 12,
    fontStyle: "italic",
  },
  scanHintDark: {
    color: "#94a3b8",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  loadingCard: {
    backgroundColor: "#ffffff",
    padding: 30,
    borderRadius: 16,
    alignItems: "center",
  },
  loadingCardDark: {
    backgroundColor: "#1e293b",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#1a1a2e",
    fontWeight: "600",
  },
  loadingTextDark: {
    color: "#ffffff",
  },
  listSection: {
    flex: 1,
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 12,
  },
  listTitleDark: {
    color: "#ffffff",
  },
  listContent: {
    gap: 10,
  },
  deviceCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  deviceCardDark: {
    backgroundColor: "#1e293b",
  },
  deviceInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  deviceIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  deviceDetails: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  deviceNameDark: {
    color: "#ffffff",
  },
  deviceId: {
    fontSize: 12,
    color: "#64748b",
  },
  deviceIdDark: {
    color: "#94a3b8",
  },
  deviceRssi: {
    fontSize: 11,
    color: "#667eea",
    marginTop: 2,
  },
  connectText: {
    fontSize: 13,
    color: "#667eea",
    fontWeight: "600",
    textAlign: "right",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  emptyTitleDark: {
    color: "#94a3b8",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    textAlign: "center",
  },
  emptySubtitleDark: {
    color: "#64748b",
  },
  instructions: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 14,
    marginTop: "auto",
  },
  instructionsDark: {
    backgroundColor: "#1e293b",
  },
  instructionsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 10,
  },
  instructionsTitleDark: {
    color: "#ffffff",
  },
  instructionsText: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 22,
  },
  instructionsTextDark: {
    color: "#94a3b8",
  },
  bleWarning: {
    flexDirection: "row",
    backgroundColor: "#fef3c7",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  bleWarningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  bleWarningContent: {
    flex: 1,
  },
  bleWarningTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 4,
  },
  bleWarningText: {
    fontSize: 13,
    color: "#92400e",
    marginBottom: 6,
  },
  bleWarningHint: {
    fontSize: 12,
    color: "#b45309",
    fontFamily: "monospace",
    backgroundColor: "#fde68a",
    padding: 6,
    borderRadius: 4,
    overflow: "hidden",
  },
});
