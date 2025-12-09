import { View, Text, Button, StyleSheet, Alert } from "react-native";
import * as Location from "expo-location";
import * as SMS from "expo-sms";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@contacts";

export default function TestSOS() {
  const simulate = async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    const contacts: string[] = saved ? JSON.parse(saved) : [];

    if (!contacts.length) {
      Alert.alert("No Contacts", "Please add at least one contact.");
      return;
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Location permission is required.");
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    const url = `https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`;

    const available = await SMS.isAvailableAsync();
    if (!available) {
      Alert.alert("SMS not available");
      return;
    }

    await SMS.sendSMSAsync(
      contacts,
      `🚨 *SOS Test Alert!*\nUser triggered a test alert.\nLocation:\n${url}`
    );

    Alert.alert("Success", "Test SOS message sent!");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test SOS (No Hardware Needed)</Text>
      <Button title="Simulate SOS Alert" onPress={simulate} color="#e63946" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 20 }
});
