import React, { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  ReceiptText,
  ChevronRight,
  Building2,
  Download,
  FileCheck,
} from "lucide-react-native";
import { ThemeConfig } from "../../constants/theme";
import { CollapsibleHeader } from "../../components/common/CollapsibleHeader";
import {
  PayslipDetailSheet,
  DetailedPayslip,
} from "../../components/payroll/PayslipDetailSheet";
import { useToastStore } from "../../stores/toastStore";

// Current Scheduled Pay (November 2026)
const CURRENT_MONTH_SLIP: DetailedPayslip = {
  id: "ps-2026-11",
  monthName: "November 2026",
  payDate: "Scheduled Nov 30",
  status: "Scheduled",
  currency: "MMK",
  grossEarnings: 3000000,
  totalDeductions: 150000,
  netPay: 2850000,
  bankName: "KBZ Bank",
  bankAccountMasked: "•••• •••• •••• 9241",
  attendanceMetrics: {
    workHours: 168.5,
    daysPresent: 21,
    onTimeRate: 98,
    lateArrivals: 2,
    unpaidLeaveDays: 1,
  },
  earnings: [
    {
      id: "e-1",
      name: "Basic Salary",
      amount: 2200000,
      category: "Earning",
      type: "base",
      note: "Contracted monthly base rate",
    },
    {
      id: "e-2",
      name: "Housing & Living Allowance",
      amount: 300000,
      category: "Earning",
      type: "allowance",
      note: "Fixed monthly allowance",
    },
    {
      id: "e-3",
      name: "Transport & Commute Allowance",
      amount: 150000,
      category: "Earning",
      type: "allowance",
      note: "Travel reimbursement",
    },
    {
      id: "e-4",
      name: "Meal & Daily Subsistence",
      amount: 100000,
      category: "Earning",
      type: "allowance",
      note: "Working days meal allowance",
    },
    {
      id: "e-5",
      name: "Performance Project Bonus",
      amount: 150000,
      category: "Earning",
      type: "bonus",
      note: "Q4 frontend milestone achievement",
    },
    {
      id: "e-6",
      name: "Overtime Compensation",
      amount: 100000,
      category: "Earning",
      type: "overtime",
      note: "10 hours logged @ 1.5x standard rate",
    },
  ],
  deductions: [
    {
      id: "d-1",
      name: "Late Check-in Fine",
      amount: 30000,
      category: "Deduction",
      type: "late_fine",
      note: "2 late check-ins beyond 09:30 AM grace period (@ 15,000 MMK)",
    },
    {
      id: "d-2",
      name: "Unpaid Leave Cut-off",
      amount: 70000,
      category: "Deduction",
      type: "unpaid_cut",
      note: "1 day unexcused absence salary deduction",
    },
    {
      id: "d-3",
      name: "Social Security (SSB) & Tax",
      amount: 50000,
      category: "Deduction",
      type: "tax",
      note: "Statutory labor contribution & withholding",
    },
  ],
};

