import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Vibration,
} from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { sosService } from "@/services/sos-service";
import { bleService } from "@/services/ble-service";

export default function TestSOS() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [lastSentTime, setLastSentTime] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const isConnected = bleService.isConnected();

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const sendTestSOS = async () => {
    if (isLoading) return;

    setIsLoading(true);

    // Vibrate to indicate action
    Vibration.vibrate([0, 200, 100, 200]);

    try {
      const result = await sosService.triggerSOS((statusUpdate) => {
        setStatus(statusUpdate);
      });

      if (result.success) {
        setStatus("✅ " + result.message);
        setLastSentTime(new Date().toLocaleTimeString());
        showAlert("Success", result.message);
      } else {
        setStatus("❌ " + result.message);
        showAlert("Error", result.message);
      }
    } catch (error) {
      setStatus("❌ Error sending SOS");
      showAlert("Error", "Failed to send SOS. Please try again.");
    } finally {
      setIsLoading(false);
      // Clear status after 10 seconds
      setTimeout(() => setStatus(""), 10000);
    }
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Test SOS Alert
        </Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
          Manually trigger an SOS alert to test the system without using the scrunchie button
        </Text>
      </View>

      {/* Connection Status */}
      <View style={[styles.statusCard, isDark && styles.statusCardDark]}>
        <View style={styles.statusRow}>
          <View style={[
            styles.statusDot,
            isConnected ? styles.statusDotConnected : styles.statusDotDisconnected
          ]} />
          <Text style={[styles.statusText, isDark && styles.statusTextDark]}>
            {isConnected
              ? "Scrunchie Connected - Ready for automatic SOS"
              : "Scrunchie Not Connected - Manual test only"}
          </Text>
        </View>
        {lastSentTime && (
          <Text style={[styles.lastSent, isDark && styles.lastSentDark]}>
            Last SOS sent: {lastSentTime}
          </Text>
        )}
      </View>

      {/* SOS Button */}
      <View style={styles.sosSection}>
        {/* Pulse rings */}
        <View style={[styles.pulseRing, styles.pulseRing1]} />
        <View style={[styles.pulseRing, styles.pulseRing2]} />
        <View style={[styles.pulseRing, styles.pulseRing3]} />

        <TouchableOpacity
          style={[styles.sosButton, isLoading && styles.sosButtonDisabled]}
          onPress={sendTestSOS}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.loadingText}>SENDING...</Text>
            </View>
          ) : (
            <View style={styles.sosButtonContent}>
              <Text style={styles.sosButtonIcon}>🆘</Text>
              <Text style={styles.sosButtonText}>SEND{"\n"}SOS</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Status Message */}
      {status ? (
        <View style={[styles.statusMessage, isDark && styles.statusMessageDark]}>
          <Text style={[styles.statusMessageText, isDark && styles.statusMessageTextDark]}>
            {status}
          </Text>
        </View>
      ) : null}

      {/* Instructions */}
      <View style={[styles.instructions, isDark && styles.instructionsDark]}>
        <Text style={[styles.instructionTitle, isDark && styles.instructionTitleDark]}>
          ℹ️ What happens when you press SOS
        </Text>
        <View style={styles.instructionList}>
          <View style={styles.instructionItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <Text style={[styles.instructionText, isDark && styles.instructionTextDark]}>
              Phone vibrates to confirm action
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <Text style={[styles.instructionText, isDark && styles.instructionTextDark]}>
              Your current GPS location is captured
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <Text style={[styles.instructionText, isDark && styles.instructionTextDark]}>
              Emergency SMS with location is sent to all contacts
            </Text>
          </View>
        </View>
      </View>

      {/* Important Notice */}
      <View style={styles.noticeCard}>
        <Text style={styles.noticeIcon}>⚡</Text>
        <Text style={styles.noticeText}>
          {Platform.OS === "android"
            ? "On APK build, SMS will be sent automatically without opening the messaging app."
            : "This test will use your device's SMS capabilities."}
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
    marginBottom: 16,
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
  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
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
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusDotConnected: {
    backgroundColor: "#22c55e",
  },
  statusDotDisconnected: {
    backgroundColor: "#94a3b8",
  },
  statusText: {
    fontSize: 14,
    color: "#1a1a2e",
    flex: 1,
  },
  statusTextDark: {
    color: "#ffffff",
  },
  lastSent: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 8,
    fontStyle: "italic",
  },
  lastSentDark: {
    color: "#94a3b8",
  },
  sosSection: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
    position: "relative",
    height: 220,
  },
  pulseRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 3,
    zIndex: 1,
  },
  pulseRing1: {
    width: 200,
    height: 200,
    borderColor: "rgba(230, 57, 70, 0.25)",
  },
  pulseRing2: {
    width: 240,
    height: 240,
    borderColor: "rgba(230, 57, 70, 0.15)",
  },
  pulseRing3: {
    width: 280,
    height: 280,
    borderColor: "rgba(230, 57, 70, 0.08)",
  },
  sosButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#e63946",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#e63946",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 10,
  },
  sosButtonDisabled: {
    backgroundColor: "#f87171",
    shadowOpacity: 0.3,
  },
  sosButtonContent: {
    alignItems: "center",
  },
  sosButtonIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  sosButtonText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: 2,
  },
  loadingContent: {
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 10,
  },
  statusMessage: {
    backgroundColor: "#dbeafe",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusMessageDark: {
    backgroundColor: "#1e3a5f",
  },
  statusMessageText: {
    fontSize: 15,
    color: "#1e40af",
    textAlign: "center",
    fontWeight: "600",
  },
  statusMessageTextDark: {
    color: "#93c5fd",
  },
  instructions: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
  },
  instructionsDark: {
    backgroundColor: "#1e293b",
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a2e",
    marginBottom: 14,
  },
  instructionTitleDark: {
    color: "#ffffff",
  },
  instructionList: {
    gap: 10,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stepNumberText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  instructionText: {
    fontSize: 14,
    color: "#475569",
    flex: 1,
  },
  instructionTextDark: {
    color: "#94a3b8",
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  noticeIcon: {
    fontSize: 20,
  },
  noticeText: {
    fontSize: 13,
    color: "#047857",
    flex: 1,
    lineHeight: 18,
  },
});
