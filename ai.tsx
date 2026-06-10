import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Send, Sparkles } from "@/src/icons";

import { api } from "@/src/api";
import { colors, radius, spacing, fontWeight } from "@/src/theme";

interface Msg {
  role: "user" | "ai";
  text: string;
}

const SUGGESTIONS = [
  "Where is my hospital losing money?",
  "How can I save tax this year?",
  "Suggest 3 ways to increase OPD revenue",
  "Should I prepay my home loan or invest more?",
];

export default function AICoachScreen() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "ai",
      text:
        "Hello Doctor! I'm your AI finance coach.\n\nAsk me about hospital revenue, tax planning, cash flow leakage, or any financial improvement suggestion tailored to your data.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const sessionIdRef = useRef<string>(`session-${Date.now()}`);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setInput("");
    setSending(true);
    try {
      const res = await api<{ reply: string; session_id: string }>("/ai/insights", {
        method: "POST",
        body: { message: msg, session_id: sessionIdRef.current },
      });
      sessionIdRef.current = res.session_id;
      setMessages((m) => [...m, { role: "ai", text: res.reply }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "ai", text: `Sorry, I couldn't fetch insights. ${e?.message || ""}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Sparkles size={18} color={colors.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.title}>AI Finance Coach</Text>
          <Text style={styles.subtitle}>Powered by Claude · personalized to your data</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          testID="ai-chat-scroll"
        >
          {messages.map((m, i) => (
            <View
              key={i}
              style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.aiBubble]}
              testID={`msg-${i}`}
            >
              <Text style={[styles.bubbleText, m.role === "user" && { color: "#fff" }]}>
                {m.text}
              </Text>
            </View>
          ))}
          {sending && (
            <View style={[styles.bubble, styles.aiBubble]} testID="ai-typing">
              <ActivityIndicator size="small" color={colors.brand} />
            </View>
          )}

          {messages.length <= 1 && (
            <View style={styles.suggestionsWrap}>
              <Text style={styles.suggestionsLabel}>Try asking:</Text>
              {SUGGESTIONS.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.suggestionChip}
                  onPress={() => send(s)}
                  activeOpacity={0.85}
                  testID={`suggestion-${i}`}
                >
                  <Text style={styles.suggestionText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            testID="ai-message-input"
            value={input}
            onChangeText={setInput}
            placeholder="Ask anything about your finances..."
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            testID="send-message-button"
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
            onPress={() => send()}
            disabled={!input.trim() || sending}
          >
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.text },
  subtitle: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.lg, gap: 10 },
  bubble: {
    padding: spacing.md,
    borderRadius: radius.lg,
    maxWidth: "88%",
    marginBottom: 8,
  },
  userBubble: {
    backgroundColor: colors.brand,
    alignSelf: "flex-end",
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: colors.card,
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  suggestionsWrap: { marginTop: spacing.md, gap: 8 },
  suggestionsLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  suggestionChip: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(204,90,58,0.2)",
  },
  suggestionText: { fontSize: 13, color: colors.accent, fontWeight: fontWeight.semibold },
  inputBar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
});
