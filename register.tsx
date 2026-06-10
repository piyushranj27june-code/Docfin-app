import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft } from "@/src/icons";

import { useAuth } from "@/src/context/auth-context";
import { api } from "@/src/api";
import { colors, radius, spacing, fontWeight } from "@/src/theme";

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [hospital, setHospital] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError("");
    if (!name || !email || !password) {
      setError("Name, email and password are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        specialty: specialty.trim() || "General Practitioner",
        hospital: hospital.trim(),
      });
      // Auto-seed demo data so new users see a populated dashboard
      try {
        await api("/seed/demo", { method: "POST" });
      } catch {
        // non-blocking
      }
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            testID="register-back-button"
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.title} testID="register-title">
            Create Account
          </Text>
          <Text style={styles.subtitle}>
            Get personalized financial insights designed for doctors.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              testID="register-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Dr. Aarav Sharma"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Email *</Text>
            <TextInput
              testID="register-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="doctor@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Password *</Text>
            <TextInput
              testID="register-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Specialty</Text>
            <TextInput
              testID="register-specialty-input"
              value={specialty}
              onChangeText={setSpecialty}
              placeholder="Cardiology, Pediatrics, etc."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Hospital / Clinic</Text>
            <TextInput
              testID="register-hospital-input"
              value={hospital}
              onChangeText={setHospital}
              placeholder="Apollo Hospital"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />

            {error ? (
              <Text style={styles.errorText} testID="register-error">
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              testID="register-submit-button"
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: fontWeight.black,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: fontWeight.bold },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: "center",
  },
});
