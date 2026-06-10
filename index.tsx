import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "@/src/context/auth-context";
import { colors, radius, spacing, fontWeight } from "@/src/theme";
import { Logo } from "@/src/components/logo";

/* ===========================================================
 * Local dark palette for the marketing landing only.
 * The in-app experience remains on the light theme tokens.
 * ========================================================= */
const dark = {
  bg: "#0B2419",          // deep forest-olive
  bgAlt: "#102E22",       // section background
  card: "#143A2C",        // cards
  cardElevated: "#1A4534", // elevated cards (pricing highlight)
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.18)",
  text: "#F4F1E8",        // warm off-white
  textMuted: "rgba(244,241,232,0.68)",
  textDim: "rgba(244,241,232,0.45)",
  brand: "#3E8E5F",       // brighter green for dark BG
  brandSoft: "rgba(62,142,95,0.18)",
  accent: "#E07A5F",      // warmer terracotta
  accentSoft: "rgba(224,122,95,0.18)",
  gold: "#E0B260",
};

interface Feature {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  tint: string;
}

const FEATURES: Feature[] = [
  {
    icon: "file-text",
    title: "AI Expense Categorisation",
    description:
      "Snap or type an expense — Claude Sonnet tags it across 14 doctor-specific categories instantly.",
    tint: dark.brand,
  },
  {
    icon: "trending-up",
    title: "Loan, SIP & Tax Planning",
    description:
      "EMI, SIP, prepay-vs-invest simulator and side-by-side old vs new tax regime for FY 2025‑26.",
    tint: dark.accent,
  },
  {
    icon: "alert-triangle",
    title: "Hospital Revenue & Leakage",
    description:
      "Monthly OPD, IPD, Pharmacy & Lab tracking with automatic alerts for cash-flow leaks before they hurt.",
    tint: dark.gold,
  },
  {
    icon: "activity",
    title: "Productivity Tracking",
    description:
      "Patients per hour, revenue per patient and a 30-day trend — quietly logged, beautifully visualised.",
    tint: dark.brand,
  },
  {
    icon: "zap",
    title: "AI Finance Coach",
    description:
      "A chat coach that sees your real numbers and suggests next moves — tax savings, revenue lifts, leakage fixes.",
    tint: dark.accent,
  },
];

const STATS = [
  { value: "5", label: "Finance modules" },
  { value: "AI", label: "Powered insights" },
  { value: "₹", label: "Built for India" },
];

/* ===========================================================
 * Pricing
 * ========================================================= */
type Cycle = "monthly" | "annual";

interface Plan {
  id: string;
  name: string;
  tagline: string;
  monthly: number;       // ₹/mo
  annual: number;        // ₹/yr (≈ 2 months free vs monthly)
  highlight?: boolean;
  badge?: string;
  features: string[];
  cta: string;
}

