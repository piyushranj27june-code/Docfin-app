import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Sparkles, Trash2, X } from "@/src/icons";

import { api } from "@/src/api";
import { colors, radius, spacing, fontWeight, formatINRFull } from "@/src/theme";

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  ai_categorized: boolean;
}

interface Summary {
  total: number;
  month_total: number;
  count: number;
  by_category: { category: string; amount: number }[];
}

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [ex, sum] = await Promise.all([
        api<Expense[]>("/expenses"),
        api<Summary>("/expenses/summary"),
      ]);
      setExpenses(ex);
      setSummary(sum);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleAdd = async () => {
    setError("");
    if (!desc.trim() || !amount.trim()) {
      setError("Description and amount required");
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Enter valid amount");
      return;
    }
    setSubmitting(true);
    try {
      await api("/expenses", {
        method: "POST",
        body: { description: desc.trim(), amount: amt },
      });
      setDesc("");
      setAmount("");
      setShowAdd(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to add");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(`/expenses/${id}`, { method: "DELETE" });
      await load();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ActivityIndicator style={{ marginTop: 100 }} color={colors.brand} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Expenses</Text>
          <Text style={styles.subtitle}>AI categorizes automatically</Text>
        </View>
        <TouchableOpacity
          testID="add-expense-fab"
          style={styles.fab}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.85}
        >
          <Plus size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        showsVerticalScrollIndicator={false}
        testID="expenses-scroll"
      >
        {/* Summary */}
        <View style={styles.summaryCard} testID="expenses-summary">
          <View style={styles.summaryRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>This Month</Text>
              <Text style={styles.summaryValue}>{formatINRFull(summary?.month_total || 0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>All Time</Text>
              <Text style={styles.summaryValue}>{formatINRFull(summary?.total || 0)}</Text>
            </View>
          </View>
          <Text style={styles.summaryFoot}>{summary?.count || 0} expenses logged</Text>
        </View>

        {summary && summary.by_category.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>By Category</Text>
            <View style={styles.categoriesCard}>
              {summary.by_category.slice(0, 6).map((c) => {
                const pct = summary.total > 0 ? (c.amount / summary.total) * 100 : 0;
                return (
                  <View key={c.category} style={styles.catRow}>
                    <View style={styles.catLine}>
                      <Text style={styles.catName}>{c.category}</Text>
                      <Text style={styles.catAmount}>{formatINRFull(c.amount)}</Text>
                    </View>
                    <View style={styles.progressBg}>
                      <View
                        style={[styles.progressFill, { width: `${Math.max(2, pct)}%` }]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Recent Expenses</Text>
        {expenses.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              Tap + to add your first expense. Our AI will categorize it instantly.
            </Text>
          </View>
        ) : (
          expenses.map((e) => (
            <View key={e.id} style={styles.expenseCard} testID={`expense-${e.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.expDesc}>{e.description}</Text>
                <View style={styles.expMeta}>
                  <View style={styles.catPill}>
                    {e.ai_categorized ? (
                      <Sparkles size={10} color={colors.accent} />
                    ) : null}
                    <Text style={styles.catPillText}>{e.category}</Text>
                  </View>
                  <Text style={styles.expDate}>{e.date}</Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.expAmount}>{formatINRFull(e.amount)}</Text>
                <TouchableOpacity
                  testID={`delete-expense-${e.id}`}
                  onPress={() => handleDelete(e.id)}
                  hitSlop={8}
                  style={{ marginTop: 6 }}
                >
                  <Trash2 size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <Modal
        visible={showAdd}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAdd(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modalCard} testID="add-expense-modal">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Expense</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)} testID="close-add-modal" hitSlop={8}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              testID="expense-description-input"
              value={desc}
              onChangeText={setDesc}
              placeholder="e.g. Stethoscope replacement"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <Text style={[styles.label, { marginTop: spacing.md }]}>Amount (₹)</Text>
            <TextInput
              testID="expense-amount-input"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.input}
            />

            <View style={styles.aiHint}>
              <Sparkles size={14} color={colors.accent} />
              <Text style={styles.aiHintText}>
                AI will auto-categorize after you save.
              </Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              testID="submit-expense-button"
              style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
              onPress={handleAdd}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Save & Categorize</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 26, fontWeight: fontWeight.black, color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  fab: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  summaryCard: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryRow: { flexDirection: "row", gap: spacing.md },
  summaryLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontWeight: fontWeight.semibold,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: fontWeight.black,
    color: "#fff",
    marginTop: 4,
  },
  summaryFoot: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: spacing.sm },
  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  categoriesCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  catRow: { marginBottom: spacing.md },
  catLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  catName: { fontSize: 13, color: colors.text, fontWeight: fontWeight.medium },
  catAmount: { fontSize: 13, color: colors.text, fontWeight: fontWeight.semibold },
  progressBg: {
    height: 6,
    backgroundColor: colors.bgSecondary,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: 6, backgroundColor: colors.brand, borderRadius: 3 },
  expenseCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  expDesc: { fontSize: 14, color: colors.text, fontWeight: fontWeight.semibold },
  expMeta: { flexDirection: "row", gap: spacing.sm, marginTop: 6, alignItems: "center" },
  catPill: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignItems: "center",
  },
  catPillText: { fontSize: 10, color: colors.accent, fontWeight: fontWeight.semibold },
  expDate: { fontSize: 11, color: colors.textMuted },
  expAmount: { fontSize: 15, fontWeight: fontWeight.bold, color: colors.text },
  empty: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.bg,
    padding: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xxl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: 20, fontWeight: fontWeight.bold, color: colors.text },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
  },
  aiHint: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.accentLight,
    borderRadius: radius.md,
  },
  aiHintText: { fontSize: 12, color: colors.accent },
  errorText: { color: colors.error, fontSize: 13, marginTop: spacing.sm, textAlign: "center" },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: fontWeight.bold },
});
