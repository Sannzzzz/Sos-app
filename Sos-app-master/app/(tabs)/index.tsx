import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Vibration,
} from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { bleService } from "@/services/ble-service";
import { sosService } from "@/services/sos-service";
import { firebaseService } from "@/services/firebase-service";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@contacts_v2";

export default function Home() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [isConnected, setIsConnected] = useState(false);
  const [connectedDeviceName, setConnectedDeviceName] = useState<string | null>(null);
  const [contactCount, setContactCount] = useState(0);
  const [lastSOSTime, setLastSOSTime] = useState<string | null>(null);
  const [sosStatus, setSOSStatus] = useState<string>("");

  // Init Firebase & Push Notifications
  useEffect(() => {
    const initApp = async () => {
      await firebaseService.init();
      firebaseService.setupNotificationHandler();
    };
    initApp();
  }, []);

  // Load contact count
  useEffect(() => {
    loadContactCount();
  }, []);

  const loadContactCount = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const contacts = JSON.parse(saved);
        setContactCount(Array.isArray(contacts) ? contacts.length : 0);
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  // Set up SOS callback when BLE receives signal
  const handleSOSTrigger = useCallback(async () => {
    console.log("🚨 SOS TRIGGERED FROM SCRUNCHIE!");

    // Vibrate immediately
    Vibration.vibrate([0, 300, 100, 300]);

    setSOSStatus("🚨 SOS SIGNAL RECEIVED! Sending Alert...");

    try {
      // Timeout after 15 seconds
      const timeoutPromise = new Promise<{ success: boolean; message: string }>((resolve) => {
        setTimeout(() => {
          resolve({ success: false, message: "Timeout - please try again" });
        }, 15000);
      });

      const sosPromise = sosService.triggerSOS((status) => {
        setSOSStatus(status);
      });

      const result = await Promise.race([sosPromise, timeoutPromise]);

      if (result.success) {
        setSOSStatus("✅ " + result.message);
        setLastSOSTime(new Date().toLocaleTimeString());
      } else {
        setSOSStatus("❌ " + result.message);
        sosService.resetSendingState();
      }

      // Clear status after 8 seconds
      setTimeout(() => setSOSStatus(""), 8000);
    } catch (error) {
      setSOSStatus("❌ Error sending SOS");
      console.error("SOS Error:", error);
      sosService.resetSendingState();
    }
  }, []);

  // Check connection status periodically
  useEffect(() => {
    const checkConnection = () => {
      const connected = bleService.isConnected();
      setIsConnected(connected);

      if (connected) {
        const device = bleService.getConnectedDevice();
        setConnectedDeviceName(device?.name || device?.id || "SOS Device");
      } else {
        setConnectedDeviceName(null);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 2000);

    return () => clearInterval(interval);
  }, []);

  // Set up SOS callback
  useEffect(() => {
    bleService.setSOSCallback(handleSOSTrigger);
  }, [handleSOSTrigger]);

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Status Section */}
      <View style={[styles.statusCard, isDark && styles.statusCardDark]}>
        <View style={styles.statusRow}>
          <View style={[
            styles.statusIndicator,
            isConnected ? styles.statusConnected : styles.statusDisconnected
          ]} />
          <Text style={[styles.statusText, isDark && styles.statusTextDark]}>
            {isConnected
              ? `Connected: ${connectedDeviceName}`
              : "Scrunchie Not Connected"}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{contactCount}</Text>
            <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
              Linked Contacts
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {lastSOSTime || "--:--"}
            </Text>
            <Text style={[styles.statLabel, isDark && styles.statLabelDark]}>
              Last Alert
            </Text>
          </View>
        </View>
      </View>

      {/* SOS Status Alert */}
      {sosStatus ? (
        <View style={[styles.sosAlert, isDark && styles.sosAlertDark]}>
          <Text style={styles.sosAlertText}>{sosStatus}</Text>
        </View>
      ) : null}

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={[
          styles.iconContainer,
          isConnected && styles.iconContainerConnected
        ]}>
          <Text style={styles.heroIcon}>🆘</Text>
        </View>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Smart SOS Scrunchie
        </Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
          {isConnected
            ? "Your scrunchie is connected and ready. Press the SOS button on your scrunchie to send emergency push alerts."
            : "Connect your SOS scrunchie via Bluetooth to enable automatic emergency alerts."}
        </Text>
      </View>

      {/* Action Cards */}
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/explore")}
          activeOpacity={0.85}
        >
          <View style={[styles.cardContent, { backgroundColor: "#667eea" }]}>
            <Text style={styles.cardIcon}>📡</Text>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>
                {isConnected ? "Device Connected" : "Connect Scrunchie"}
              </Text>
              <Text style={styles.cardDescription}>
                {isConnected
                  ? "Tap to manage or reconnect device"
                  : "Scan and pair with your SOS device"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => {
            loadContactCount();
            router.push("/contacts");
          }}
          activeOpacity={0.85}
        >
          <View style={[styles.cardContent, { backgroundColor: "#059669" }]}>
            <Text style={styles.cardIcon}>👥</Text>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>Linked Devices</Text>
              <Text style={styles.cardDescription}>
                {contactCount > 0
                  ? `${contactCount} contact(s) linked`
                  : "Add family member's User ID"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push("/test")}
          activeOpacity={0.85}
        >
          <View style={[styles.cardContent, { backgroundColor: "#e63946" }]}>
            <Text style={styles.cardIcon}>🚨</Text>
            <View style={styles.cardTextContainer}>
              <Text style={styles.cardTitle}>Test SOS Alert</Text>
              <Text style={styles.cardDescription}>
                Manually trigger a test emergency alert
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      {!isConnected && contactCount === 0 && (
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerText}>
            ⚠️ Setup not complete: Link a contact and connect your scrunchie
          </Text>
        </View>
      )}
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
  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusCardDark: {
    backgroundColor: "#1e293b",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusConnected: {
    backgroundColor: "#22c55e",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  statusDisconnected: {
    backgroundColor: "#94a3b8",
  },
  statusText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  statusTextDark: {
    color: "#ffffff",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 30,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#667eea",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  statLabelDark: {
    color: "#94a3b8",
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#e2e8f0",
  },
  sosAlert: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  sosAlertDark: {
    backgroundColor: "#78350f",
  },
  sosAlertText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400e",
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#e63946",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  iconContainerConnected: {
    backgroundColor: "#dcfce7",
    shadowColor: "#22c55e",
  },
  heroIcon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 10,
    textAlign: "center",
  },
  titleDark: {
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  subtitleDark: {
    color: "#94a3b8",
  },
  cardContainer: {
    gap: 12,
  },
  card: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 14,
  },
  cardIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
  },
  infoBanner: {
    marginTop: 16,
    backgroundColor: "#fef9c3",
    padding: 14,
    borderRadius: 12,
  },
  infoBannerText: {
    fontSize: 13,
    color: "#854d0e",
    textAlign: "center",
  },
});