const PLANS: Plan[] = [
  {
    id: "resident",
    name: "Resident",
    tagline: "For students & first-year residents.",
    monthly: 0,
    annual: 0,
    features: [
      "Expense tracking (manual)",
      "3 financial calculators",
      "1 AI coach chat / day",
      "Single-user dashboard",
    ],
    cta: "Start free",
  },
  {
    id: "practitioner",
    name: "Practitioner",
    tagline: "For consulting doctors building wealth.",
    monthly: 399,
    annual: 3999,
    highlight: true,
    badge: "Most popular",
    features: [
      "Everything in Resident",
      "AI expense categorisation",
      "Unlimited AI finance coach",
      "Prepay vs Invest simulator",
      "Old vs New tax regime planner",
      "Productivity tracking",
      "Email support",
    ],
    cta: "Start 14-day free trial",
  },
  {
    id: "hospital",
    name: "Hospital Pro",
    tagline: "For doctors running a practice.",
    monthly: 999,
    annual: 9999,
    features: [
      "Everything in Practitioner",
      "Hospital revenue & leakage alerts",
      "Multi-staff productivity logs",
      "Monthly P&L exports",
      "Priority WhatsApp support",
      "Dedicated onboarding call",
    ],
    cta: "Talk to us",
  },
];

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [showLanding, setShowLanding] = useState(false);
  const [cycle, setCycle] = useState<Cycle>("annual");

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/(tabs)/dashboard");
    else setShowLanding(true);
  }, [user, loading, router]);

  if (loading || (!showLanding && !user)) {
    return (
      <View style={styles.splash} testID="splash-screen">
        <ActivityIndicator size="large" color={dark.brand} />
      </View>
    );
  }
  if (user) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={dark.brand} />
      </View>
    );
  }

  const isWide = width >= 900;
  const isTablet = width >= 640 && width < 900;
  const featureCols = isWide ? 3 : isTablet ? 2 : 1;
  const featureWidth = `${(100 - 2 * (featureCols - 1)) / featureCols}%` as const;

  const priceCols = isWide ? 3 : 1;
  const priceWidth = `${(100 - 2 * (priceCols - 1)) / priceCols}%` as const;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
      testID="landing-page"
    >
      {/* Top nav */}
      <View style={[styles.nav, isWide && styles.navWide]}>
        <Logo size={36} variant="full" tone="light" />
        <View style={styles.navRight}>
          <TouchableOpacity onPress={() => router.push("/login")} testID="nav-signin">
            <Text style={styles.navLink}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navPrimary}
            onPress={() => router.push("/register")}
            testID="nav-getstarted"
          >
            <Text style={styles.navPrimaryText}>Get started</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero */}
      <View style={[styles.hero, isWide && styles.heroWide]}>
        <View style={[styles.heroText, isWide && { flex: 1, paddingRight: spacing.xl }]}>
          <View style={styles.pill}>
            <View style={styles.pillDot} />
            <Text style={styles.pillText}>Smart finance for young doctors</Text>
          </View>
          <Text style={[styles.heroTitle, isWide && { fontSize: 60, lineHeight: 64 }]}>
            Heal patients.{"\n"}
            <Text style={{ color: dark.accent }}>Grow wealth.</Text>
          </Text>
          <Text style={styles.heroSub}>
            DocFin is the personal CFO every young Indian doctor deserves — track expenses,
            plan loans and taxes, monitor your hospital, and chat with an AI coach. All in one
            calm, beautiful app.
          </Text>

          <View style={styles.heroCtas}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push("/register")}
              testID="hero-getstarted"
            >
              <Text style={styles.primaryBtnText}>Get started — it's free</Text>
              <Feather name="arrow-right" size={18} color={dark.bg} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/login")}
              testID="hero-signin"
            >
              <Text style={styles.secondaryBtnText}>Sign in</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.storesLabel}>DOWNLOAD THE APP</Text>
          <View style={styles.storesRow}>
            <StoreBadge platform="ios" />
            <StoreBadge platform="android" />
          </View>
        </View>

        {isWide && (
          <View style={styles.heroVisual}>
            <PhoneMock />
          </View>
        )}
      </View>

      {/* Stats strip */}
      <View style={[styles.stats, isWide && styles.statsWide]}>
        {STATS.map((s, i) => (
          <View
            key={s.label}
            style={[
              styles.statItem,
              i === STATS.length - 1 && { borderRightWidth: 0 },
            ]}
          >
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Features */}
      <View style={styles.section}>
        <Text style={styles.eyebrow}>WHAT'S INSIDE</Text>
        <Text style={[styles.sectionTitle, isWide && { fontSize: 42 }]}>
          Everything a busy doctor needs.{"\n"}Nothing they don't.
        </Text>
        <Text style={styles.sectionSub}>
          Five tightly-built modules, glued together by an AI coach that actually understands
          your numbers.
        </Text>

        <View style={[styles.featureGrid, { marginTop: spacing.xl }]}>
          {FEATURES.map((f) => (
            <View key={f.title} style={[styles.featureCard, { width: featureWidth as any }]}>
              <View style={[styles.featureIcon, { backgroundColor: alpha(f.tint, 0.18) }]}>
                <Feather name={f.icon} size={20} color={f.tint} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Pricing */}
      <View style={[styles.section, { backgroundColor: dark.bgAlt }]}>
        <Text style={styles.eyebrow}>PRICING</Text>
        <Text style={[styles.sectionTitle, isWide && { fontSize: 42 }]}>
          Simple, honest pricing.{"\n"}Cancel anytime.
        </Text>
        <Text style={styles.sectionSub}>
          Start free. Upgrade only when DocFin saves you more than it costs — which is usually
          inside the first month.
        </Text>

        {/* Cycle toggle */}
        <View style={styles.cycleRow}>
          <View style={styles.cycleToggle}>
            <CycleBtn
              label="Monthly"
              active={cycle === "monthly"}
              onPress={() => setCycle("monthly")}
            />
            <CycleBtn
              label="Annual"
              active={cycle === "annual"}
              onPress={() => setCycle("annual")}
              hint="Save 2 months"
            />
          </View>
        </View>

        <View style={[styles.priceGrid, { marginTop: spacing.lg }]}>
          {PLANS.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              cycle={cycle}
              width={priceWidth as any}
              onSelect={() => router.push("/register")}
            />
          ))}
        </View>

        <Text style={styles.priceFootnote}>
          Prices in ₹ INR · GST included · No credit card needed to start
        </Text>
      </View>

      {/* CTA banner */}
      <View style={[styles.cta, isWide && styles.ctaWide]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>Ready to take control of your finances?</Text>
          <Text style={styles.ctaSub}>
            Try DocFin in your browser today. Native iOS & Android coming soon.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => router.push("/register")}
          testID="cta-getstarted"
        >
          <Text style={styles.ctaBtnText}>Open DocFin</Text>
          <Feather name="arrow-right" size={18} color={dark.bg} style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Logo size={28} variant="full" tone="light" />
          <Text style={styles.footerTag}>Smart finance for young doctors.</Text>
        </View>
        <Text style={styles.footerCopy}>
          © {new Date().getFullYear()} DocFin · Made with care in India
        </Text>
      </View>
    </ScrollView>
  );
}

