# Omni-HR Backend Architecture & Workflow Specification

> **Document Status**: `APPROVED & CONFIRMED ARCHITECTURE`  
> **Note**: This file serves as the official source of truth for the Omni-HR backend system. All operational decisions, business rules, and relational schemas have been finalized and confirmed. Implementation will adhere strictly to this blueprint.

---

## 1. System Overview & Core Constants

| Dimension | Specification | Status |
|---|---|---|
| **Database Engine** | PostgreSQL 16 (Local Docker Container) | `[x] Confirmed` |
| **Database Port** | `5432` (Exposed for pgAdmin inspection) | `[x] Confirmed` |
| **API Server** | Node.js (v25) + Fastify v5 (Port `5050`) | `[x] Confirmed` |
| **ORM / Migration** | Drizzle ORM (`drizzle-kit`) | `[x] Confirmed` |
| **Standard Currency** | `MMK` (Myanmar Kyats) — Never USD | `[x] Confirmed` |
| **Statutory Compliance** | Myanmar SSB (Social Security Board) & Income Tax | `[x] Confirmed` |
| **Client Channels** | Web Portal (Admin/HR) vs Mobile ESS (Employees) | `[x] Confirmed` |

---

## 2. Channel & Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                      WEB DASHBOARD                          │
│   (For Founders, HR Directors, Payroll Admins & Managers)   │
├─────────────────────────────────────────────────────────────┤
│  ✓ Register New Organization                                │
│  ✓ Full Organization Chart & Department Structure           │
│  ✓ Provision & Add New Employees (Issue initial passwords)  │
│  ✓ Set Base Salaries, Allowances, Myanmar NRC & SSB Numbers │
│  ✓ Run Monthly Payroll & Calculate SSB / Income Tax         │
│  ✓ Review Department Leaves & Attendance Regularizations    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   MOBILE ESS APPLICATION                    │
│                 (For All General Employees)                 │
├─────────────────────────────────────────────────────────────┤
│  ✕ NO Self-Registration / NO "Sign Up" Screen               │
│  ✓ LOGIN ONLY with credentials provisioned by Web Admin    │
│  ✓ Geo-Fenced Attendance Check-In / Check-Out               │
│  ✓ Submit Leave Requests (Full-Day, Half-Day AM/PM)         │
│  ✓ View Monthly Payslips & Deductions Breakdown (MMK)       │
│  ✓ Read Corporate Memos & Directives                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. End-to-End Operational Workflows

### Flow 1: Organization Creation & Admin Onboarding (Web Only)
- **Actor**: Company Founder / HR Admin on Web.
- **Endpoint**: `POST /api/auth/register-org`
- **Steps**:
  1. Founder submits: `orgName`, `orgCode` (unique, e.g. "KBZG"), `taxId`, `adminName`, `adminEmail`, `adminPassword`.
  2. Server creates row in `organizations` with default currency `"MMK"`.
  3. Server auto-creates default `departments`: `"Executive"`, `"Human Resources"`, `"General"`.
  4. Server creates the SuperAdmin in `users` with `role: "admin"`, `isOrgAdmin: true`, linked to the new `org_id`.
  5. Returns JWT tokens (`accessToken`, `refreshToken`); Admin is immediately logged into the Web Dashboard.
- **Confirmation Status**: `[x] Confirmed (Web Admin registers Organization)`

---

### Flow 2: Employee Provisioning (Web Only — Admin/HR)
- **Actor**: HR Admin in Web Dashboard $\rightarrow$ Employee Directory $\rightarrow$ "Add Employee".
- **Endpoint**: `POST /api/employees` (Protected: `role: 'admin' | 'hr'`)
- **Steps**:
  1. HR enters:
     - `name`: Full Employee Name
     - `email`: Work email (unique across system)
     - `employeeCode`: Unique code (e.g. "EMP-1005")
     - `initialPassword`: Temporary password (e.g. "Welcome2026!")
     - `role`: `'employee' | 'manager' | 'hr' | 'payroll'`
     - `departmentId`: Selected from organization departments
     - `designation`: e.g. "Senior Frontend Engineer"
     - `managerId`: Reporting line manager (optional for directors)
     - `baseSalary`: Monthly salary in MMK (e.g. `2,500,000 MMK`)
     - `startDate`: Joining date
     - `nrcNumber`: Myanmar National Registration Card (e.g. `12/LKN(N)123456`)
     - `ssbNumber`: Myanmar Social Security Board ID
  2. Server validates email uniqueness, hashes password with `bcrypt`.
  3. Server inserts row into `users` with `org_id = current_admin_org_id` and `active = true`.
  4. Server auto-allocates default annual `leave_balances` for the current calendar year:
     - Annual Leave: `10 days`
     - Casual Leave: `6 days`
     - Medical / Sick Leave: `30 days`
  5. HR hands over login credentials to the employee.
