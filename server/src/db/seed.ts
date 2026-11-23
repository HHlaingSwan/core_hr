import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import { config } from "../config/index";
import * as schema from "./schema/index";

async function seed() {
  const client = postgres(config.databaseUrl, {
    max: 1,
  });
  const db = drizzle(client, { schema });

  console.log("Seeding Omni-HR local PostgreSQL database...");

  // 1. Clear existing seed data safely in order of foreign key dependencies
  await db.delete(schema.announcementReads);
  await db.delete(schema.announcements);
  await db.delete(schema.payslipItems);
  await db.delete(schema.payslips);
  await db.delete(schema.payRuns);
  await db.delete(schema.employeeLoans);
  await db.delete(schema.leaveAuditLogs);
  await db.delete(schema.leaveRequests);
  await db.delete(schema.leaveBalances);
  await db.delete(schema.publicHolidays);
  await db.delete(schema.attendancePunches);
  await db.delete(schema.attendanceRecords);
  await db.delete(schema.shiftAssignments);
  await db.delete(schema.shifts);
  await db.delete(schema.refreshTokens);
  await db.delete(schema.users);
  await db.delete(schema.officeLocations);
  await db.delete(schema.departments);
  await db.delete(schema.organizations);

  // 2. Insert Organization (Multi-tenant Root)
  const [acmeOrg] = await db
    .insert(schema.organizations)
    .values({
      name: "Acme Corporation Myanmar Ltd.",
      code: "ACME-MM",
      currency: "MMK",
      taxId: "TAX-MM-9872134",
      phone: "+95 1 230 4567",
      address: "Silicon Tower, Level 4, Kabar Aye Pagoda Road, Bahan, Yangon",
    })
    .returning();

  console.log(`✓ Organization created: ${acmeOrg.name} (${acmeOrg.code})`);

  // 3. Insert Multiple Office Locations (4 Facilities)
  // Office 1: Yangon HQ - M Tower
  const [yangonHq] = await db
    .insert(schema.officeLocations)
    .values({
      orgId: acmeOrg.id,
      name: "Yangon HQ - M Tower",
      code: "YGN-HQ",
      latitude: "16.8236000",
      longitude: "96.1309000",
      radiusMeters: 300,
      address: "M Tower, 381 Pyay Road, Kamayut Township, Yangon",
      isActive: true,
    })
    .returning();

  // Office 2: Mandalay Office - 73rd Street
  const [mandalayBranch] = await db
    .insert(schema.officeLocations)
    .values({
      orgId: acmeOrg.id,
      name: "Mandalay Office - 73rd Street Tech Center",
      code: "MDY-01",
      latitude: "21.9750000",
      longitude: "96.0836000",
      radiusMeters: 250,
      address: "73rd Street (between 30th & 31st Street), Chanayethazan, Mandalay",
      isActive: true,
    })
    .returning();

  // Office 3: Naypyitaw Call Center - Railway Station Hub
  const [naypyitawCallCenter] = await db
    .insert(schema.officeLocations)
    .values({
      orgId: acmeOrg.id,
      name: "Naypyitaw Call Center - Railway Station Hub",
      code: "NPT-CC",
      latitude: "19.8355000",
      longitude: "96.1965000",
      radiusMeters: 300,
      address: "Near Naypyitaw Central Railway Station, Pobbathiri, Naypyitaw",
      isActive: true,
    })
    .returning();

  // Office 4: Operation & Development Office - Near Ocean Supercenter
  const [oceanOpsDev] = await db
    .insert(schema.officeLocations)
    .values({
      orgId: acmeOrg.id,
      name: "Operation & Development Office - Near Ocean Supercenter",
      code: "OPS-DEV",
      latitude: "16.8720000",
      longitude: "96.1265000",
      radiusMeters: 250,
      address: "Near Ocean Supercenter Commercial Complex, Pyay Road, Mayangone, Yangon",
      isActive: true,
    })
    .returning();

  console.log(`✓ 4 Offices created: ${yangonHq.name}, ${mandalayBranch.name}, ${naypyitawCallCenter.name}, ${oceanOpsDev.name}`);

  // 4. Insert Departments
  const [execDept] = await db
    .insert(schema.departments)
    .values({
      orgId: acmeOrg.id,
      name: "Executive Management",
      code: "EXEC",
    })
    .returning();

  const [engDept] = await db
    .insert(schema.departments)
    .values({
      orgId: acmeOrg.id,
      name: "Product Engineering",
      code: "ENG",
    })
    .returning();

  const [hrDept] = await db
    .insert(schema.departments)
    .values({
      orgId: acmeOrg.id,
      name: "Human Resources",
      code: "HR",
    })
    .returning();

  const [finDept] = await db
    .insert(schema.departments)
    .values({
      orgId: acmeOrg.id,
      name: "Finance & Payroll",
      code: "FIN",
    })
    .returning();

  // 5. Insert Myanmar Statutory Public Holidays (2026)
  await db.insert(schema.publicHolidays).values([
    { orgId: acmeOrg.id, name: "Independence Day", date: "2026-01-04", year: 2026 },
    { orgId: acmeOrg.id, name: "Union Day", date: "2026-02-12", year: 2026 },
    { orgId: acmeOrg.id, name: "Peasants' Day", date: "2026-03-02", year: 2026 },
    { orgId: acmeOrg.id, name: "Full Moon of Tabaung", date: "2026-03-24", year: 2026 },
    { orgId: acmeOrg.id, name: "Armed Forces Day", date: "2026-03-27", year: 2026 },
    { orgId: acmeOrg.id, name: "Maha Thingyan Eve (A Kyo)", date: "2026-04-13", year: 2026 },
    { orgId: acmeOrg.id, name: "Maha Thingyan (A Kya)", date: "2026-04-14", year: 2026 },
    { orgId: acmeOrg.id, name: "Maha Thingyan (A Kyat)", date: "2026-04-15", year: 2026 },
    { orgId: acmeOrg.id, name: "Maha Thingyan (A Tat)", date: "2026-04-16", year: 2026 },
    { orgId: acmeOrg.id, name: "Myanmar New Year Day", date: "2026-04-17", year: 2026 },
    { orgId: acmeOrg.id, name: "Thadingyut Full Moon Day", date: "2026-10-25", year: 2026 },
    { orgId: acmeOrg.id, name: "National Day", date: "2026-12-04", year: 2026 },
  ]);

  // 6. Hash password
  const passwordHash = await bcrypt.hash("password123", 10);

  // 6b. Insert Platform SuperAdmin (Global SaaS Root - orgId: null)
  const [platformSuperadmin] = await db
    .insert(schema.users)
    .values({
      orgId: null,
      isOrgAdmin: false,
      employeeCode: "PLATFORM-SA-0001",
      name: "Global Platform SuperAdmin",
      email: "superadmin@omnihr.com",
      passwordHash,
      phone: "+95 9 000 000 000",
      role: "superadmin",
      designation: "SaaS Platform SuperAdmin",
      employmentType: "Platform",
      active: true,
    })
    .returning();

  console.log(`✓ Platform SuperAdmin provisioned: ${platformSuperadmin.email} (role: superadmin, orgId: null)`);

  // 7. Insert Hierarchy of Easy-to-Remember Users: MD/Admin -> Manager -> Staff + HR & Payroll
  // 1. Executive Admin (Managing Director)
  const [adminUser] = await db
    .insert(schema.users)
    .values({
      orgId: acmeOrg.id,
      isOrgAdmin: true,
      branchId: yangonHq.id,
      employeeCode: "ADM-0001",
      name: "U Thura",
      email: "admin@omnihr.com",
      passwordHash,
      phone: "+95 9 111 222 333",
      role: "admin",
      departmentId: execDept.id,
      departmentName: "Executive Management",
      designation: "Managing Director",
      employmentType: "Permanent",
      startDate: "2018-01-01",
      baseSalary: "8500000.00",
      nrcNumber: "12/BAHTA(N)012345",
      ssbNumber: "SSB-1001-9988",
    })
    .returning();

  // 2. HR Manager (Option C Emergency Override Lead)
  const [hrUser] = await db
    .insert(schema.users)
    .values({
      orgId: acmeOrg.id,
      isOrgAdmin: false,
      branchId: yangonHq.id,
      employeeCode: "HR-0001",
      name: "Daw Nandar",
      email: "hr@omnihr.com",
      passwordHash,
      phone: "+95 9 555 666 777",
      role: "hr",
      departmentId: hrDept.id,
      departmentName: hrDept.name,
      designation: "HR Compliance Lead",
      managerId: adminUser.id,
      managerName: adminUser.name,
      employmentType: "Permanent",
      startDate: "2019-03-01",
      baseSalary: "3800000.00",
      nrcNumber: "12/DAGAMA(N)098765",
      ssbNumber: "SSB-2019-5566",
    })
    .returning();

  // 3. Engineering Manager (reports to Admin)
  const [manager] = await db
    .insert(schema.users)
    .values({
      orgId: acmeOrg.id,
      isOrgAdmin: false,
      branchId: yangonHq.id,
      employeeCode: "MGR-0001",
      name: "Ko Min Thu",
      email: "manager@omnihr.com",
      passwordHash,
      phone: "+95 9 789 432100",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
      role: "manager",
      departmentId: engDept.id,
      departmentName: engDept.name,
      designation: "Engineering Team Lead",
      managerId: adminUser.id,
      managerName: adminUser.name,
      employmentType: "Permanent",
      startDate: "2020-02-10",
      baseSalary: "4500000.00",
      allowances: "500000.00",
      hourlyRate: "24038.46",
      bankName: "KBZ Bank",
      bankAccountNumber: "021-987-654321",
      nrcNumber: "12/LAKANA(N)045612",
      ssbNumber: "SSB-2020-1122",
    })
    .returning();

  // 4. Payroll Specialist
  const [payrollUser] = await db
    .insert(schema.users)
    .values({
      orgId: acmeOrg.id,
      isOrgAdmin: false,
      branchId: yangonHq.id,
      employeeCode: "PAY-0001",
      name: "Ko Zaw Lin",
      email: "payroll@omnihr.com",
      passwordHash,
      phone: "+95 9 333 444 555",
      role: "payroll",
      departmentId: finDept.id,
      departmentName: finDept.name,
      designation: "Payroll & Finance Specialist",
      managerId: adminUser.id,
      managerName: adminUser.name,
      employmentType: "Permanent",
      startDate: "2021-05-15",
      baseSalary: "3200000.00",
      nrcNumber: "12/AHLANA(N)012456",
      ssbNumber: "SSB-2021-3344",
    })
    .returning();

  // 5. Senior Software Engineer (reports to Manager Ko Min Thu)
  const [employee] = await db
    .insert(schema.users)
    .values({
      orgId: acmeOrg.id,
      isOrgAdmin: false,
      branchId: yangonHq.id,
      employeeCode: "EMP-0001",
      name: "Ma Su Su",
      email: "employee@omnihr.com",
      passwordHash,
      phone: "+95 9 234 890123",
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
      role: "employee",
      departmentId: engDept.id,
      departmentName: engDept.name,
      designation: "Senior Software Engineer",
      managerId: manager.id,
      managerName: manager.name,
      employmentType: "Permanent",
      startDate: "2023-04-15",
      baseSalary: "2200000.00",
      allowances: "200000.00",
      hourlyRate: "11538.46",
      bankName: "KBZ Bank",
      bankAccountNumber: "018-123-456789",
      nrcNumber: "12/KAMAYA(N)078901",
      ssbNumber: "SSB-2023-4455",
    })
    .returning();

  console.log(`✓ 5 Corporate Users created: ${adminUser.email}, ${hrUser.email}, ${manager.email}, ${payrollUser.email}, ${employee.email}`);

  // 8. Insert Leave Balances for Sarah Jenkins
  await db.insert(schema.leaveBalances).values([
    {
      orgId: acmeOrg.id,
      userId: employee.id,
      leaveType: "Annual",
      year: 2026,
      allocatedDays: "20.00",
      usedDays: "6.00",
      pendingDays: "1.00",
      carriedOverDays: "0.00",
    },
    {
      orgId: acmeOrg.id,
      userId: employee.id,
      leaveType: "Sick",
      year: 2026,
      allocatedDays: "12.00",
      usedDays: "2.00",
      pendingDays: "0.00",
      carriedOverDays: "0.00",
    },
    {
      orgId: acmeOrg.id,
      userId: employee.id,
      leaveType: "Casual",
      year: 2026,
      allocatedDays: "6.00",
      usedDays: "1.00",
      pendingDays: "0.00",
      carriedOverDays: "0.00",
    },
    {
      orgId: acmeOrg.id,
      userId: employee.id,
      leaveType: "Unpaid",
      year: 2026,
      allocatedDays: "30.00",
      usedDays: "0.00",
      pendingDays: "0.00",
      carriedOverDays: "0.00",
    },
  ]);

  // 9. Insert Leave Requests (N+1 Waterfall Approver = David Thorne)
  await db.insert(schema.leaveRequests).values([
    {
      orgId: acmeOrg.id,
      code: "LR-2026-001",
      userId: employee.id,
      leaveType: "Annual",
      startDate: "2026-11-27",
      endDate: "2026-11-28",
      daysCount: "2.00",
      isHalfDay: false,
      reason: "Family gathering for holiday weekend.",
      status: "pending_manager",
      approverId: manager.id,
    },
    {
      orgId: acmeOrg.id,
      code: "LR-2026-002",
      userId: employee.id,
      leaveType: "Sick",
      startDate: "2026-10-18",
      endDate: "2026-10-19",
      daysCount: "2.00",
      isHalfDay: false,
      reason: "Seasonal flu with doctor consultation.",
      status: "approved",
      approverId: manager.id,
      managerComment: "Get well soon!",
    },
  ]);

  // 10. Insert Attendance Records (Daily summary + raw punch)
  await db.insert(schema.attendanceRecords).values([
    {
      orgId: acmeOrg.id,
      userId: employee.id,
      branchId: yangonHq.id,
      date: "2026-11-20",
      status: "present",
      clockInTime: "08:58:00",
      clockOutTime: "17:30:00",
      workMinutes: 512,
      lateMinutes: 0,
      undertimeMinutes: 0,
      locationName: yangonHq.name,
      source: "mobile_geo",
    },
    {
      orgId: acmeOrg.id,
      userId: employee.id,
      branchId: yangonHq.id,
      date: "2026-11-19",
      status: "remote",
      clockInTime: "09:05:00",
      clockOutTime: "17:35:00",
      workMinutes: 510,
      lateMinutes: 0,
      locationName: "Remote Punch (3.4 km from Yangon HQ)",
      source: "mobile_geo",
      note: "Client consultation at Junction City",
    },
  ]);

  // Raw physical punch audit log
  await db.insert(schema.attendancePunches).values([
    {
      orgId: acmeOrg.id,
      userId: employee.id,
      branchId: yangonHq.id,
      punchType: "check_in",
      punchTime: new Date("2026-11-20T08:58:00Z"),
      latitude: "16.8409100",
      longitude: "96.1735100",
      distanceMeters: 12,
      isOutsideGeofence: false,
      isMockLocation: false,
      deviceId: "Pixel-8-Pro-9812",
    },
  ]);

  // 11. Insert Pay Run & Payslip (MMK Currency)
  const [payRun] = await db
    .insert(schema.payRuns)
    .values({
      orgId: acmeOrg.id,
      month: 10,
      year: 2026,
      cutoffDate: "2026-10-25",
      payDate: "2026-10-31",
      totalGross: "2618077.00",
      totalDeductions: "48000.00",
      totalNet: "2570077.00",
      totalSsbEmployer: "9000.00",
      totalSsbEmployee: "6000.00",
      totalTax: "42000.00",
      status: "approved",
      approvedBy: adminUser.id,
    })
    .returning();

  const [payslip] = await db
    .insert(schema.payslips)
    .values({
      orgId: acmeOrg.id,
      payRunId: payRun.id,
      userId: employee.id,
      month: 10,
      year: 2026,
      monthName: "October 2026",
      payDate: "2026-10-31",
      baseSalary: "2200000.00",
      allowances: "200000.00",
      overtimeHours: "10.00",
      overtimePay: "218077.00",
      claimsReimbursement: "45000.00",
      grossEarnings: "2663077.00",
      ssbEmployee: "6000.00", // Myanmar SSB 2% capped at 6,000 MMK
      ssbEmployer: "9000.00", // Myanmar SSB 3% capped at 9,000 MMK
      incomeTax: "42000.00",
      loanInstallment: "0.00",
      totalDeductions: "48000.00",
      netPay: "2615077.00",
      currency: "MMK",
      status: "Paid",
      bankName: "KBZ Bank",
      bankAccountMasked: "•••• •••• •••• 6789",
    })
    .returning();

  await db.insert(schema.payslipItems).values([
    {
      payslipId: payslip.id,
      name: "Basic Salary",
      amount: "2200000.00",
      category: "Earning",
    },
    {
      payslipId: payslip.id,
      name: "Transport & Housing Allowance",
      amount: "200000.00",
      category: "Earning",
    },
    {
      payslipId: payslip.id,
      name: "Overtime (10 hrs @ 2.0x)",
      amount: "218077.00",
      category: "Earning",
    },
    {
      payslipId: payslip.id,
      name: "Myanmar Social Security (SSB 2%)",
      amount: "6000.00",
      category: "Deduction",
    },
    {
      payslipId: payslip.id,
      name: "Personal Income Tax Withholding",
      amount: "42000.00",
      category: "Deduction",
    },
  ]);

  // 12. Insert Announcements
  await db.insert(schema.announcements).values([
    {
      orgId: acmeOrg.id,
      authorityGroup: "Managing Director's Office (MD)",
      authorityCode: "MD",
      directiveNo: "DIR-2026-08",
      title: "FY2027 Q4 Business Goals and Security Audit Schedule",
      summary:
        "ဒါရိုက်တာဘုတ်အဖွဲ့မှ စတုတ္ထသုံးလပတ် လုပ်ငန်းပန်းတိုင်များကို အတည်ပြုပြီးဖြစ်ပါသည်။ လာမည့်အပတ်တွင် လုံခြုံရေးဆိုင်ရာ စံနှုန်းစစ်ဆေးမှုများ စတင်ပါမည်။",
      fullBody:
        "ဒါရိုက်တာဘုတ်အဖွဲ့မှ FY2027 စတုတ္ထသုံးလပတ် လုပ်ငန်းပန်းတိုင်များနှင့် နည်းပညာအခြေခံအဆောက်အအုံဆိုင်ရာ လမ်းပြမြေပုံများကို တရားဝင်အတည်ပြုလိုက်ပြီ ဖြစ်ပါသည်။\n\nဌာနခွဲအသီးသီးမှ တာဝန်ရှိသူများအနေဖြင့် နိုဝင်ဘာလကုန်တွင် သက်ဆိုင်ရာ လုပ်ငန်းစီမံချက်များကို အပြီးသတ်ညှိနှိုင်းဆောင်ရွက်ကြရန် ညွှန်ကြားအပ်ပါသည်။",
      date: "Nov 15, 2026",
      issuer: "Dr. Arthur Vance (Managing Director)",
      priority: "Urgent",
    },
    {
      orgId: acmeOrg.id,
      authorityGroup: "Human Resources Department (HR)",
      authorityCode: "HR",
      directiveNo: "DIR-2026-07",
      title: "Annual Leave Transfer and Public Holiday Announcement",
      summary:
        "နိုဝင်ဘာ ၂၆ နှင့် ၂၇ ရက်များတွင် ရုံးပိတ်ပါမည်။ ခွင့်ရက်လက်ကျန် လွှဲပြောင်းလိုသူများ ဒီဇင်ဘာ ၁၅ ရက်မတိုင်မီ စာရင်းတင်ပြရပါမည်။",
      fullBody:
        "လာမည့် နိုဝင်ဘာ ၂၆ နှင့် ၂၇ ရက်တို့တွင် ရုံးချုပ်အား တရားဝင် ပိတ်ထားမည်ဖြစ်ပြီး အရေးပေါ် အင်ဂျင်နီယာအဖွဲ့သာ အလှည့်ကျ တာဝန်ထမ်းဆောင်ပါမည်။\n\nနှစ်ကုန်ခွင့်ရက် လွှဲပြောင်းခွင့်ရှိသူများ (အများဆုံး ၅ ရက်) အနေဖြင့် ဒီဇင်ဘာ ၁၅ ရက်မတိုင်မီ HR Portal မှတစ်ဆင့် လျှောက်ထားအတည်ပြုချက် ရယူကြပါရန် အသိပေးအပ်ပါသည်။",
      date: "Nov 12, 2026",
      issuer: "Elena Rostova (HR Operations Lead)",
      priority: "Standard",
    },
  ]);

  console.log("✓ Multi-tenant seed completed successfully!");
  console.log(`
===========================================================
  OMNI-HR LOCAL DATABASE SEED CREDENTIALS
===========================================================
  PostgreSQL Port : 5432 (Localhost / Docker)
  Database        : omni_hr
  Username        : postgres
  Password        : password123

  [Test Accounts - All passwords: 'password123']
  1. Managing Director : arthur.vance@acmecorp.com (MD / Exec)
  2. Team Lead/Manager : david.thorne@acmecorp.com (ENG Director)
  3. General Employee  : sarah.jenkins@acmecorp.com (Staff)
  4. HR Manager        : hr@omnihr.com (HR Option C Override)
  5. System Admin      : admin@omnihr.com (SuperAdmin)

  [Offices Seeded]
  - Office 1 (Yangon HQ)     : M Tower (16.8236000, 96.1309000, Radius: 300m)
  - Office 2 (Mandalay)      : 73rd Street (21.9750000, 96.0836000, Radius: 250m)
  - Office 3 (Naypyitaw)     : Railway Station Call Center (19.8355000, 96.1965000, Radius: 300m)
  - Office 4 (Ops & Dev)     : Near Ocean Supercenter (16.8720000, 96.1265000, Radius: 250m)
===========================================================
  `);

  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
