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

import { useAuth } from "@/src/context/auth-context";
import { colors, radius, spacing, fontWeight } from "@/src/theme";
import { Logo } from "@/src/components/logo";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("demo@doctor.com");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e?.message || "Login failed");
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
          <View style={styles.brandBlock}>
            <Logo size={72} />
            <Text style={styles.title} testID="login-title">
              DocFin
            </Text>
            <Text style={styles.subtitle}>
              Smart finance for young doctors.{"\n"}Plan, track & grow with AI.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              placeholder="doctor@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: spacing.md }]}>Password</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
            />

            {error ? (
              <Text style={styles.errorText} testID="login-error">
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              testID="login-submit-button"
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="go-to-register-button"
              style={styles.linkBtn}
              onPress={() => router.push("/register")}
            >
              <Text style={styles.linkText}>
                New here? <Text style={{ color: colors.brand, fontWeight: fontWeight.bold }}>Create an account</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.demoHint}>
            <Text style={styles.demoText}>
              Demo: demo@doctor.com / demo1234
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingTop: spacing.xxl, flexGrow: 1 },
  brandBlock: { alignItems: "center", marginBottom: spacing.xl, gap: spacing.md },
  title: {
    fontSize: 36,
    fontWeight: fontWeight.black,
    color: colors.text,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
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
  primaryBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
  linkBtn: {
    marginTop: spacing.md,
    alignItems: "center",
  },
  linkText: { color: colors.textMuted, fontSize: 14 },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: spacing.md,
    textAlign: "center",
  },
  demoHint: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  demoText: { color: colors.textMuted, fontSize: 12, fontStyle: "italic" },
});