- **Confirmation Status**: `[x] Confirmed (HR provisions credentials on Web)`

---

### Flow 3: Mobile Access & Authentication (Mobile ESS — No Registration)
- **Actor**: General Employee on Mobile App (Expo SDK 58).
- **Endpoint**: `POST /api/auth/login`
- **Steps**:
  1. Employee launches Mobile App $\rightarrow$ sees clean **Login Screen** (no registration form).
  2. Employee enters provisioned `email` and `password`.
  3. Server checks:
     - User exists and password hash matches.
     - `user.active === true` (Resigned, terminated, or suspended users are rejected immediately).
  4. Server returns JWT Access Token (1h), Refresh Token (7d), and user profile (Role, Department, Manager Name).
  5. Mobile app opens Home screen with real-time live clock, attendance widget, and notices.
- **Confirmation Status**: `[x] Confirmed (Strictly login-only on Mobile)`

---

### Flow 4: Geo-Attendance & Precision Punch
- **Actor**: Employee at physical office location or working remotely.
- **Endpoints**:
  - `POST /api/attendance/check-in`
  - `POST /api/attendance/check-out`
  - `GET /api/attendance/summary`
- **Steps**:
  1. Employee taps **Check In Now** on Mobile app.
  2. Mobile captures GPS coordinates (`latitude`, `longitude`, `accuracy`) and `device_id`.
  3. **Multi-Office Geofence Evaluation (Auto-Matching)**:
     - Computes Haversine distance between device GPS and all active `office_locations` of the organization (e.g. Yangon HQ, Mandalay Branch).
     - Finds the closest branch and calculates distance in meters.
  4. **Geofence Range Decision & Prompt Flow**:
     - **In-Range ($\le$ branch radius, e.g. 200m)**:
       - Instantly accepted as verified on-site punch.
       - Associated with matched branch (e.g. "Yangon HQ").
       - Status set to `'present'`.
     - **Out-of-Range ($>$ branch radius)**:
       - Native Bottom Sheet / Dialog prompts the employee:
         > *"You are not within range of any office (Nearest: Yangon HQ, 3.4 km away). Do you want to request a Remote Check-In?"*
       - Employee can enter an optional reason/note (e.g. *"Working from Home"*, *"Client meeting at Junction City"*).
       - When confirmed (`isRemoteConfirmed: true`), punch is accepted with:
         - `status = 'remote'`
         - `is_outside_geofence = true`
         - `distance_meters = 3400`
         - `nearest_branch_id = <Yangon HQ ID>`
         - `note = <Employee Reason>`
       - Manager / HR can view the remote flag and justification in their dashboard.
     - Checks `is_mock_location === false` to block fake GPS tools.
  5. **Shift Evaluation**:
     - Compares clock-in against shift start (`09:00:00` + `15 min` grace period).
     - If after `09:15:00`: marks status `'late'` and computes exact `late_minutes`.
  6. **Dual-Table Storage**:
     - **`attendance_punches`**: Logs raw physical punch timestamp, GPS, device ID, geofence flag, note (immutable audit log).
     - **`attendance_records`**: Updates today's single summary row (`first_in`, `last_out`, `work_minutes`, `status`, `note`).
  7. **UI Feedback**:
     - Mobile screen highlights Check-In time (Bold Black, or Red if late).
     - Shows Center Duration Bridge (`── 8.8h ──`).
     - Native `@expo/ui` BottomSheet confirms punch status (On-site vs Remote).
- **Confirmation Status**: `[x] Confirmed (Option B + Out-of-Range Remote Confirmation Prompt)`

---

### Flow 5: Leave Management & Waterfall Approval Chains
- **Actor**: Employee on Mobile $\rightarrow$ Leaves Tab $\rightarrow$ "Request Leave".
- **Endpoints**:
  - `POST /api/leaves`
  - `GET /api/leaves/balances`
  - `GET /api/leaves/pending-approvals`
  - `PUT /api/leaves/:id/review`
