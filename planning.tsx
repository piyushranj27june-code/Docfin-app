import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calculator, FileText, PiggyBank, Scale } from "@/src/icons";

import { api } from "@/src/api";
import { colors, radius, spacing, fontWeight, formatINRFull, formatINR } from "@/src/theme";

type Tab = "loan" | "sip" | "tax" | "prepay";

interface EMIResult {
  emi: number;
  total_interest: number;
  total_payable: number;
}
interface SIPResult {
  future_value: number;
  invested: number;
  gain: number;
}
interface TaxResult {
  old_regime_tax: number;
  new_regime_tax: number;
  old_regime_taxable: number;
  new_regime_taxable: number;
  recommended: string;
  savings: number;
}
interface PrepayResult {
  emi: number;
  original_tenure_months: number;
  original_total_interest: number;
  prepay: {
    new_principal: number;
    new_tenure_months: number;
    months_saved: number;
    new_total_interest: number;
    interest_saved: number;
  };
  invest: {
    lump_sum: number;
    future_value: number;
    gain: number;
    horizon_months: number;
  };
  recommendation: string;
  net_benefit: number;
  break_even_return: number;
}
interface Loan {
  id: string;
  name: string;
  principal: number;
  rate: number;
  tenure_months: number;
}

export default function PlanningScreen() {
  const [tab, setTab] = useState<Tab>("loan");
  const [refreshing, setRefreshing] = useState(false);

  // Loan EMI
  const [principal, setPrincipal] = useState("4500000");
  const [rate, setRate] = useState("8.5");
  const [tenure, setTenure] = useState("240");
  const [emiResult, setEmiResult] = useState<EMIResult | null>(null);
  const [emiLoading, setEmiLoading] = useState(false);

  // SIP
  const [monthly, setMonthly] = useState("10000");
  const [years, setYears] = useState("15");
  const [sipRate, setSipRate] = useState("12");
  const [sipResult, setSipResult] = useState<SIPResult | null>(null);
  const [sipLoading, setSipLoading] = useState(false);

  // Tax
  const [income, setIncome] = useState("1800000");
  const [d80c, setD80c] = useState("150000");
  const [d80d, setD80d] = useState("25000");
  const [homeLoan, setHomeLoan] = useState("0");
  const [nps, setNps] = useState("50000");
  const [taxResult, setTaxResult] = useState<TaxResult | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);

  // Prepay vs Invest
  const [userLoans, setUserLoans] = useState<Loan[]>([]);
  const [prePrincipal, setPrePrincipal] = useState("4000000");
  const [preRate, setPreRate] = useState("8.5");
  const [preTenure, setPreTenure] = useState("220");
  const [preLumpSum, setPreLumpSum] = useState("500000");
  const [preInvestReturn, setPreInvestReturn] = useState("12");
  const [prepayResult, setPrepayResult] = useState<PrepayResult | null>(null);
  const [prepayLoading, setPrepayLoading] = useState(false);

  const calcPrepay = useCallback(async () => {
    setPrepayLoading(true);
    try {
      const res = await api<PrepayResult>("/planning/prepay-vs-invest", {
        method: "POST",
        body: {
          principal: parseFloat(prePrincipal) || 0,
          rate: parseFloat(preRate) || 0,
          tenure_months: parseInt(preTenure, 10) || 0,
          lump_sum: parseFloat(preLumpSum) || 0,
          invest_return: parseFloat(preInvestReturn) || 0,
        },
        auth: false,
      });
      setPrepayResult(res);
    } catch {
      setPrepayResult(null);
    } finally {
      setPrepayLoading(false);
    }
  }, [prePrincipal, preRate, preTenure, preLumpSum, preInvestReturn]);

  const selectLoan = (loan: Loan) => {
    setPrePrincipal(String(loan.principal));
    setPreRate(String(loan.rate));
    setPreTenure(String(loan.tenure_months));
  };

  const calcEMI = useCallback(async () => {
    setEmiLoading(true);
    try {
      const res = await api<EMIResult>("/loans/calculate", {
        method: "POST",
        body: {
          principal: parseFloat(principal) || 0,
          rate: parseFloat(rate) || 0,
          tenure_months: parseInt(tenure, 10) || 0,
        },
        auth: false,
      });
      setEmiResult(res);
    } catch {
      setEmiResult(null);
    } finally {
      setEmiLoading(false);
    }
  }, [principal, rate, tenure]);

  const calcSIP = useCallback(async () => {
    setSipLoading(true);
    try {
      const m = parseFloat(monthly) || 0;
      const y = parseInt(years, 10) || 0;
      const r = parseFloat(sipRate) || 0;
      const res = await api<SIPResult>(
        `/investments/sip-calc?monthly=${m}&years=${y}&rate=${r}`,
        { method: "POST", auth: false }
      );
      setSipResult(res);
    } catch {
      setSipResult(null);
    } finally {
      setSipLoading(false);
    }
  }, [monthly, years, sipRate]);

  const calcTax = useCallback(async () => {
    setTaxLoading(true);
    try {
      const res = await api<TaxResult>("/tax/calculate", {
        method: "POST",
        body: {
          gross_income: parseFloat(income) || 0,
          deduction_80c: parseFloat(d80c) || 0,
          deduction_80d: parseFloat(d80d) || 0,
          home_loan_interest: parseFloat(homeLoan) || 0,
          nps_80ccd1b: parseFloat(nps) || 0,
        },
        auth: false,
      });
      setTaxResult(res);
    } catch {
      setTaxResult(null);
    } finally {
      setTaxLoading(false);
    }
  }, [income, d80c, d80d, homeLoan, nps]);

  useEffect(() => {
    calcEMI();
    calcSIP();
    calcTax();
    calcPrepay();
    // Fetch user's loans for quick-select
    (async () => {
      try {
        const loans = await api<Loan[]>("/loans");
        setUserLoans(loans || []);
      } catch {
        // not logged in / no loans - silently ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([calcEMI(), calcSIP(), calcTax()]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Planning</Text>
        <Text style={styles.subtitle}>Loan · SIP · Tax · Prepay vs Invest</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label="Loan EMI"
          icon={<Calculator size={14} color={tab === "loan" ? "#fff" : colors.textMuted} />}
          active={tab === "loan"}
          onPress={() => setTab("loan")}
          testID="chip-loan"
        />
        <Chip
          label="SIP"
          icon={<PiggyBank size={14} color={tab === "sip" ? "#fff" : colors.textMuted} />}
          active={tab === "sip"}
          onPress={() => setTab("sip")}
          testID="chip-sip"
        />
        <Chip
          label="Tax (India)"
          icon={<FileText size={14} color={tab === "tax" ? "#fff" : colors.textMuted} />}
          active={tab === "tax"}
          onPress={() => setTab("tax")}
          testID="chip-tax"
        />
        <Chip
          label="Prepay vs Invest"
          icon={<Scale size={14} color={tab === "prepay" ? "#fff" : colors.textMuted} />}
          active={tab === "prepay"}
          onPress={() => setTab("prepay")}
          testID="chip-prepay"
        />
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {tab === "loan" && (
          <View testID="loan-section">
            <View style={styles.formCard}>
              <Field
                label="Principal (₹)"
                value={principal}
                onChange={setPrincipal}
                placeholder="4500000"
                testID="loan-principal-input"
              />
              <Field
                label="Interest Rate (% p.a.)"
                value={rate}
                onChange={setRate}
                placeholder="8.5"
                testID="loan-rate-input"
              />
              <Field
                label="Tenure (months)"
                value={tenure}
                onChange={setTenure}
                placeholder="240"
                testID="loan-tenure-input"
              />
              <TouchableOpacity
                testID="calculate-emi-button"
                style={styles.calcBtn}
                onPress={calcEMI}
                disabled={emiLoading}
                activeOpacity={0.85}
              >
                {emiLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.calcBtnText}>Calculate EMI</Text>
                )}
              </TouchableOpacity>
            </View>
            {emiResult && (
              <View style={styles.resultCard} testID="loan-result">
                <ResultRow label="Monthly EMI" value={formatINRFull(emiResult.emi)} big />
                <ResultRow label="Total Interest" value={formatINRFull(emiResult.total_interest)} />
                <ResultRow label="Total Payable" value={formatINRFull(emiResult.total_payable)} />
              </View>
            )}
          </View>
        )}

        {tab === "sip" && (
          <View testID="sip-section">
            <View style={styles.formCard}>
              <Field label="Monthly Investment (₹)" value={monthly} onChange={setMonthly} testID="sip-monthly-input" />
              <Field label="Duration (years)" value={years} onChange={setYears} testID="sip-years-input" />
              <Field label="Expected Return (%)" value={sipRate} onChange={setSipRate} testID="sip-rate-input" />
              <TouchableOpacity
                testID="calculate-sip-button"
                style={styles.calcBtn}
                onPress={calcSIP}
                disabled={sipLoading}
                activeOpacity={0.85}
              >
                {sipLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.calcBtnText}>Project Wealth</Text>
                )}
              </TouchableOpacity>
            </View>
            {sipResult && (
              <View style={styles.resultCard} testID="sip-result">
                <ResultRow label="Future Value" value={formatINRFull(sipResult.future_value)} big />
                <ResultRow label="Total Invested" value={formatINRFull(sipResult.invested)} />
                <ResultRow
                  label="Wealth Gained"
                  value={formatINRFull(sipResult.gain)}
                  highlight
                />
              </View>
            )}
          </View>
        )}

        {tab === "tax" && (
          <View testID="tax-section">
            <View style={styles.formCard}>
              <Field label="Gross Annual Income (₹)" value={income} onChange={setIncome} testID="tax-income-input" />
              <Field label="80C (PF, ELSS, LIC...)" value={d80c} onChange={setD80c} testID="tax-80c-input" />
              <Field label="80D (Health Insurance)" value={d80d} onChange={setD80d} testID="tax-80d-input" />
              <Field label="Home Loan Interest (24b)" value={homeLoan} onChange={setHomeLoan} testID="tax-homeloan-input" />
              <Field label="NPS 80CCD(1B)" value={nps} onChange={setNps} testID="tax-nps-input" />
              <TouchableOpacity
                testID="calculate-tax-button"
                style={styles.calcBtn}
                onPress={calcTax}
                disabled={taxLoading}
                activeOpacity={0.85}
              >
                {taxLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.calcBtnText}>Compare Regimes</Text>
                )}
              </TouchableOpacity>
            </View>
            {taxResult && (
              <View style={styles.resultCard} testID="tax-result">
                <View style={styles.regimeRow}>
                  <View
                    style={[
                      styles.regimeBox,
                      taxResult.recommended === "Old Regime" && styles.regimeActive,
                    ]}
                  >
                    <Text style={styles.regimeLabel}>Old Regime</Text>
                    <Text style={styles.regimeAmount}>{formatINR(taxResult.old_regime_tax)}</Text>
                    <Text style={styles.regimeSub}>
                      Taxable: {formatINR(taxResult.old_regime_taxable)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.regimeBox,
                      taxResult.recommended === "New Regime" && styles.regimeActive,
                    ]}
                  >
                    <Text style={styles.regimeLabel}>New Regime</Text>
                    <Text style={styles.regimeAmount}>{formatINR(taxResult.new_regime_tax)}</Text>
                    <Text style={styles.regimeSub}>
                      Taxable: {formatINR(taxResult.new_regime_taxable)}
                    </Text>
                  </View>
                </View>
                <View style={styles.recommendBox}>
                  <Text style={styles.recommendTitle}>
                    ✓ {taxResult.recommended} saves you
                  </Text>
                  <Text style={styles.recommendAmount}>
                    {formatINRFull(taxResult.savings)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {tab === "prepay" && (
          <View testID="prepay-section">
            {userLoans.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={styles.helperLabel}>Quick-select from your loans</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: spacing.md }}>
                  {userLoans.map((l) => (
                    <TouchableOpacity
                      key={l.id}
                      testID={`prepay-loan-${l.id}`}
                      onPress={() => selectLoan(l)}
                      activeOpacity={0.85}
                      style={styles.loanPill}
                    >
                      <Text style={styles.loanPillName}>{l.name}</Text>
                      <Text style={styles.loanPillMeta}>
                        {formatINR(l.principal)} · {l.rate}% · {l.tenure_months}mo
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.formCard}>
              <Field
                label="Remaining Principal (₹)"
                value={prePrincipal}
                onChange={setPrePrincipal}
                testID="prepay-principal-input"
              />
              <Field
                label="Loan Rate (% p.a.)"
                value={preRate}
                onChange={setPreRate}
                testID="prepay-rate-input"
              />
              <Field
                label="Remaining Tenure (months)"
                value={preTenure}
                onChange={setPreTenure}
                testID="prepay-tenure-input"
              />
              <Field
                label="Lump Sum Available (₹)"
                value={preLumpSum}
                onChange={setPreLumpSum}
                testID="prepay-lumpsum-input"
              />
              <Field
                label="Expected Investment Return (% p.a.)"
                value={preInvestReturn}
                onChange={setPreInvestReturn}
                testID="prepay-return-input"
              />
              <TouchableOpacity
                testID="calculate-prepay-button"
                style={styles.calcBtn}
                onPress={calcPrepay}
                disabled={prepayLoading}
                activeOpacity={0.85}
              >
                {prepayLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.calcBtnText}>Compare Scenarios</Text>
                )}
              </TouchableOpacity>
            </View>

            {prepayResult && (
              <View style={styles.resultCard} testID="prepay-result">
                <View style={styles.regimeRow}>
                  <View
                    style={[
                      styles.regimeBox,
                      prepayResult.recommendation === "Prepay" && styles.regimeActive,
                    ]}
                    testID="prepay-scenario"
                  >
                    <Text style={styles.regimeLabel}>Prepay Loan</Text>
                    <Text style={styles.regimeAmount}>
                      {formatINR(prepayResult.prepay.interest_saved)}
                    </Text>
                    <Text style={styles.regimeSub}>Interest saved</Text>
                    <Text style={[styles.regimeSub, { marginTop: 4 }]}>
                      Loan ends {prepayResult.prepay.months_saved} months earlier
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.regimeBox,
                      prepayResult.recommendation === "Invest" && styles.regimeActive,
                    ]}
                    testID="invest-scenario"
                  >
                    <Text style={styles.regimeLabel}>Invest Lump Sum</Text>
                    <Text style={styles.regimeAmount}>
                      {formatINR(prepayResult.invest.gain)}
                    </Text>
                    <Text style={styles.regimeSub}>Wealth gained</Text>
                    <Text style={[styles.regimeSub, { marginTop: 4 }]}>
                      FV: {formatINR(prepayResult.invest.future_value)}
                    </Text>
                  </View>
                </View>

                <View style={styles.recommendBox}>
                  <Text style={styles.recommendTitle}>
                    ✓ {prepayResult.recommendation} wins by
                  </Text>
                  <Text style={styles.recommendAmount}>
                    {formatINRFull(prepayResult.net_benefit)}
                  </Text>
                </View>

                <View style={styles.breakEvenBox} testID="prepay-breakeven">
                  <Text style={styles.breakEvenLabel}>Break-even investment return</Text>
                  <Text style={styles.breakEvenValue}>
                    {prepayResult.break_even_return.toFixed(2)}%
                  </Text>
                  <Text style={styles.breakEvenHint}>
                    Earn more than this (post-tax) and investing beats prepaying.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testID?: string;
}) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
        style={styles.input}
      />
    </View>
  );
}