// Historical Payslips by Year
const PAYSLIPS_2026: DetailedPayslip[] = [
  CURRENT_MONTH_SLIP,
  {
    id: "ps-2026-10",
    monthName: "October 2026",
    payDate: "Paid Oct 31",
    status: "Paid",
    currency: "MMK",
    grossEarnings: 2950000,
    totalDeductions: 100000,
    netPay: 2850000,
    bankName: "KBZ Bank",
    bankAccountMasked: "•••• •••• •••• 9241",
    attendanceMetrics: {
      workHours: 176,
      daysPresent: 22,
      onTimeRate: 100,
      lateArrivals: 0,
      unpaidLeaveDays: 0,
    },
    earnings: [
      { id: "pe-1", name: "Basic Salary", amount: 2200000, category: "Earning", type: "base" },
      { id: "pe-2", name: "Housing & Living Allowance", amount: 300000, category: "Earning", type: "allowance" },
      { id: "pe-3", name: "Transport Allowance", amount: 150000, category: "Earning", type: "allowance" },
      { id: "pe-4", name: "Meal Allowance", amount: 100000, category: "Earning", type: "allowance" },
      { id: "pe-5", name: "Performance Bonus", amount: 200000, category: "Earning", type: "bonus" },
    ],
    deductions: [
      { id: "pd-1", name: "Social Security (SSB) & Tax", amount: 100000, category: "Deduction", type: "tax" },
    ],
  },
  {
    id: "ps-2026-09",
    monthName: "September 2026",
    payDate: "Paid Sep 30",
    status: "Paid",
    currency: "MMK",
    grossEarnings: 2950000,
    totalDeductions: 100000,
    netPay: 2850000,
    bankName: "KBZ Bank",
    bankAccountMasked: "•••• •••• •••• 9241",
    attendanceMetrics: {
      workHours: 172,
      daysPresent: 21,
      onTimeRate: 100,
      lateArrivals: 0,
      unpaidLeaveDays: 0,
    },
    earnings: [
      { id: "se-1", name: "Basic Salary", amount: 2200000, category: "Earning", type: "base" },
      { id: "se-2", name: "Housing & Living Allowance", amount: 300000, category: "Earning", type: "allowance" },
      { id: "se-3", name: "Transport Allowance", amount: 150000, category: "Earning", type: "allowance" },
      { id: "se-4", name: "Meal Allowance", amount: 100000, category: "Earning", type: "allowance" },
      { id: "se-5", name: "Performance Bonus", amount: 200000, category: "Earning", type: "bonus" },
    ],
    deductions: [
      { id: "sd-1", name: "Social Security (SSB) & Tax", amount: 100000, category: "Deduction", type: "tax" },
    ],
  },
  {
    id: "ps-2026-08",
    monthName: "August 2026",
    payDate: "Paid Aug 31",
    status: "Paid",
    currency: "MMK",
    grossEarnings: 2800000,
    totalDeductions: 100000,
    netPay: 2700000,
    bankName: "KBZ Bank",
    bankAccountMasked: "•••• •••• •••• 9241",
    attendanceMetrics: {
      workHours: 168,
      daysPresent: 21,
      onTimeRate: 100,
      lateArrivals: 0,
      unpaidLeaveDays: 0,
    },
    earnings: [
      { id: "ae-1", name: "Basic Salary", amount: 2200000, category: "Earning", type: "base" },
      { id: "ae-2", name: "Housing & Living Allowance", amount: 300000, category: "Earning", type: "allowance" },
      { id: "ae-3", name: "Transport Allowance", amount: 150000, category: "Earning", type: "allowance" },
      { id: "ae-4", name: "Meal Allowance", amount: 100000, category: "Earning", type: "allowance" },
      { id: "ae-5", name: "Overtime Compensation", amount: 50000, category: "Earning", type: "overtime" },
    ],
    deductions: [
      { id: "ad-1", name: "Social Security (SSB) & Tax", amount: 100000, category: "Deduction", type: "tax" },
    ],
  },
];

