import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "@/hooks/use-color-scheme";

const STORAGE_KEY = "@contacts";

interface Contact {
  id: string;
  phone: string;
  name: string;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Handle migration from old format (array of strings)
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (typeof parsed[0] === "string") {
            const migrated = parsed.map((phone: string, index: number) => ({
              id: `contact_${index}_${Date.now()}`,
              phone,
              name: `Contact ${index + 1}`,
            }));
            setContacts(migrated);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          } else {
            setContacts(parsed);
          }
        }
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const saveContacts = async (arr: Contact[]) => {
    setContacts(arr);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const addContact = () => {
    const phone = phoneInput.trim();
    const name = nameInput.trim() || "Emergency Contact";

    if (!phone) {
      showAlert("Error", "Please enter a phone number");
      return;
    }

    // Basic phone validation
    const phoneRegex = /^[+]?[\d\s-()]{7,}$/;
    if (!phoneRegex.test(phone)) {
      showAlert("Invalid Phone", "Please enter a valid phone number");
      return;
    }

    // Check for duplicate
    if (contacts.some((c) => c.phone === phone)) {
      showAlert("Duplicate", "This phone number is already added");
      return;
    }

    const newContact: Contact = {
      id: `contact_${Date.now()}`,
      phone,
      name,
    };

    saveContacts([...contacts, newContact]);
    setPhoneInput("");
    setNameInput("");
  };

  const deleteContact = (id: string) => {
    const updated = contacts.filter((c) => c.id !== id);
    saveContacts(updated);
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Emergency Contacts
        </Text>
        <Text style={[styles.subtitle, isDark && styles.subtitleDark]}>
          Add trusted people who will receive your SOS alerts
        </Text>
      </View>

      {/* Add Contact Form */}
      <View style={[styles.formCard, isDark && styles.formCardDark]}>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Contact Name (optional)"
          placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
          value={nameInput}
          onChangeText={setNameInput}
        />
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Phone Number"
          placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
          keyboardType="phone-pad"
          value={phoneInput}
          onChangeText={setPhoneInput}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={addContact}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>➕ Add Contact</Text>
        </TouchableOpacity>
      </View>

      {/* Contacts List */}
      <View style={styles.listHeader}>
        <Text style={[styles.listTitle, isDark && styles.listTitleDark]}>
          Your Contacts ({contacts.length})
        </Text>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📇</Text>
          <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
            No emergency contacts yet
          </Text>
          <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
            Add contacts above to get started
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={contacts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.contactCard, isDark && styles.contactCardDark]}>
              <View style={styles.contactInfo}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactDetails}>
                  <Text style={[styles.contactName, isDark && styles.contactNameDark]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.contactPhone, isDark && styles.contactPhoneDark]}>
                    {item.phone}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteContact(item.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  containerDark: {
    backgroundColor: "#0f0f23",
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1a1a2e",
    marginBottom: 8,
  },
  titleDark: {
    color: "#ffffff",
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    lineHeight: 22,
  },
  subtitleDark: {
    color: "#94a3b8",
  },
  formCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  formCardDark: {
    backgroundColor: "#1e293b",
  },
  input: {
    backgroundColor: "#f1f5f9",
    borderWidth: 2,
    borderColor: "transparent",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 16,
    color: "#1a1a2e",
  },
  inputDark: {
    backgroundColor: "#334155",
    color: "#ffffff",
  },
  addButton: {
    backgroundColor: "#667eea",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  addButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  listHeader: {
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a2e",
  },
  listTitleDark: {
    color: "#ffffff",
  },
  list: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  emptyTextDark: {
    color: "#94a3b8",
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94a3b8",
  },
  emptySubtextDark: {
    color: "#64748b",
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactCardDark: {
    backgroundColor: "#1e293b",
  },
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#667eea",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    marginBottom: 4,
  },
  contactNameDark: {
    color: "#ffffff",
  },
  contactPhone: {
    fontSize: 14,
    color: "#64748b",
  },
  contactPhoneDark: {
    color: "#94a3b8",
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 20,
  },
});
