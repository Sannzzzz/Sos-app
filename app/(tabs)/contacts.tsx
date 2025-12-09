import { useState, useEffect } from "react";
import { View, Text, TextInput, Button, FlatList, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@contacts";

export default function Contacts() {
  const [contacts, setContacts] = useState<string[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) setContacts(JSON.parse(saved));
  };

  const saveContacts = async (arr: string[]) => {
    setContacts(arr);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  };

  const addContact = () => {
    if (!input.trim()) return;
    const updated = [...contacts, input.trim()];
    saveContacts(updated);
    setInput("");
  };

  const deleteContact = (num: string) => {
    const updated = contacts.filter((c) => c !== num);
    saveContacts(updated);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Emergency Contacts</Text>

      <TextInput
        style={styles.input}
        placeholder="Phone number"
        keyboardType="phone-pad"
        value={input}
        onChangeText={setInput}
      />

      <Button title="Add Contact" onPress={addContact} />

      <FlatList
        style={{ marginTop: 20 }}
        data={contacts}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={{ fontSize: 16 }}>{item}</Text>
            <Button title="Delete" color="red" onPress={() => deleteContact(item)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#eee"
  }
});