const PAYSLIPS_2025: DetailedPayslip[] = [
  {
    id: "ps-2025-12",
    monthName: "December 2025",
    payDate: "Paid Dec 31",
    status: "Paid",
    currency: "MMK",
    grossEarnings: 3200000,
    totalDeductions: 120000,
    netPay: 3080000,
    bankName: "KBZ Bank",
    bankAccountMasked: "•••• •••• •••• 9241",
    attendanceMetrics: {
      workHours: 176,
      daysPresent: 22,
      onTimeRate: 100,
      lateArrivals: 0,
      unpaidLeaveDays: 0,
    },
    earnings: [
      { id: "25e-1", name: "Basic Salary", amount: 2000000, category: "Earning", type: "base" },
      { id: "25e-2", name: "Year-End Annual Bonus", amount: 600000, category: "Earning", type: "bonus" },
      { id: "25e-3", name: "Housing Allowance", amount: 300000, category: "Earning", type: "allowance" },
      { id: "25e-4", name: "Transport Allowance", amount: 150000, category: "Earning", type: "allowance" },
      { id: "25e-5", name: "Meal Allowance", amount: 150000, category: "Earning", type: "allowance" },
    ],
    deductions: [
      { id: "25d-1", name: "Social Security (SSB) & Tax", amount: 120000, category: "Deduction", type: "tax" },
    ],
  },
  {
    id: "ps-2025-11",
    monthName: "November 2025",
    payDate: "Paid Nov 30",
    status: "Paid",
    currency: "MMK",
    grossEarnings: 2750000,
    totalDeductions: 100000,
    netPay: 2650000,
    bankName: "KBZ Bank",
    bankAccountMasked: "•••• •••• •••• 9241",
    attendanceMetrics: {
      workHours: 168,
      daysPresent: 21,
      onTimeRate: 100,
      lateArrivals: 0,
      unpaidLeaveDays: 0,
    },
    earnings: [
      { id: "25e-6", name: "Basic Salary", amount: 2000000, category: "Earning", type: "base" },
      { id: "25e-7", name: "Housing Allowance", amount: 300000, category: "Earning", type: "allowance" },
      { id: "25e-8", name: "Transport Allowance", amount: 150000, category: "Earning", type: "allowance" },
      { id: "25e-9", name: "Meal Allowance", amount: 100000, category: "Earning", type: "allowance" },
      { id: "25e-10", name: "Overtime Compensation", amount: 200000, category: "Earning", type: "overtime" },
    ],
    deductions: [
      { id: "25d-2", name: "Social Security (SSB) & Tax", amount: 100000, category: "Deduction", type: "tax" },
    ],
  },
];