- **Waterfall Hierarchy (N+1 Line-Manager Rule)**:
  1. **Strict Line Management**:
     - When Staff submits a request, the system auto-resolves `approver_id = staff.manager_id` (Direct Team Lead / Manager).
     - Managing Director and upper executives do **not** micro-manage or see routine staff leaves.
     - When a Team Lead / Manager submits leave, their request auto-routes to their direct supervisor (`manager.manager_id`, e.g. Director or MD).
  2. **Emergency Override (Option C - Confirmed)**:
     - If a direct manager is on leave, absent, or unreachable in an urgent scenario, an **HR Admin** (`role: 'hr' | 'admin'`) can exercise emergency override to approve/reject on behalf of the manager.
     - Any override is immutably recorded in `leave_audit_logs` (`action: 'HR_OVERRIDE_APPROVE'`, noting HR Admin's `actor_id` and override reason).
- **Steps**:
  1. Employee selects Leave Category (`Annual`, `Medical`, `Casual`, `Unpaid`).
  2. Selects date range from calendar:
     - Automatically excludes weekends (Saturdays/Sundays) and statutory Myanmar Gazette public holidays (Thingyan, Thadingyut, etc.) from `days_count`.
  3. If single day: chooses `Full Day (1.0d)`, `Morning (0.5d)`, or `Afternoon (0.5d)`.
  4. Enters reason; attaches doctor slip if Medical Leave.
  5. Server deducts requested days from `pending_days` in `leave_balances`.
  6. Direct Line Manager (or HR Admin via Option C override) approves or rejects with comment.
  7. Upon Approval: `used_days` increments, status changes to `'approved'`, and calendar marks leave.
- **Confirmation Status**: `[x] Confirmed (Waterfall N+1 + HR Admin Override)`

---

### Flow 6: Myanmar Statutory Payroll Engine (All MMK)
- **Actor**: HR Admin initiates monthly pay-run on Web.
- **Endpoints**:
  - `POST /api/payroll/pay-runs/calculate`
  - `GET /api/payroll/payslips/:id`
- **Formulas & Rules**:
  1. **Gross Earnings** = $\text{Base Salary} + \text{Fixed Allowances} + \text{Approved Overtime Pay}$.
  2. **Myanmar SSB (Social Security Board) Deductions**:
     - Employee: $2\%$ of salary (Capped at maximum salary ceiling of $300,000\text{ MMK} \rightarrow \mathbf{6,000\text{ MMK/month}}$ maximum).
     - Employer: $3\%$ of salary (Capped at maximum salary ceiling of $300,000\text{ MMK} \rightarrow \mathbf{9,000\text{ MMK/month}}$ maximum).
  3. **Personal Income Tax (Yearly progressive Myanmar bands)**:
     - $0\text{ to }4.8\text{M MMK}$: $0\%$
     - $4.8\text{M to }10\text{M MMK}$: $5\%$
     - $10\text{M to }30\text{M MMK}$: $10\%$
     - $30\text{M to }50\text{M MMK}$: $15\%$
     - $50\text{M to }70\text{M MMK}$: $20\%$
     - $>70\text{M MMK}$: $25\%$
  4. **Company Deductions**:
     - Late penalties & unpaid leave cuts (auto-calculated from `attendance_records`).
     - Active loan repayments (auto-deducted from `employee_loans`).
  5. **Net Take-Home Pay**: Disbursed in **`MMK`**.
  6. Individual `payslips` published for employees to view on Mobile app or download as PDF.
- **Confirmation Status**: `[x] Confirmed (Myanmar SSB + Progressive Tax Engine)`

---

## 4. Final Architecture Confirmation Checklist

| # | Question / Topic | Specification / Choice | Status |
|---|---|---|---|
| **1** | **Multi-Tenancy** | Multi-tenant organization structure (`org_id` on all departments, branches, employees, records) | `[x] Confirmed` |
| **2** | **Mobile Auth** | Strictly NO self-registration on mobile (provisioned by HR on Web Dashboard only) | `[x] Confirmed` |
| **3** | **Working Days** | Standard working week: 5 days (Monday to Friday, Option A) | `[x] Confirmed (Option A: 5-Day Mon–Fri)` |
| **4** | **Geofence Action** | Punch outside office radius: Prompt employee for remote check-in reason, then accept & flag as `'remote'` for manager audit | `[x] Confirmed (Option B + Remote Prompt)` |
| **5** | **Approval Tier** | Waterfall N+1 Line Manager rule + Option C (HR Admin emergency override) | `[x] Confirmed (Waterfall + HR Override)` |
| **6** | **Attendance Table** | Dual-table (`attendance_punches` for raw logs + `attendance_records` for daily summary) | `[x] Confirmed` |

---

> **Implementation Status**: `COMPLETED & VERIFIED`  
> - Docker PostgreSQL container running on port `5432` (`omni_hr`).
> - Drizzle migration `0000_remarkable_pestilence.sql` executed across all 24 relational tables.
> - Multi-tenant seed executed with test accounts, Myanmar Gazette holidays, and 2 office locations (Yangon HQ & Mandalay Branch).
> - Fastify API server running on port `5050` with all routes tested and verified.