/* -------------------- Cycle toggle button -------------------- */
function CycleBtn({
  label,
  active,
  onPress,
  hint,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  hint?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.cycleBtn, active && styles.cycleBtnActive]}
      testID={`cycle-${label.toLowerCase()}`}
    >
      <Text style={[styles.cycleBtnText, active && styles.cycleBtnTextActive]}>{label}</Text>
      {hint ? (
        <View style={styles.cycleHint}>
          <Text style={styles.cycleHintText}>{hint}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/* -------------------- Plan card -------------------- */
function PlanCard({
  plan,
  cycle,
  width,
  onSelect,
}: {
  plan: Plan;
  cycle: Cycle;
  width: any;
  onSelect: () => void;
}) {
  const isFree = plan.monthly === 0;
  const amount = cycle === "monthly" ? plan.monthly : Math.round(plan.annual / 12);
  const billedNote = isFree
    ? "Forever free"
    : cycle === "monthly"
    ? "Billed monthly"
    : `Billed ₹${plan.annual.toLocaleString("en-IN")} / year`;

  return (
    <View
      style={[
        styles.planCard,
        { width },
        plan.highlight && styles.planCardHighlight,
      ]}
      testID={`plan-${plan.id}`}
    >
      {plan.badge ? (
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>{plan.badge}</Text>
        </View>
      ) : null}
      <Text style={[styles.planName, plan.highlight && { color: dark.text }]}>{plan.name}</Text>
      <Text style={styles.planTag}>{plan.tagline}</Text>

      <View style={styles.priceRow}>
        <Text style={[styles.priceCurrency, plan.highlight && { color: dark.text }]}>₹</Text>
        <Text style={[styles.priceAmount, plan.highlight && { color: dark.text }]}>
          {amount.toLocaleString("en-IN")}
        </Text>
        {!isFree && (
          <Text style={[styles.pricePer, plan.highlight && { color: dark.textMuted }]}>
            {" "}
            / mo
          </Text>
        )}
      </View>
      <Text style={styles.planBilled}>{billedNote}</Text>

      <View style={styles.planDivider} />

      <View style={{ gap: 10 }}>
        {plan.features.map((f) => (
          <View key={f} style={styles.featRow}>
            <View style={styles.checkDot}>
              <Feather name="check" size={11} color={dark.bg} />
            </View>
            <Text style={styles.featText}>{f}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={onSelect}
        style={[
          styles.planBtn,
          plan.highlight ? styles.planBtnHighlight : styles.planBtnGhost,
        ]}
        testID={`plan-cta-${plan.id}`}
      >
        <Text
          style={[
            styles.planBtnText,
            plan.highlight
              ? { color: dark.bg }
              : { color: dark.text },
          ]}
        >
          {plan.cta}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* -------------------- Store badges -------------------- */
function StoreBadge({ platform }: { platform: "ios" | "android" }) {
  const isIos = platform === "ios";
  return (
    <View style={styles.storeBadge} testID={`store-${platform}`}>
      <Feather
        name={isIos ? "smartphone" : "play"}
        size={22}
        color={dark.text}
        style={{ marginRight: 10 }}
      />
      <View>
        <Text style={styles.storeTop}>Coming soon on</Text>
        <Text style={styles.storeName}>{isIos ? "App Store" : "Google Play"}</Text>
      </View>
    </View>
  );
}

/* -------------------- Phone mock -------------------- */
function PhoneMock() {
  return (
    <View style={styles.phoneFrame}>
      <View style={styles.phoneNotch} />
      <View style={styles.phoneScreen}>
        <View style={styles.mockHeader}>
          <Text style={styles.mockGreet}>Good day,</Text>
          <Text style={styles.mockName}>Dr. Aarav</Text>
        </View>
        <View style={styles.mockBanner}>
          <Feather name="zap" size={16} color={colors.accent} />
          <Text style={styles.mockBannerText}>Ask your AI finance coach</Text>
        </View>
        <View style={styles.mockRow}>
          <MockTile icon="file-text" label="This month" value="₹50.7K" />
          <MockTile icon="credit-card" label="EMI" value="₹52.1K" />
        </View>
        <View style={styles.mockRow}>
          <MockTile icon="dollar-sign" label="Portfolio" value="₹2.84L" />
          <MockTile icon="trending-up" label="SIP" value="₹26.7K" />
        </View>
        <View style={styles.mockChart}>
          <Text style={styles.mockChartLabel}>Revenue trend</Text>
          <View style={styles.mockBars}>
            {[40, 65, 55, 80, 70, 90].map((h, i) => (
              <View key={i} style={[styles.mockBar, { height: h }]} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function MockTile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.mockTile}>
      <Feather name={icon} size={14} color={colors.brand} />
      <Text style={styles.mockTileLabel}>{label}</Text>
      <Text style={styles.mockTileValue}>{value}</Text>
    </View>
  );
}

/* -------------------- helpers -------------------- */
function alpha(hex: string, a: number) {
  // Accepts #RRGGBB only — converts to rgba()
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* -------------------- styles -------------------- */
const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: dark.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  page: { flex: 1, backgroundColor: dark.bg },
  pageContent: {
    paddingBottom: spacing.xxl,
    ...(Platform.OS === "web" ? { maxWidth: 1200, marginHorizontal: "auto" as any } : {}),
  },

  /* Nav */
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  navWide: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  navRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  navLink: {
    fontSize: 14,
    color: dark.textMuted,
    fontWeight: fontWeight.semibold,
  },
  navPrimary: {
    backgroundColor: dark.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  navPrimaryText: {
    color: dark.bg,
    fontSize: 13,
    fontWeight: fontWeight.bold,
  },

  /* Hero */
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heroWide: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  heroText: {},
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: dark.brandSoft,
    borderWidth: 1,
    borderColor: alpha("#3E8E5F", 0.35),
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    marginBottom: spacing.md,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: dark.brand,
    marginRight: 8,
  },
  pillText: {
    fontSize: 12,
    color: dark.text,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },
  heroTitle: {
    fontSize: 42,
    lineHeight: 46,
    color: dark.text,
    fontWeight: fontWeight.black,
    letterSpacing: -1.2,
    marginBottom: spacing.md,
  },
  heroSub: {
    fontSize: 16,
    lineHeight: 24,
    color: dark.textMuted,
    marginBottom: spacing.lg,
    maxWidth: 560,
  },
  heroCtas: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: spacing.xl,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: dark.text,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radius.full,
  },
  primaryBtnText: {
    color: dark.bg,
    fontSize: 15,
    fontWeight: fontWeight.bold,
  },
  secondaryBtn: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.borderStrong,
    backgroundColor: "transparent",
  },
  secondaryBtnText: {
    color: dark.text,
    fontSize: 15,
    fontWeight: fontWeight.bold,
  },
  storesLabel: {
    fontSize: 10,
    color: dark.textDim,
    fontWeight: fontWeight.bold,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  storesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  storeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: dark.card,
    borderWidth: 1,
    borderColor: dark.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    minWidth: 168,
  },
  storeTop: {
    color: dark.textDim,
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  storeName: {
    color: dark.text,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    marginTop: 1,
  },

  /* Hero visual / Phone mock */
  heroVisual: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneFrame: {
    width: 280,
    height: 560,
    backgroundColor: "#06150E",
    borderRadius: 38,
    padding: 8,
    borderWidth: 1,
    borderColor: dark.borderStrong,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 30px 80px rgba(0,0,0,0.5)" as any }
      : {}),
  },
  phoneNotch: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    left: 0,
    right: 0,
    height: 18,
    width: 100,
    marginHorizontal: "auto" as any,
    backgroundColor: "#06150E",
    borderRadius: 12,
    zIndex: 2,
  },
  phoneScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 30,
    padding: 16,
    overflow: "hidden",
  },
  mockHeader: { marginTop: 18, marginBottom: 14 },
  mockGreet: { fontSize: 10, color: colors.textMuted },
  mockName: {
    fontSize: 20,
    color: colors.text,
    fontWeight: fontWeight.black,
    letterSpacing: -0.4,
  },
  mockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.accentLight,
    padding: 10,
    borderRadius: radius.md,
    marginBottom: 12,
  },
  mockBannerText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  mockRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  mockTile: {
    flex: 1,
    backgroundColor: colors.card,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mockTileLabel: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 4,
  },
  mockTileValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: fontWeight.black,
    marginTop: 2,
  },
  mockChart: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  mockChartLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  mockBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 100,
    gap: 10,
  },
  mockBar: {
    flex: 1,
    backgroundColor: colors.brand,
    borderRadius: 3,
    opacity: 0.85,
  },

  /* Stats */
  stats: {
    flexDirection: "row",
    backgroundColor: dark.card,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: dark.border,
  },
  statsWide: { marginHorizontal: spacing.xl },
  statItem: {
    flex: 1,
    alignItems: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: dark.border,
  },
  statValue: {
    fontSize: 32,
    color: dark.text,
    fontWeight: fontWeight.black,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 11,
    color: dark.textMuted,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 4,
  },

  /* Sections */
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  eyebrow: {
    fontSize: 11,
    color: dark.accent,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 30,
    color: dark.text,
    fontWeight: fontWeight.black,
    letterSpacing: -1,
    marginBottom: spacing.sm,
    lineHeight: 36,
  },
  sectionSub: {
    fontSize: 15,
    color: dark.textMuted,
    lineHeight: 22,
    maxWidth: 600,
  },

  /* Feature cards */
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  featureCard: {
    backgroundColor: dark.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: dark.border,
    padding: spacing.md,
    minHeight: 170,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: dark.text,
    marginBottom: 6,
  },
  featureDesc: {
    fontSize: 13,
    color: dark.textMuted,
    lineHeight: 19,
  },

  /* Pricing */
  cycleRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: spacing.lg,
  },
  cycleToggle: {
    flexDirection: "row",
    backgroundColor: dark.card,
    borderRadius: radius.full,
    padding: 4,
    borderWidth: 1,
    borderColor: dark.border,
  },
  cycleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    gap: 8,
  },
  cycleBtnActive: {
    backgroundColor: dark.text,
  },
  cycleBtnText: {
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: dark.textMuted,
  },
  cycleBtnTextActive: {
    color: dark.bg,
  },
  cycleHint: {
    backgroundColor: dark.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  cycleHintText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: dark.accent,
    letterSpacing: 0.4,
  },
  priceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  planCard: {
    backgroundColor: dark.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: dark.border,
    padding: spacing.lg,
    minHeight: 480,
    position: "relative",
  },
  planCardHighlight: {
    backgroundColor: dark.cardElevated,
    borderColor: dark.brand,
    borderWidth: 2,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 20px 60px rgba(62,142,95,0.18)" as any }
      : {}),
  },
  planBadge: {
    position: "absolute",
    top: -12,
    left: spacing.lg,
    backgroundColor: dark.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  planBadgeText: {
    color: dark.bg,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  planName: {
    fontSize: 20,
    fontWeight: fontWeight.black,
    color: dark.text,
    letterSpacing: -0.4,
  },
  planTag: {
    fontSize: 13,
    color: dark.textMuted,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: spacing.sm,
  },
  priceCurrency: {
    fontSize: 22,
    color: dark.text,
    fontWeight: fontWeight.bold,
    marginRight: 2,
    marginBottom: 6,
  },
  priceAmount: {
    fontSize: 44,
    color: dark.text,
    fontWeight: fontWeight.black,
    letterSpacing: -2,
    lineHeight: 48,
  },
  pricePer: {
    fontSize: 14,
    color: dark.textMuted,
    fontWeight: fontWeight.semibold,
    marginBottom: 10,
  },
  planBilled: {
    fontSize: 12,
    color: dark.textDim,
    marginTop: 4,
  },
  planDivider: {
    height: 1,
    backgroundColor: dark.border,
    marginVertical: spacing.md,
  },
  featRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: dark.brand,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  featText: {
    flex: 1,
    fontSize: 13,
    color: dark.text,
    lineHeight: 19,
  },
  planBtn: {
    marginTop: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.full,
    alignItems: "center",
  },
  planBtnHighlight: {
    backgroundColor: dark.text,
  },
  planBtnGhost: {
    borderWidth: 1,
    borderColor: dark.borderStrong,
  },
  planBtnText: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
  },
  priceFootnote: {
    marginTop: spacing.lg,
    color: dark.textDim,
    fontSize: 12,
    textAlign: "center",
  },

  /* CTA banner */
  cta: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    backgroundColor: dark.brand,
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "column",
    gap: spacing.md,
  },
  ctaWide: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.xl,
    marginHorizontal: spacing.xl,
  },
  ctaTitle: {
    fontSize: 22,
    color: dark.text,
    fontWeight: fontWeight.black,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  ctaSub: {
    fontSize: 14,
    color: alpha("#F4F1E8", 0.85),
    lineHeight: 20,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: dark.text,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radius.full,
  },
  ctaBtnText: {
    color: dark.bg,
    fontSize: 15,
    fontWeight: fontWeight.bold,
  },

  /* Footer */
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: dark.border,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  footerLeft: { gap: 6 },
  footerTag: { fontSize: 12, color: dark.textMuted },
  footerCopy: { fontSize: 12, color: dark.textDim },
});