export default function PayrollScreen() {
  const scrollY = useSharedValue(0);
  const showToast = useToastStore((state) => state.showToast);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const [selectedYear, setSelectedYear] = useState<2026 | 2025>(2026);
  const [selectedPayslip, setSelectedPayslip] = useState<DetailedPayslip | null>(null);
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const handleOpenBreakdown = (slip: DetailedPayslip) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedPayslip(slip);
    setIsSheetVisible(true);
  };

  const handleYearChange = (year: 2026 | 2025) => {
    if (year === selectedYear) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    setSelectedYear(year);
  };

  const handleDownloadSlip = (slip: DetailedPayslip) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    showToast(`Downloaded ${slip.monthName} payslip statement`, "success");
  };

  const handleExportAnnualSummary = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    showToast(`Annual Tax & Pay Summary for ${selectedYear} exported`, "success");
  };

  const activeSlips = selectedYear === 2026 ? PAYSLIPS_2026 : PAYSLIPS_2025;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-surface-background">
      {/* 1. ANIMATED COLLAPSIBLE HEADER */}
      <CollapsibleHeader
        title="Payslips"
        subtitle="Official compensation statements & tax records"
        scrollY={scrollY}
      />

      {/* 2. SCROLLABLE BODY */}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 110,
          gap: 16,
        }}
      >
        {/* 2A. HERO STATEMENT CARD (Apple Card HIG Native Feel) */}
        <Pressable
          onPress={() => handleOpenBreakdown(CURRENT_MONTH_SLIP)}
          hitSlop={6}
          style={{ borderCurve: "continuous" }}
          className="bg-surface-card border border-surface-border rounded-3xl p-5 shadow-sm shadow-content-primary/5 gap-3.5 active:opacity-95"
          accessibilityRole="button"
          accessibilityLabel="Open latest salary and deductions breakdown"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-brand-primary-light items-center justify-center">
                <ReceiptText size={18} color={ThemeConfig.brand.primary} />
              </View>
              <View>
                <Text className="text-[11px] font-bold text-content-muted uppercase tracking-wider">
                  Latest Statement
                </Text>
                <Text className="text-sm font-extrabold text-content-primary">
                  November 2026
                </Text>
              </View>
            </View>

            {/* Status: Pure typographic indicator dot, strictly NO badge boxes */}
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-accent-sunshine shadow-xs" />
              <Text className="text-xs font-bold text-accent-sunshine-dark">
                Scheduled Nov 30
              </Text>
            </View>
          </View>

          <View className="pt-1">
            <Text className="text-xs font-medium text-content-muted">
              Take-Home Pay (Net)
            </Text>
            <Text className="text-3xl font-extrabold text-content-primary font-mono tracking-tight mt-0.5">
              2,850,000 MMK
            </Text>
          </View>

          <View className="flex-row items-center justify-between text-xs text-content-secondary">
            <Text className="text-xs text-content-secondary font-medium">
              Gross: 3,000,000 MMK · Deductions: -150,000 MMK
            </Text>
          </View>

          <View className="flex-row items-center justify-between pt-3 border-t border-surface-border">
            <View className="flex-row items-center gap-1.5">
              <Building2 size={13} color={ThemeConfig.content.secondary} />
              <Text className="text-xs font-medium text-content-secondary">
                KBZ Bank (•••• 9241)
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Text className="text-xs font-bold text-brand-primary">
                View Breakdown
              </Text>
              <ChevronRight size={14} color={ThemeConfig.brand.primary} />
            </View>
          </View>
        </Pressable>

        {/* 2B. YEAR-TO-DATE (YTD) SUMMARY METRIC STRIP */}
        <View
          style={{ borderCurve: "continuous" }}
          className="bg-surface-card border border-surface-border rounded-2xl p-4 flex-row items-center justify-between shadow-2xs"
        >
          <View className="flex-1 items-start">
            <Text className="text-[10px] uppercase font-bold text-content-muted tracking-wider">
              YTD Net Paid
            </Text>
            <Text className="text-xs font-bold text-content-primary font-mono mt-0.5">
              28,350,000 MMK
            </Text>
          </View>

          <View className="w-[1px] h-7 bg-surface-border mx-2" />

          <View className="flex-1 items-center">
            <Text className="text-[10px] uppercase font-bold text-content-muted tracking-wider">
              SSB & Tax
            </Text>
            <Text className="text-xs font-bold text-content-primary font-mono mt-0.5">
              1,450,000 MMK
            </Text>
          </View>

          <View className="w-[1px] h-7 bg-surface-border mx-2" />

          <View className="flex-1 items-end">
            <Text className="text-[10px] uppercase font-bold text-content-muted tracking-wider">
              Statements
            </Text>
            <Text className="text-xs font-bold text-content-primary font-mono mt-0.5">
              11 Months
            </Text>
          </View>
        </View>

        {/* 2C. YEAR SELECTOR FILTER */}
        <View className="flex-row items-center justify-between pt-1">
          <Text className="text-xs font-bold text-content-muted uppercase tracking-wider">
            Statement Year
          </Text>
          <View className="flex-row items-center gap-1.5 bg-surface-card p-1 rounded-full border border-surface-border">
            <Pressable
              onPress={() => handleYearChange(2026)}
              className={`px-3 py-1 rounded-full ${
                selectedYear === 2026 ? "bg-brand-primary" : "bg-transparent"
              }`}
              accessibilityRole="button"
              accessibilityLabel="Filter year 2026"
            >
              <Text
                className={`text-xs font-bold ${
                  selectedYear === 2026 ? "text-white" : "text-content-secondary"
                }`}
              >
                2026
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleYearChange(2025)}
              className={`px-3 py-1 rounded-full ${
                selectedYear === 2025 ? "bg-brand-primary" : "bg-transparent"
              }`}
              accessibilityRole="button"
              accessibilityLabel="Filter year 2025"
            >
              <Text
                className={`text-xs font-bold ${
                  selectedYear === 2025 ? "text-white" : "text-content-secondary"
                }`}
              >
                2025
              </Text>
            </Pressable>
          </View>
        </View>

        {/* 2D. GROUPED STATEMENT HISTORY (iOS Settings HIG Style) */}
        <View
          style={{ borderCurve: "continuous" }}
          className="bg-surface-card border border-surface-border rounded-3xl p-4 shadow-sm shadow-content-primary/5 gap-3"
        >
          <View className="flex-row items-center justify-between pb-1 border-b border-surface-border">
            <Text className="text-sm font-extrabold text-content-primary">
              Statement History
            </Text>
            <Text className="text-xs font-semibold text-content-muted">
              {activeSlips.length} {activeSlips.length === 1 ? "statement" : "statements"}
            </Text>
          </View>

          {activeSlips.map((slip, index) => {
            const isScheduled = slip.status === "Scheduled";
            return (
              <Pressable
                key={slip.id}
                onPress={() => handleOpenBreakdown(slip)}
                hitSlop={6}
                className={`flex-row items-center justify-between py-2.5 active:opacity-75 ${
                  index > 0 ? "border-t border-surface-border/60" : ""
                }`}
                accessibilityRole="button"
                accessibilityLabel={`View ${slip.monthName} payslip breakdown`}
              >
                <View className="gap-1 flex-1 pr-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-bold text-content-primary">
                      {slip.monthName}
                    </Text>
                    {/* Status: pure typographic text with dot, strictly NO badge boxes */}
                    <View className="flex-row items-center gap-1">
                      <View
                        className={`w-1.5 h-1.5 rounded-full ${
                          isScheduled ? "bg-accent-sunshine" : "bg-status-success"
                        }`}
                      />
                      <Text
                        className={`text-[11px] font-bold ${
                          isScheduled
                            ? "text-accent-sunshine-dark"
                            : "text-status-success"
                        }`}
                      >
                        {isScheduled ? "Scheduled" : "Paid"}
                      </Text>
                    </View>
                  </View>
                  <Text className="text-xs text-content-muted font-medium">
                    {slip.payDate} · {slip.bankName}
                  </Text>
                </View>

                <View className="flex-row items-center gap-2.5">
                  <Text className="text-sm font-extrabold font-mono text-content-primary">
                    {slip.netPay.toLocaleString("en-US")} MMK
                  </Text>
                  
                  {/* Quick download action button */}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDownloadSlip(slip);
                    }}
                    hitSlop={8}
                    className="w-8 h-8 rounded-full items-center justify-center bg-surface-background active:bg-surface-border"
                    accessibilityRole="button"
                    accessibilityLabel={`Download ${slip.monthName} payslip statement`}
                  >
                    <Download size={14} color={ThemeConfig.content.secondary} />
                  </Pressable>

                  <ChevronRight size={14} color={ThemeConfig.content.muted} />
                </View>
              </Pressable>
            );
          })}

          {/* Export Annual Summary Action */}
          <Pressable
            onPress={handleExportAnnualSummary}
            hitSlop={6}
            className="flex-row items-center justify-center gap-2 pt-3 mt-1 border-t border-surface-border active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel={`Export Annual Tax and Pay Summary for ${selectedYear}`}
          >
            <FileCheck size={14} color={ThemeConfig.brand.primary} />
            <Text className="text-xs font-bold text-brand-primary">
              Export Annual Tax Summary ({selectedYear})
            </Text>
          </Pressable>
        </View>
      </Animated.ScrollView>

      {/* 3. SALARY & DEDUCTIONS BREAKDOWN BOTTOM SHEET */}
      <PayslipDetailSheet
        visible={isSheetVisible}
        payslip={selectedPayslip}
        onClose={() => setIsSheetVisible(false)}
      />
    </SafeAreaView>
  );
}