function ResultRow({
  label,
  value,
  big,
  highlight,
}: {
  label: string;
  value: string;
  big?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text
        style={[
          styles.resultValue,
          big && { fontSize: 22 },
          highlight && { color: colors.success },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: 26, fontWeight: fontWeight.black, color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chips: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 10,
  },
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
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  fieldLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  calcBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  calcBtnText: { color: "#fff", fontSize: 15, fontWeight: fontWeight.bold },
  resultCard: {
    backgroundColor: colors.brandLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(26,67,49,0.15)",
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  resultLabel: { fontSize: 13, color: colors.textMuted, fontWeight: fontWeight.medium },
  resultValue: { fontSize: 16, fontWeight: fontWeight.bold, color: colors.text },
  regimeRow: { flexDirection: "row", gap: spacing.sm },
  regimeBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  regimeActive: {
    borderColor: colors.success,
    backgroundColor: "#F1F8E9",
  },
  regimeLabel: { fontSize: 11, color: colors.textMuted, fontWeight: fontWeight.semibold },
  regimeAmount: {
    fontSize: 18,
    fontWeight: fontWeight.black,
    color: colors.text,
    marginTop: 4,
  },
  regimeSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  recommendBox: {
    marginTop: spacing.md,
    backgroundColor: colors.brand,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  recommendTitle: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: fontWeight.semibold },
  recommendAmount: { color: "#fff", fontSize: 22, fontWeight: fontWeight.black, marginTop: 4 },
  helperLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  loanPill: {
    flexShrink: 0,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  loanPillName: { fontSize: 13, fontWeight: fontWeight.bold, color: colors.text },
  loanPillMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  breakEvenBox: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  breakEvenLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  breakEvenValue: {
    fontSize: 26,
    fontWeight: fontWeight.black,
    color: colors.accent,
    marginTop: 4,
  },
  breakEvenHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: "center",
  },
});
