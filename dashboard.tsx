import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Wallet,
  TrendingUp,
  Building2,
  Activity,
  LogOut,
  Sparkles,
  Receipt,
  PiggyBank,
} from "@/src/icons";

import { useAuth } from "@/src/context/auth-context";
import { api } from "@/src/api";
import { colors, radius, spacing, fontWeight, formatINR, formatINRFull } from "@/src/theme";

interface DashboardData {
  month: string;
  personal: {
    expenses_this_month: number;
    total_expenses: number;
    monthly_emi: number;
    total_loan_outstanding: number;
    portfolio_value: number;
    total_invested: number;
    monthly_sip: number;
    loans_count: number;
    investments_count: number;
  };
  hospital: {
    latest_month_revenue: number;
    latest_month_cashflow: number;
    latest_month: string | null;
    months_tracked: number;
  };
  productivity: {
    patients_30d: number;
    hours_30d: number;
    patients_per_hour: number;
    days_logged: number;
  };
}

const AI_BG = "https://images.unsplash.com/photo-1758637612272-ee239fe7a1f0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG9yZ2FuaWMlMjBzaGFwZXMlMjBmaW5hbmNlJTIwZ3Jvd3RofGVufDB8fHx8MTc4MDkzODYwN3ww&ixlib=rb-4.1.0&q=85";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<DashboardData>("/dashboard");
      setData(d);
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

  const seedDemo = async () => {
    setSeedingDemo(true);
    try {
      await api("/seed/demo", { method: "POST" });
      await load();
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ActivityIndicator style={{ marginTop: 100 }} color={colors.brand} size="large" />
      </SafeAreaView>
    );
  }

  const personal = data?.personal;
  const hospital = data?.hospital;
  const productivity = data?.productivity;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        testID="dashboard-scroll"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.name} testID="dashboard-user-name">
              {user?.name?.split(" ").slice(0, 2).join(" ") || "Doctor"}
            </Text>
            {user?.specialty ? (
              <Text style={styles.specialty}>{user.specialty}</Text>
            ) : null}
          </View>
          <TouchableOpacity
            testID="logout-button"
            style={styles.logoutBtn}
            onPress={handleLogout}
            hitSlop={8}
          >
            <LogOut size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* AI Insights Card */}
        <TouchableOpacity
          testID="ai-insights-card"
          activeOpacity={0.85}
          onPress={() => router.push("/(tabs)/ai")}
          style={styles.aiCardWrapper}
        >
          <ImageBackground
            source={{ uri: AI_BG }}
            imageStyle={{ borderRadius: radius.lg, opacity: 0.18 }}
            style={styles.aiCard}
          >
            <View style={styles.aiIconCircle}>
              <Sparkles size={20} color={colors.accent} />
            </View>
            <Text style={styles.aiTitle}>Ask your AI finance coach</Text>
            <Text style={styles.aiSubtitle}>
              Get personalized tips on hospital revenue, tax savings & cash flow.
            </Text>
            <View style={styles.aiCta}>
              <Text style={styles.aiCtaText}>Get insights →</Text>
            </View>
          </ImageBackground>
        </TouchableOpacity>

        {/* Personal Finance */}
        <Text style={styles.sectionLabel}>Personal Finance</Text>
        <View style={styles.row}>
          <StatCard
            testID="stat-expenses-month"
            icon={<Receipt size={18} color={colors.brand} />}
            label="This Month Spend"
            value={formatINR(personal?.expenses_this_month || 0)}
          />
          <StatCard
            testID="stat-emi"
            icon={<Wallet size={18} color={colors.accent} />}
            label="Monthly EMI"
            value={formatINR(personal?.monthly_emi || 0)}
          />
        </View>
        <View style={styles.row}>
          <StatCard
            testID="stat-portfolio"
            icon={<PiggyBank size={18} color={colors.success} />}
            label="Portfolio Value"
            value={formatINR(personal?.portfolio_value || 0)}
            sub={`Invested ${formatINR(personal?.total_invested || 0)}`}
          />
          <StatCard
            testID="stat-sip"
            icon={<TrendingUp size={18} color={colors.info} />}
            label="Monthly SIP"
            value={formatINR(personal?.monthly_sip || 0)}
          />
        </View>

        {/* Hospital */}
        <Text style={styles.sectionLabel}>Hospital Snapshot</Text>
        <View style={styles.bigCard} testID="hospital-snapshot">
          <View style={styles.bigCardHeader}>
            <Building2 size={20} color={colors.brand} />
            <Text style={styles.bigCardTitle}>
              {hospital?.latest_month || "No data yet"}
            </Text>
          </View>
          <View style={styles.bigRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigLabel}>Revenue</Text>
              <Text style={styles.bigValue} testID="hospital-revenue-value">
                {formatINRFull(hospital?.latest_month_revenue || 0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bigLabel}>Net Cashflow</Text>
              <Text
                style={[
                  styles.bigValue,
                  {
                    color:
                      (hospital?.latest_month_cashflow || 0) >= 0
                        ? colors.success
                        : colors.error,
                  },
                ]}
                testID="hospital-cashflow-value"
              >
                {formatINRFull(hospital?.latest_month_cashflow || 0)}
              </Text>
            </View>
          </View>
          <Text style={styles.bigSub}>
            {hospital?.months_tracked || 0} months tracked
          </Text>
        </View>

        {/* Productivity */}
        <Text style={styles.sectionLabel}>Productivity (last 30 days)</Text>
        <View style={styles.bigCard} testID="productivity-snapshot">
          <View style={styles.bigCardHeader}>
            <Activity size={20} color={colors.accent} />
            <Text style={styles.bigCardTitle}>
              {productivity?.days_logged || 0} days logged
            </Text>
          </View>
          <View style={styles.bigRow}>
            <Stat label="Patients" value={`${productivity?.patients_30d || 0}`} />
            <Stat label="Hours" value={`${productivity?.hours_30d || 0}`} />
            <Stat
              label="Per hour"
              value={`${productivity?.patients_per_hour || 0}`}
            />
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            testID="quick-add-expense"
            style={styles.quickBtn}
            onPress={() => router.push("/(tabs)/expenses")}
            activeOpacity={0.85}
          >
            <Text style={styles.quickBtnText}>+ Add Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="seed-demo-button"
            style={[styles.quickBtn, { backgroundColor: colors.brandLight }]}
            onPress={seedDemo}
            disabled={seedingDemo}
            activeOpacity={0.85}
          >
            {seedingDemo ? (
              <ActivityIndicator color={colors.brand} />
            ) : (
              <Text style={[styles.quickBtnText, { color: colors.brand }]}>
                Load Demo Data
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  testID,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  testID?: string;
}) {
  return (
    <View style={styles.statCard} testID={testID}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.bigLabel}>{label}</Text>
      <Text style={styles.bigValueSmall}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  greeting: { fontSize: 13, color: colors.textMuted },
  name: {
    fontSize: 26,
    fontWeight: fontWeight.black,
    color: colors.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  specialty: { fontSize: 12, color: colors.brand, marginTop: 2, fontWeight: fontWeight.semibold },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  aiCardWrapper: { marginBottom: spacing.lg },
  aiCard: {
    backgroundColor: colors.accentLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(204,90,58,0.2)",
    overflow: "hidden",
  },
  aiIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(204,90,58,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  aiSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  aiCta: { marginTop: spacing.md },
  aiCtaText: { color: colors.accent, fontWeight: fontWeight.bold, fontSize: 14 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  row: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.bgSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.text },
  statSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  bigCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  bigCardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  bigCardTitle: { fontSize: 15, fontWeight: fontWeight.semibold, color: colors.text },
  bigRow: { flexDirection: "row", gap: spacing.md },
  bigLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  bigValue: { fontSize: 20, fontWeight: fontWeight.black, color: colors.text },
  bigValueSmall: { fontSize: 17, fontWeight: fontWeight.bold, color: colors.text },
  bigSub: { fontSize: 11, color: colors.textMuted, marginTop: spacing.sm },
  quickRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  quickBtn: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  quickBtnText: { color: "#fff", fontWeight: fontWeight.bold, fontSize: 14 },
});
