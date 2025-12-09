import { View, Text, StyleSheet, Button } from "react-native";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Smart SOS Scrunchie App</Text>

      <View style={{ marginVertical: 10 }}>
        <Button title="Emergency Contacts" onPress={() => router.push("/contacts")} />
      </View>

      <View style={{ marginVertical: 10 }}>
        <Button title="Test SOS Alert" onPress={() => router.push("/test")} color="#e63946" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 20 }
});
