import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertTriangle, Plus, X, Building2, Activity } from "@/src/icons";

import { api } from "@/src/api";
import { colors, radius, spacing, fontWeight, formatINR, formatINRFull } from "@/src/theme";
import { TrendChart } from "@/src/components/trend-chart";

type Tab = "revenue" | "productivity";

interface Revenue {
  id: string;
  month: string;
  opd_revenue: number;
  ipd_revenue: number;
  pharmacy_revenue: number;
  lab_revenue: number;
  other_revenue: number;
  operating_costs: number;
  staff_costs: number;
  total_revenue: number;
  net_cashflow: number;
}

interface Productivity {
  id: string;
  date: string;
  patients_seen: number;
  hours_worked: number;
  revenue_generated: number;
  patients_per_hour: number;
  revenue_per_patient: number;
}

interface ProductivityStats {
  total_patients: number;
  total_hours: number;
  total_revenue: number;
  avg_pph: number;
  avg_rpp: number;
  days_logged: number;
}

interface LeakageAlert {
  month: string;
  type: string;
  severity: string;
  message: string;
}

export default function HospitalScreen() {
  const [tab, setTab] = useState<Tab>("revenue");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [revenue, setRevenue] = useState<Revenue[]>([]);
  const [alerts, setAlerts] = useState<LeakageAlert[]>([]);
  const [productivity, setProductivity] = useState<Productivity[]>([]);
  const [prodStats, setProdStats] = useState<ProductivityStats | null>(null);

  const [showAddRev, setShowAddRev] = useState(false);
  const [showAddProd, setShowAddProd] = useState(false);

  const load = useCallback(async () => {
    try {
      const [rev, lk, prod, ps] = await Promise.all([
        api<Revenue[]>("/hospital/revenue"),
        api<{ alerts: LeakageAlert[] }>("/hospital/leakage"),
        api<Productivity[]>("/productivity"),
        api<ProductivityStats>("/productivity/stats"),
      ]);
      setRevenue(rev);
      setAlerts(lk.alerts || []);
      setProductivity(prod);
      setProdStats(ps);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ActivityIndicator style={{ marginTop: 100 }} color={colors.brand} size="large" />
      </SafeAreaView>
    );
  }

  const maxRev = Math.max(...revenue.map((r) => r.total_revenue), 1);

  // Sort revenue ascending by month for trend chart (last 12 months max).
  const trendData = [...revenue]
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
  const trendLabels = trendData.map((r) => r.month);
  const trendRevenue = trendData.map((r) => r.total_revenue);
  const trendCashflow = trendData.map((r) => r.net_cashflow);
  const trendCosts = trendData.map((r) => (r.total_revenue - r.net_cashflow));

  // Productivity trend (last 30 days, ascending by date).
  const prodTrend = [...productivity]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
  const prodLabels = prodTrend.map((p) => p.date);
  const prodRevSeries = prodTrend.map((p) => p.revenue_generated);
  const prodPatientsSeries = prodTrend.map((p) => p.patients_seen);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Hospital</Text>
          <Text style={styles.subtitle}>Revenue · Leakage · Productivity</Text>
        </View>
        <TouchableOpacity
          testID="add-hospital-fab"
          style={styles.fab}
          onPress={() => (tab === "revenue" ? setShowAddRev(true) : setShowAddProd(true))}
        >
          <Plus size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label="Revenue & Leakage"
          icon={<Building2 size={14} color={tab === "revenue" ? "#fff" : colors.textMuted} />}
          active={tab === "revenue"}
          onPress={() => setTab("revenue")}
          testID="chip-revenue"
        />
        <Chip
          label="Productivity"
          icon={<Activity size={14} color={tab === "productivity" ? "#fff" : colors.textMuted} />}
          active={tab === "productivity"}
          onPress={() => setTab("productivity")}
          testID="chip-productivity"
        />
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        testID="hospital-scroll"
      >
        {tab === "revenue" && (
          <View testID="revenue-section">
            {trendData.length >= 2 && (
              <TrendChart
                title="Revenue vs Cash Flow"
                subtitle={`${trendData.length}-month trend`}
                labels={trendLabels}
                series={[
                  {
                    label: "Revenue",
                    color: colors.brand,
                    values: trendRevenue,
                    showArea: true,
                  },
                  {
                    label: "Net Cashflow",
                    color: colors.accent,
                    values: trendCashflow,
                  },
                  {
                    label: "Costs",
                    color: colors.warning,
                    values: trendCosts,
                  },
                ]}
              />
            )}

            {alerts.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Leakage Alerts ({alerts.length})</Text>
                {alerts.map((a, i) => (
                  <View
                    key={i}
                    style={[
                      styles.alertCard,
                      a.severity === "high" ? styles.alertHigh : styles.alertMed,
                    ]}
                    testID={`alert-${i}`}
                  >
                    <AlertTriangle
                      size={18}
                      color={a.severity === "high" ? colors.error : colors.warning}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.sm }}>
                      <Text style={styles.alertTitle}>
                        {a.type} · {a.month}
                      </Text>
                      <Text style={styles.alertMsg}>{a.message}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.sectionLabel}>Monthly Revenue ({revenue.length})</Text>
            {revenue.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  Add monthly revenue to track cash flow and detect leakage.
                </Text>
              </View>
            ) : (
              revenue.map((r) => (
                <View key={r.id} style={styles.revCard} testID={`revenue-${r.month}`}>
                  <View style={styles.revHead}>
                    <Text style={styles.revMonth}>{r.month}</Text>
                    <Text style={styles.revTotal}>{formatINRFull(r.total_revenue)}</Text>
                  </View>
                  <View style={styles.barWrap}>
                    <View
                      style={[
                        styles.bar,
                        { width: `${(r.total_revenue / maxRev) * 100}%` },
                      ]}
                    />
                  </View>
                  <View style={styles.revBreakdown}>
                    <BreakItem label="OPD" value={formatINR(r.opd_revenue)} />
                    <BreakItem label="IPD" value={formatINR(r.ipd_revenue)} />
                    <BreakItem label="Pharmacy" value={formatINR(r.pharmacy_revenue)} />
                    <BreakItem label="Lab" value={formatINR(r.lab_revenue)} />
                  </View>
                  <View style={[styles.revFoot, r.net_cashflow < 0 && { backgroundColor: "#FDECEA" }]}>
                    <Text style={styles.revFootLabel}>Net Cashflow</Text>
                    <Text
                      style={[
                        styles.revFootValue,
                        { color: r.net_cashflow >= 0 ? colors.success : colors.error },
                      ]}
                    >
                      {formatINRFull(r.net_cashflow)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === "productivity" && (
          <View testID="productivity-section">
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>
                {prodStats?.days_logged || 0} days · {prodStats?.total_patients || 0} patients
              </Text>
              <View style={styles.statsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsLabel}>Patients/hour</Text>
                  <Text style={styles.statsValue}>{prodStats?.avg_pph || 0}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsLabel}>Revenue/patient</Text>
                  <Text style={styles.statsValue}>{formatINR(prodStats?.avg_rpp || 0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statsLabel}>Total Rev</Text>
                  <Text style={styles.statsValue}>{formatINR(prodStats?.total_revenue || 0)}</Text>
                </View>
              </View>
            </View>

            {prodTrend.length >= 2 && (
              <View style={{ marginTop: spacing.md }}>
                <TrendChart
                  title="Daily Revenue Trend"
                  subtitle={`Last ${prodTrend.length} working days`}
                  labels={prodLabels}
                  series={[
                    {
                      label: "Revenue",
                      color: colors.brand,
                      values: prodRevSeries,
                      showArea: true,
                    },
                  ]}
                />
                <TrendChart
                  title="Patients Seen"
                  subtitle={`Last ${prodTrend.length} working days`}
                  labels={prodLabels}
                  formatY={(n) => `${Math.round(n)}`}
                  series={[
                    {
                      label: "Patients",
                      color: colors.accent,
                      values: prodPatientsSeries,
                      showArea: true,
                    },
                  ]}
                />
              </View>
            )}

            <Text style={styles.sectionLabel}>Daily Log</Text>
            {productivity.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Log your daily patients & hours to track productivity.</Text>
              </View>
            ) : (
              productivity.map((p) => (
                <View key={p.id} style={styles.prodCard} testID={`prod-${p.date}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodDate}>{p.date}</Text>
                    <Text style={styles.prodMeta}>
                      {p.patients_seen} patients · {p.hours_worked}h · {p.patients_per_hour}/hr
                    </Text>
                  </View>
                  <Text style={styles.prodRev}>{formatINR(p.revenue_generated)}</Text>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      <AddRevenueModal visible={showAddRev} onClose={() => setShowAddRev(false)} onSaved={load} />
      <AddProductivityModal
        visible={showAddProd}
        onClose={() => setShowAddProd(false)}
        onSaved={load}
      />
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
  icon,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.chip, active && styles.chipActive]}
    >
      {icon}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BreakItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.breakLabel}>{label}</Text>
      <Text style={styles.breakValue}>{value}</Text>
    </View>
  );
}

function AddRevenueModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [opd, setOpd] = useState("");
  const [ipd, setIpd] = useState("");
  const [pharm, setPharm] = useState("");
  const [lab, setLab] = useState("");
  const [opCost, setOpCost] = useState("");
  const [staffCost, setStaffCost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!month) {
      setError("Month required");
      return;
    }
    setSubmitting(true);
    try {
      await api("/hospital/revenue", {
        method: "POST",
        body: {
          month,
          opd_revenue: parseFloat(opd) || 0,
          ipd_revenue: parseFloat(ipd) || 0,
          pharmacy_revenue: parseFloat(pharm) || 0,
          lab_revenue: parseFloat(lab) || 0,
          other_revenue: 0,
          operating_costs: parseFloat(opCost) || 0,
          staff_costs: parseFloat(staffCost) || 0,
        },
      });
      setOpd(""); setIpd(""); setPharm(""); setLab(""); setOpCost(""); setStaffCost("");
      onClose();
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalWrap}
      >
        <View style={styles.modalCard} testID="add-revenue-modal">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Monthly Revenue</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} testID="close-revenue-modal">
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <ModalField label="Month (YYYY-MM)" value={month} onChange={setMonth} testID="rev-month" keyboardType="default" />
            <ModalField label="OPD Revenue (₹)" value={opd} onChange={setOpd} testID="rev-opd" />
            <ModalField label="IPD Revenue (₹)" value={ipd} onChange={setIpd} testID="rev-ipd" />
            <ModalField label="Pharmacy Revenue (₹)" value={pharm} onChange={setPharm} testID="rev-pharm" />
            <ModalField label="Lab Revenue (₹)" value={lab} onChange={setLab} testID="rev-lab" />
            <ModalField label="Operating Costs (₹)" value={opCost} onChange={setOpCost} testID="rev-opcost" />
            <ModalField label="Staff Costs (₹)" value={staffCost} onChange={setStaffCost} testID="rev-staffcost" />
          </ScrollView>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity
            testID="submit-revenue-button"
            style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Revenue</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AddProductivityModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [patients, setPatients] = useState("");
  const [hours, setHours] = useState("");
  const [rev, setRev] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!date) {
      setError("Date required");
      return;
    }
    setSubmitting(true);
    try {
      await api("/productivity", {
        method: "POST",
        body: {
          date,
          patients_seen: parseInt(patients, 10) || 0,
          hours_worked: parseFloat(hours) || 0,
          revenue_generated: parseFloat(rev) || 0,
        },
      });
      setPatients(""); setHours(""); setRev("");
      onClose();
      onSaved();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalWrap}
      >
        <View style={styles.modalCard} testID="add-productivity-modal">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Log Productivity</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8} testID="close-productivity-modal">
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ModalField label="Date (YYYY-MM-DD)" value={date} onChange={setDate} testID="prod-date" keyboardType="default" />
          <ModalField label="Patients Seen" value={patients} onChange={setPatients} testID="prod-patients" />
          <ModalField label="Hours Worked" value={hours} onChange={setHours} testID="prod-hours" />
          <ModalField label="Revenue Generated (₹)" value={rev} onChange={setRev} testID="prod-revenue" />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TouchableOpacity
            testID="submit-productivity-button"
            style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Save Entry</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModalField({
  label,
  value,
  onChange,
  testID,
  keyboardType = "numeric",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testID?: string;
  keyboardType?: "numeric" | "default";
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType === "numeric" ? "numeric" : "default"}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: "center",
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
  chips: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 10 },
  chip: {
    height: 36,
    flexShrink: 0,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, color: colors.textMuted, fontWeight: fontWeight.semibold },
  chipTextActive: { color: "#fff" },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  sectionLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  alertCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    marginBottom: spacing.sm,
    alignItems: "flex-start",
  },
  alertHigh: { borderLeftColor: colors.error },
  alertMed: { borderLeftColor: colors.warning },
  alertTitle: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.text },
  alertMsg: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  revCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  revHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  revMonth: { fontSize: 14, fontWeight: fontWeight.bold, color: colors.text },
  revTotal: { fontSize: 16, fontWeight: fontWeight.black, color: colors.brand },
  barWrap: {
    height: 6,
    backgroundColor: colors.bgSecondary,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  bar: { height: 6, backgroundColor: colors.brand, borderRadius: 3 },
  revBreakdown: { flexDirection: "row", gap: spacing.sm },
  breakLabel: { fontSize: 10, color: colors.textMuted, textTransform: "uppercase" },
  breakValue: { fontSize: 12, fontWeight: fontWeight.semibold, color: colors.text, marginTop: 2 },
  revFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    backgroundColor: colors.brandLight,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  revFootLabel: { fontSize: 11, color: colors.textMuted, fontWeight: fontWeight.semibold },
  revFootValue: { fontSize: 14, fontWeight: fontWeight.bold },
  statsCard: {
    backgroundColor: colors.brand,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  statsTitle: { fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: spacing.md },
  statsRow: { flexDirection: "row", gap: spacing.md },
  statsLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: fontWeight.semibold,
  },
  statsValue: { fontSize: 18, fontWeight: fontWeight.black, color: "#fff", marginTop: 2 },
  prodCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: "center",
  },
  prodDate: { fontSize: 13, fontWeight: fontWeight.semibold, color: colors.text },
  prodMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  prodRev: { fontSize: 14, fontWeight: fontWeight.bold, color: colors.brand },
  empty: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.bg,
    padding: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xxl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: 20, fontWeight: fontWeight.bold, color: colors.text },
  fieldLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  errorText: { color: colors.error, fontSize: 13, marginTop: spacing.sm, textAlign: "center" },
  primaryBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.md,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: fontWeight.bold },
});
