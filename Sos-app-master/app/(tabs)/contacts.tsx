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
  ActivityIndicator,
  Clipboard
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { firebaseService } from "@/services/firebase-service";

const STORAGE_KEY = "@contacts_v2";

interface Contact {
  id: string; // User ID
  name: string;
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [userIdInput, setUserIdInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [myUserId, setMyUserId] = useState("Loading...");

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  useEffect(() => {
    initService();
  }, []);

  const initService = async () => {
    await firebaseService.init();
    setMyUserId(firebaseService.getUserId());
    loadContacts();
  };

  const loadContacts = async () => {
    try {
      // For MVP, we still store the "My Contacts" list locally for speed
      // But we verify them against Firebase when needed
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setContacts(JSON.parse(saved));
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
    }
  };

  const saveContacts = async (arr: Contact[]) => {
    setContacts(arr);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  };

  const copyUserId = () => {
    Clipboard.setString(myUserId);
    if (Platform.OS === 'web') window.alert('User ID Copied!');
    else Alert.alert('Copied!', 'Share this ID with your family so they can add you.');
  };

  const addContact = async () => {
    const contactId = userIdInput.trim();
    const name = nameInput.trim() || "Emergency Contact";

    if (!contactId) {
      Alert.alert("Error", "Please enter a User ID");
      return;
    }

    if (contactId === myUserId) {
      Alert.alert("Error", "You cannot add yourself as a contact");
      return;
    }

    if (contacts.some(c => c.id === contactId)) {
      Alert.alert("Error", "This user is already in your contacts");
      return;
    }

    setLoading(true);

    // Verify user exists in Firebase
    const result = await firebaseService.addContact(contactId, name);

    if (result.success) {
      const newContact: Contact = { id: contactId, name };
      saveContacts([...contacts, newContact]);
      setUserIdInput("");
      setNameInput("");
      Alert.alert("Success", "Contact added & verified!");
    } else {
      Alert.alert("Error", result.message);
    }

    setLoading(false);
  };

  const deleteContact = (id: string) => {
    Alert.alert(
      "Remove Contact",
      "Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const updated = contacts.filter((c) => c.id !== id);
            saveContacts(updated);
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* My ID Section */}
      <View style={[styles.idCard, isDark && styles.idCardDark]}>
        <Text style={styles.idLabel}>Your App User ID:</Text>
        <TouchableOpacity onPress={copyUserId} style={styles.idRow}>
          <Text style={[styles.idText, isDark && styles.idTextDark]}>{myUserId}</Text>
          <Text style={styles.copyIcon}>📋</Text>
        </TouchableOpacity>
        <Text style={styles.idHint}>Share this with family so they can add you.</Text>
      </View>

      {/* Add Contact Form */}
      <View style={[styles.formCard, isDark && styles.formCardDark]}>
        <Text style={[styles.formTitle, isDark && styles.formTitleDark]}>Add Emergency Contact</Text>
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Contact Name (e.g. Mom)"
          placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
          value={nameInput}
          onChangeText={setNameInput}
        />
        <TextInput
          style={[styles.input, isDark && styles.inputDark]}
          placeholder="Enter their App User ID"
          placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
          value={userIdInput}
          onChangeText={setUserIdInput}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.addButton, loading && styles.disabledButton]}
          onPress={addContact}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.addButtonText}>Connect User</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Contacts List */}
      <View style={styles.listHeader}>
        <Text style={[styles.listTitle, isDark && styles.listTitleDark]}>
          Linked Devices ({contacts.length})
        </Text>
      </View>

      {contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📱</Text>
          <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
            No devices linked
          </Text>
          <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
            Add a User ID above to link a device.
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={contacts}
          keyExtractor={(item) => item.id}
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
                    ID: {item.id}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteContact(item.id)}
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
  idCard: {
    backgroundColor: "#dbeafe",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bfdbfe"
  },
  idCardDark: {
    backgroundColor: "#1e3a8a",
    borderColor: "#2563eb"
  },
  idLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
    marginBottom: 4
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  idText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e3a8a",
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  idTextDark: {
    color: "#dbeafe"
  },
  copyIcon: {
    fontSize: 18
  },
  idHint: {
    fontSize: 11,
    color: "#60a5fa"
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#334155'
  },
  formTitleDark: {
    color: '#e2e8f0'
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
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 16,
    color: "#1a1a2e",
  },
  inputDark: {
    backgroundColor: "#334155",
    borderColor: "#475569",
    color: "#ffffff",
  },
  addButton: {
    backgroundColor: "#667eea",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.7
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
    fontSize: 12,
    color: "#64748b",
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
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
