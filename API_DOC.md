# Omni HR Core — REST API Reference Documentation

> **Base URL**: `http://localhost:5050/api` (Local Development)  
> **Protocol**: HTTP/1.1 over JSON  
> **Server Engine**: Fastify v5 (Node.js)  
> **Standard Currency**: `MMK` (Myanmar Kyats)  
> **Global Status**: `v1.0.0 (Production-Ready Architecture)`

---

## 1. Global Specifications & Standards

### 1.1 Authentication & Security Headers

Every protected endpoint requires a standard Bearer JWT token in the `Authorization` header.

```http
Authorization: Bearer <jwt-access-token>
```

Optional and standard enterprise headers:
| Header | Type | Description |
|---|---|---|
| `Authorization` | `string` | Required on all protected endpoints. Format: `Bearer <token>` |
| `Content-Type` | `string` | Must be `application/json` for requests with payloads |
| `x-idempotency-key` | `string` | Unique client UUID (e.g. `c4b693e5-827d-...`) to ensure mutation idempotency across retries |
| `x-client-platform` | `string` | Client platform identifier (`mobile` or `web`). Used to enforce channel boundaries |

---

### 1.2 Centralized Response & Error Standard

All responses are returned as `application/json`. Errors return an informative payload detailing database or validation root causes:

#### Standard Error Response Format
```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Data has been modified by another user. Please refresh the page to load the latest changes.",
  "details": "Key (email)=(john.doe@company.com) already exists."
}
```

#### Common HTTP Status Codes
| Code | Reason | Meaning |
|---|---|---|
| `200 OK` | Success | Request succeeded and data is returned |
| `201 Created` | Created | Resource successfully created in database |
| `400 Bad Request` | Validation Error | Missing required fields, schema validation failure, or invalid parameters |
| `401 Unauthorized` | Auth Failure | Missing, expired, or invalid JWT Bearer token |
| `403 Forbidden` | Access Denied | Caller lacks required RBAC role or attempted illegal self-approval / web-access |
| `404 Not Found` | Not Found | Entity matching the provided ID does not exist in the tenant scope |
| `409 Conflict` | OCC / Unique Error | Unique constraint violation or Optimistic Concurrency Control version mismatch |
| `503 Service Unavailable` | DB Disconnected | Database connection failure or unreachable PostgreSQL instance |

---

## 2. API Modules Breakdown

The Omni HR backend provides 9 core route modules:

1. **Authentication & Session (`/api/auth`)**
2. **Employee Management (`/api/employees`)**
3. **Attendance & Geofencing (`/api/attendance`)**
4. **Leave Management (`/api/leaves`)**
5. **Payroll & Compensation (`/api/payroll`)**
6. **Expense Reimbursement Claims (`/api/claims`)**
7. **Corporate Directives & Announcements (`/api/announcements`)**
8. **Platform SaaS Administration (`/api/platform`)**
9. **Dynamic Roles & Permissions (`/api/roles` & `/api/permissions`)**

---

## 3. Module 1: Authentication & Session (`/api/auth`)

### 1. Register Organization & SuperAdmin
Registers a new enterprise tenant organization and provisions its primary executive administrator on the Web Portal.

- **Route**: `POST /api/auth/register-org`
- **Auth**: Public (Web Admin Onboarding)
- **Request Body**:
  ```json
  {
    "orgName": "KBZ Gateway Ltd.",
    "orgCode": "KBZG",
    "adminName": "U Thura",
    "adminEmail": "thura@kbzgateway.com",
    "adminPassword": "SecureAdminPassword123!",
    "taxId": "TAX-MM-9872134",
    "phone": "+95 1 230 4567",
    "address": "Silicon Tower, Level 4, Bahan, Yangon",
    "officeName": "Yangon Head Office",
    "officeLat": "16.8236000",
    "officeLng": "96.1309000",
    "officeRadius": 300
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "message": "Organization registered successfully",
    "organization": {
      "id": "e4c76740-bf71-4648-b4b1-84065e8a7fc2",
      "name": "KBZ Gateway Ltd.",
      "code": "KBZG",
      "currency": "MMK"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600,
    "user": {
      "id": "b3f07a16-1f91-4475-a864-d62fb6a25624",
      "employeeCode": "KBZG-0001",
      "fullName": "U Thura",
      "email": "thura@kbzgateway.com",
      "role": "Admin",
      "isOrgAdmin": true,
      "department": "Executive Management",
      "designation": "Founder / Managing Director"
    }
  }
  ```

---

### 2. User Login
Authenticates users for both Web Dashboard and Mobile ESS. Enforces role-based platform segregation.

- **Route**: `POST /api/auth/login`
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "email": "employee@omnihr.com",
    "password": "password123",
    "client": "mobile"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn...",
    "expiresIn": 3600,
    "user": {
      "id": "c7a8848b-ea79-4d92-bb8d-71b504cf0ff2",
      "orgId": "91df5d4d-bc1b-41ce-83a3-d02f5c1eebe1",
      "isOrgAdmin": false,
      "branchId": "1b084931-18e4-419b-a010-08fca8b4d86b",
      "employeeCode": "EMP-0001",
      "fullName": "Ko Aung Myint",
      "email": "employee@omnihr.com",
      "phone": "+95 9 777 888 999",
      "role": "Employee",
      "department": "Product Engineering",
      "designation": "Senior Software Engineer",
      "mustChangePassword": false,
      "joinDate": "2021-06-01",
      "reportingManagerName": "U Kyaw Swar"
    }
  }
  ```
- **Platform Restriction Error `403 Forbidden`**:
  ```json
  {
    "statusCode": 403,
    "error": "Forbidden",
    "message": "Web dashboard access is restricted to Managers, HR Specialists, and Administrators. Standard staff must use the Omni HR Mobile App."
  }
  ```

---

### 3. Get Authenticated User Profile
Fetches current user metadata and permissions.

- **Route**: `GET /api/auth/me`
- **Auth**: Protected (Any valid user)
- **Response `200 OK`**: Returns user profile DTO matching login schema.

---

### 4. Change Password
Rotates current user's password. Clears `mustChangePassword` flag.

- **Route**: `POST /api/auth/change-password`
- **Auth**: Protected
- **Request Body**:
  ```json
  {
    "newPassword": "BrandNewSecurePassword2026!"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "Password updated successfully"
  }
  ```

---

### 5. Refresh Access Token
Exchanges a valid 7-day refresh token for a new 1-hour access token with token rotation. Hashed verification against `refresh_tokens`.

- **Route**: `POST /api/auth/refresh` (Also aliases `POST /api/auth/refresh-token`)
- **Auth**: Public
- **Request Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsIn..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 3600
  }
  ```

---

## 4. Module 2: Employee Management (`/api/employees`)

### 1. List Employee Directory
Returns active employees within the user's organization. Supports role-based scoping and sensitive salary redaction.

- **Route**: `GET /api/employees`
- **Auth**: Protected
- **Query Parameters**:
  | Parameter | Type | Description |
  |---|---|---|
  | `departmentId` | `uuid` | Optional filter by department |
  | `role` | `string` | Optional filter by role (`employee`, `manager`, `hr`, `payroll`, `admin`) |
  | `search` | `string` | Case-insensitive search across name, email, and employee code |
- **Access & Redaction Rules**:
  - If caller role is `manager`, results are strictly scoped to direct subordinates (`users.managerId === caller.userId`).
  - If caller does NOT have salary access (`role` is not in `['admin', 'hr', 'payroll']`), sensitive fields (`baseSalary`, `allowances`, `bankName`, `bankAccountNumber`) are automatically redacted from the response.
- **Response `200 OK`**:
  ```json
  {
    "count": 1,
    "employees": [
      {
        "id": "c7a8848b-ea79-4d92-bb8d-71b504cf0ff2",
        "employeeCode": "EMP-0001",
        "name": "Ko Aung Myint",
        "email": "employee@omnihr.com",
        "phone": "+95 9 777 888 999",
        "role": "employee",
        "departmentName": "Product Engineering",
        "designation": "Senior Software Engineer",
        "managerName": "U Kyaw Swar",
        "employmentType": "Permanent",
        "startDate": "2021-06-01",
        "active": true,
        "version": 1
      }
    ]
  }
  ```

---

### 2. Provision New Employee
HR/Admin creates a new employee account and auto-allocates statutory annual leave balances.

- **Route**: `POST /api/employees`
- **Auth**: Protected (`role: 'admin' | 'hr'`)
- **Request Body**:
  ```json
  {
    "name": "Ma Su Lwin",
    "email": "su.lwin@omnihr.com",
    "employeeCode": "EMP-0002",
    "initialPassword": "WelcomePassword2026!",
    "role": "employee",
    "departmentId": "4889c253-e578-4ea1-b21a-e9fa40316e04",
    "designation": "Frontend Developer",
    "managerId": "b1a77411-9a74-42b7-a379-3fbc4a3a5f8e",
    "baseSalary": "2200000.00",
    "allowances": "200000.00",
    "startDate": "2026-03-01",
    "nrcNumber": "12/KAMAYA(N)192834",
    "ssbNumber": "SSB-2026-7788",
    "phone": "+95 9 444 333 222",
    "bankName": "KBZ Bank",
    "bankAccountNumber": "0987654321012"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "message": "Employee provisioned successfully with standard annual leave allocations",
    "employee": {
      "id": "9d90ecfe-bf40-410a-85d7-b8f9e6129845",
      "employeeCode": "EMP-0002",
      "version": 1,
      "name": "Ma Su Lwin",
      "email": "su.lwin@omnihr.com",
      "role": "employee",
      "department": "Product Engineering",
      "designation": "Frontend Developer",
      "reportingManager": "U Kyaw Swar",
      "baseSalary": "2200000.00",
      "currency": "MMK",
      "startDate": "2026-03-01"
    }
  }
  ```

---

### 3. Update Employee Profile
Updates employee records with Optimistic Concurrency Control (OCC).

- **Route**: `PUT /api/employees/:id`
- **Auth**: Protected (`role: 'admin' | 'hr'`)
- **Request Body**:
  ```json
  {
    "name": "Ma Su Lwin Updated",
    "phone": "+95 9 444 333 999",
    "baseSalary": "2400000.00",
    "version": 1
  }
  ```
- **Response `200 OK`**: Returns updated employee DTO with `version: 2`.
- **OCC Conflict `409 Conflict`**: Returned if submitted `version` does not match the database version.

---

## 5. Module 3: Attendance Management (`/api/attendance`)

### 1. Get Organization Office Branches
Returns all active office locations for GPS geofencing and map visualization.

- **Route**: `GET /api/attendance/branches`
- **Auth**: Protected
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "1b084931-18e4-419b-a010-08fca8b4d86b",
      "orgId": "91df5d4d-bc1b-41ce-83a3-d02f5c1eebe1",
      "name": "Yangon HQ - M Tower",
      "code": "YGN-HQ",
      "latitude": "16.8236000",
      "longitude": "96.1309000",
      "radiusMeters": 300,
      "address": "M Tower, 381 Pyay Road, Kamayut, Yangon",
      "isActive": true
    }
  ]
  ```

---

### 2. Attendance Summary
Returns high-performance SQL aggregated attendance metrics for the current calendar month and today's punch state.

- **Route**: `GET /api/attendance/summary`
- **Auth**: Protected
- **Response `200 OK`**:
  ```json
  {
    "totalWorkingDays": 22,
    "presentDays": 18,
    "remoteDays": 2,
    "absentDays": 0,
    "lateDays": 1,
    "onLeaveDays": 1,
    "totalWorkHours": 164.5,
    "currentStatus": "CheckedIn",
    "todayRecord": {
      "id": "771e1d8a-ea6b-4e4b-9720-d3cf6381fbc0",
      "date": "2026-11-23",
      "checkInTime": "08:55 AM",
      "checkOutTime": null,
      "status": "Present",
      "workHours": 0.0,
      "locationName": "Yangon HQ - M Tower"
    }
  }
  ```

---

### 3. Attendance History
Returns up to 60 historical daily punch records.

- **Route**: `GET /api/attendance/history`
- **Auth**: Protected
- **Query Parameters**: `month` (1–12), `year` (e.g. 2026).
- **Response `200 OK`**: Array of daily attendance items.

---

### 4. Precision Check-In (Multi-Branch Haversine & Remote Prompt)
Evaluates real-time GPS coordinates against all active branches.

- **Route**: `POST /api/attendance/check-in`
- **Auth**: Protected
- **Request Body (Initial Geofence Probe)**:
  ```json
  {
    "latitude": 16.8236100,
    "longitude": 96.1309200,
    "accuracy": 12.5,
    "deviceId": "Pixel_9_Pro_A15"
  }
  ```
- **Scenario A: Inside Geofence ($\le$ radius)**:
  - **Response `200 OK`**:
    ```json
    {
      "id": "771e1d8a-ea6b-4e4b-9720-d3cf6381fbc0",
      "date": "2026-11-23",
      "checkInTime": "08:58 AM",
      "status": "Present",
      "workHours": 0,
      "locationName": "Yangon HQ - M Tower",
      "isOutsideGeofence": false
    }
    ```
- **Scenario B: Outside Geofence (Prompts Remote Check-In)**:
  - **Response `200 OK`**:
    ```json
    {
      "requiresRemoteConfirmation": true,
      "nearestBranchName": "Yangon HQ - M Tower",
      "nearestBranchId": "1b084931-18e4-419b-a010-08fca8b4d86b",
      "distanceMeters": 3400,
      "message": "You are not within range of any office (Nearest: Yangon HQ - M Tower, 3.4km away). Do you want to submit a Remote Check-In?"
    }
    ```
- **Scenario C: Confirming Remote Check-In**:
  - **Request Body**:
    ```json
    {
      "latitude": 16.8409000,
      "longitude": 96.1735000,
      "isRemoteConfirmed": true,
      "remoteReason": "Working from Home"
    }
    ```
  - **Response `200 OK`**:
    ```json
    {
      "id": "771e1d8a-ea6b-4e4b-9720-d3cf6381fbc0",
      "date": "2026-11-23",
      "checkInTime": "09:02 AM",
      "status": "Remote",
      "locationName": "Remote (3.4km from Yangon HQ - M Tower)",
      "isOutsideGeofence": true,
      "note": "Working from Home"
    }
    ```

---

### 5. Precision Check-Out
Records punch out time and computes completed work hours.

- **Route**: `POST /api/attendance/check-out`
- **Auth**: Protected
- **Request Body**: Same coordinates and remote confirmation structure as Check-In.
- **Response `200 OK`**: Returns daily record with `checkOutTime` and total `workHours`.

---

### 6. Submit Attendance Regularization Request
Submits a miss-punch correction request for manager review.

- **Route**: `POST /api/attendance/regularize`
- **Auth**: Protected
- **Request Body**:
  ```json
  {
    "date": "2026-11-20",
    "requestedClockIn": "09:00:00",
    "requestedClockOut": "18:00:00",
    "reason": "Battery depleted at 5 PM while in transit"
  }
  ```
- **Response `201 Created`**: Returns created regularization record (`status: 'pending'`).

---

### 7. Review Regularization Request
Manager/HR approves or rejects the regularization request.

- **Route**: `PUT /api/attendance/regularize/:id/review`
- **Auth**: Protected (`role: 'admin' | 'hr' | 'manager'`)
- **Request Body**:
  ```json
  {
    "status": "approved",
    "comment": "Confirmed with team lead"
  }
  ```
- **Response `200 OK`**: Returns updated regularization DTO. Atomically marks `is_regularized: true` in `attendance_records`.

---

### 8. Manager / HR Proxy Punch
Direct line managers or HR specialists record attendance on behalf of field employees.

- **Route**: `POST /api/attendance/proxy-punch`
- **Auth**: Protected (`role: 'admin' | 'hr' | 'manager'`)
- **Request Body**:
  ```json
  {
    "targetUserId": "c7a8848b-ea79-4d92-bb8d-71b504cf0ff2",
    "punchType": "check_in",
    "branchId": "1b084931-18e4-419b-a010-08fca8b4d86b",
    "timestamp": "09:00:00",
    "date": "2026-11-23",
    "reason": "Field site deployment without mobile coverage"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "message": "Successfully recorded proxy check-in for Ko Aung Myint at Yangon HQ - M Tower.",
    "punch": { "id": "..." },
    "attendanceRecord": {
      "id": "...",
      "date": "2026-11-23",
      "checkInTime": "09:00 AM",
      "status": "present",
      "isRegularized": true
    }
  }
  ```

---

## 6. Module 4: Leave Management (`/api/leaves`)

### 1. Get Leave Balances
Returns annual entitlement, used, pending, and remaining available leave days.

- **Route**: `GET /api/leaves/balances`
- **Auth**: Protected
- **Response `200 OK`**:
  ```json
  [
    {
      "leaveType": "Annual",
      "allocatedDays": 10.0,
      "usedDays": 2.0,
      "pendingDays": 1.0,
      "availableDays": 7.0
    },
    {
      "leaveType": "Sick",
      "allocatedDays": 30.0,
      "usedDays": 0.0,
      "pendingDays": 0.0,
      "availableDays": 30.0
    },
    {
      "leaveType": "Casual",
      "allocatedDays": 6.0,
      "usedDays": 1.0,
      "pendingDays": 0.0,
      "availableDays": 5.0
    }
  ]
  ```

---

### 2. Get My Leave Requests
Returns all historical applications submitted by the caller.

- **Route**: `GET /api/leaves/my-requests`
- **Auth**: Protected
- **Response `200 OK`**: Array of leave request DTOs.

---

### 3. Get Pending Approvals (Waterfall Line-Queue)
Returns applications awaiting caller's review. Managers see direct reports; HR/Admins see all pending requests for Option C override.

- **Route**: `GET /api/leaves/pending-approvals`
- **Auth**: Protected (`role: 'manager' | 'hr' | 'admin'`)
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "f5e927ad-8509-462f-9818-a621c518b5ef",
      "code": "LR-410928",
      "version": 1,
      "employeeId": "c7a8848b-ea79-4d92-bb8d-71b504cf0ff2",
      "employeeName": "Ko Aung Myint",
      "employeeCode": "EMP-0001",
      "department": "Product Engineering",
      "leaveType": "Annual",
      "startDate": "2026-12-01",
      "endDate": "2026-12-03",
      "daysCount": 3.0,
      "isHalfDay": false,
      "reason": "Family vacation to Inle Lake",
      "status": "Pending",
      "appliedOn": "2026-11-23",
      "canDirectApprove": true,
      "isEmergencyOverride": false
    }
  ]
  ```

---

### 4. Submit Leave Request
Submits application. Automatically excludes weekends and Myanmar Gazette holidays from `daysCount`. Increments `pending_days` in `leave_balances`.

- **Route**: `POST /api/leaves`
- **Auth**: Protected
- **Request Body**:
  ```json
  {
    "leaveType": "Annual",
    "startDate": "2026-12-01",
    "endDate": "2026-12-03",
    "isHalfDay": false,
    "reason": "Family vacation to Inle Lake",
    "attachmentUrl": null
  }
  ```
- **Response `201 Created`**: Returns created request with auto-assigned `approverId = user.managerId`.

---

### 5. Review Leave Request (Direct Line or Option C HR Override)
Approves or rejects leave with Optimistic Concurrency Control.

- **Route**: `PUT /api/leaves/:id/review`
- **Auth**: Protected (`role: 'manager' | 'hr' | 'admin'`)
- **Request Body**:
  ```json
  {
    "action": "Approve",
    "comment": "Approved. Enjoy your trip!",
    "version": 1
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "id": "f5e927ad-8509-462f-9818-a621c518b5ef",
    "code": "LR-410928",
    "version": 2,
    "status": "Approved",
    "managerComment": "Approved. Enjoy your trip!",
    "isEmergencyOverride": false,
    "reviewedBy": "U Kyaw Swar"
  }
  ```
- **Anti-Self-Approval Enforcement `403 Forbidden`**:
  ```json
  {
    "statusCode": 403,
    "error": "Forbidden",
    "message": "Self-approval is strictly prohibited: you cannot review or approve your own leave request."
  }
  ```

---

### 6. Get Leave Audit Trail
Returns tenant-scoped immutable audit log of all leave actions.

- **Route**: `GET /api/leaves/audit-logs`
- **Auth**: Protected (`role: 'admin' | 'manager' | 'hr'`)
- **Response `200 OK`**: Array of audit log events with timestamp and actor names.

---

## 7. Module 5: Payroll & Compensation (`/api/payroll`)

### 1. Get My Payslips Summary
Returns personal historical payslips in MMK currency.

- **Route**: `GET /api/payroll/payslips`
- **Auth**: Protected
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "e2f18370-d128-48b4-8db9-aa924c2db102",
      "month": 10,
      "year": 2026,
      "monthName": "October 2026",
      "payDate": "2026-10-31",
      "grossEarnings": 2500000.0,
      "totalDeductions": 125000.0,
      "netPay": 2375000.0,
      "currency": "MMK",
      "status": "Paid"
    }
  ]
  ```

---

### 2. Get Payslip Detail (IDOR Protected)
Fetches itemized earnings, SSB, income tax, and loan installments. Strictly verified: non-payroll staff can only fetch their own payslip.

- **Route**: `GET /api/payroll/payslips/:id`
- **Auth**: Protected
- **Response `200 OK`**:
  ```json
  {
    "id": "e2f18370-d128-48b4-8db9-aa924c2db102",
    "monthName": "October 2026",
    "payDate": "2026-10-31",
    "grossEarnings": 2500000.0,
    "totalDeductions": 125000.0,
    "netPay": 2375000.0,
    "currency": "MMK",
    "status": "Paid",
    "earnings": [
      { "name": "Base Salary", "amount": 2200000.0, "category": "Earning" },
      { "name": "Technical Allowance", "amount": 300000.0, "category": "Earning" }
    ],
    "deductions": [
      { "name": "Social Security Board (SSB 2%)", "amount": 6000.0, "category": "Deduction" },
      { "name": "Personal Income Tax", "amount": 69000.0, "category": "Deduction" },
      { "name": "Company Laptop Advance", "amount": 50000.0, "category": "Deduction" }
    ],
    "bankName": "KBZ Bank",
    "bankAccountMasked": "•••• •••• •••• 6789"
  }
  ```

---

## 8. Module 6: Expense Claims (`/api/claims`)

### 1. List Expense Claims
Returns expense reimbursement requests. Staff view their own; managers/payroll view all within org.

- **Route**: `GET /api/claims`
- **Auth**: Protected
- **Query Parameters**: `status` (`'Submitted' | 'Approved' | 'Rejected' | 'Reimbursed'`).

---

### 2. Submit Expense Claim
Submits an expense reimbursement claim in MMK.

- **Route**: `POST /api/claims`
- **Auth**: Protected
- **Request Body**:
  ```json
  {
    "title": "Client Lunch at Sedona Hotel",
    "category": "Meals",
    "amount": 85000.00,
    "expenseDate": "2026-11-20",
    "receiptUrl": "https://storage.omnihr.internal/receipts/rec-8821.jpg",
    "notes": "Hosted delegation from Mandalay regional office"
  }
  ```
- **Response `201 Created`**: Returns created claim with `status: 'Submitted'`.

---

### 3. Review Expense Claim
Approves, rejects, or marks claim reimbursed.

- **Route**: `PUT /api/claims/:id/review`
- **Auth**: Protected (`role: 'admin' | 'hr' | 'manager' | 'payroll'`)
- **Request Body**:
  ```json
  {
    "status": "Approved",
    "notes": "Verified against attached tax receipt"
  }
  ```
- **Response `200 OK`**: Returns updated claim DTO.

---

## 9. Module 7: Corporate Directives & Announcements (`/api/announcements`)

### 1. List Published Announcements
Returns company-wide directives with per-user read receipt flags (`isRead: true | false`).

- **Route**: `GET /api/announcements`
- **Auth**: Optional / Authenticated
- **Response `200 OK`**:
  ```json
  [
    {
      "id": "a189f72b-8c81-42cb-b930-b384fcb91e92",
      "authorityGroup": "Office of the Managing Director",
      "authorityCode": "MD",
      "directiveNo": "DIR-2026-004",
      "title": "Thingyan Water Festival Holiday Roster & Emergency Coverage",
      "summary": "Official holiday dates and on-call engineering schedules for April 2026.",
      "fullBody": "Full directive text...",
      "date": "15 Nov 2026",
      "issuer": "U Thura (Managing Director)",
      "priority": "Urgent",
      "isRead": true
    }
  ]
  ```

---

### 2. Mark Announcement as Read
Records employee read acknowledgment timestamp in `announcement_reads`.

- **Route**: `POST /api/announcements/:id/read`
- **Auth**: Protected
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Announcement marked as read"
  }
  ```

---

## 10. Module 8: SaaS Platform Administration (`/api/platform`)

> **Access Control**: Strictly restricted to Global Platform SuperAdmin (`role: 'superadmin'`, `orgId = null`). All endpoints enforce preHandler authorization.

### 1. Platform Metrics Overview
- **Route**: `GET /api/platform/metrics`
- **Response `200 OK`**:
  ```json
  {
    "totalOrganizations": 12,
    "activeOrganizations": 11,
    "suspendedOrganizations": 1,
    "totalUsers": 348,
    "activeUsers": 342
  }
  ```

---

### 2. List All Tenants
- **Route**: `GET /api/platform/organizations`
- **Response `200 OK`**: Array of tenant organizations with user counts and plans.

---

### 3. Provision New Tenant Organization
- **Route**: `POST /api/platform/organizations`
- **Request Body**:
  ```json
  {
    "orgName": "Mandalay Logistics Corp",
    "orgCode": "MDY-LOG",
    "adminName": "Daw Aye Aye",
    "adminEmail": "ayeaye@mdylog.com",
    "plan": "enterprise",
    "maxEmployees": 250,
    "officeName": "Mandalay Hub",
    "officeLat": "21.9750000",
    "officeLng": "96.0836000",
    "officeRadius": 250
  }
  ```
- **Response `201 Created`**: Returns created organization and temporary admin password.

---

### 4. Suspend or Reactivate Tenant
When suspended, all user refresh tokens for the tenant are deleted immediately.

- **Route**: `PATCH /api/platform/organizations/:id/status`
- **Request Body**:
  ```json
  {
    "status": "suspended",
    "version": 1
  }
  ```
- **Response `200 OK`**: Returns updated organization state with `version: 2`.

---

### 5. Emergency Tenant Admin Password Reset
Generates a secure temporary password and invalidates prior sessions for the tenant's primary admin.

- **Route**: `POST /api/platform/organizations/:id/reset-admin-password`
- **Response `200 OK`**: Returns new temporary password.

---

## 11. Module 9: Dynamic Roles & Permissions (`/api/roles` & `/api/permissions`)

### 1. Get Permission Catalogue
Returns all system permissions grouped by domain module (`employees`, `attendance`, `leaves`, `payroll`, `claims`, `roles`, `announcements`).

- **Route**: `GET /api/permissions` (Also aliases `GET /api/roles/permissions`)
- **Auth**: Protected
- **Response `200 OK`**: Returns permissions dictionary.

---

### 2. List Organization Roles
Returns organization custom roles and system defaults with attached permissions and user counts.

- **Route**: `GET /api/roles`
- **Auth**: Protected
- **Response `200 OK`**:
  ```json
  {
    "count": 4,
    "roles": [
      {
        "id": "d1e7c930-b991-4c1d-84e2-63b72c918201",
        "name": "Field Engineering Lead",
        "description": "Leads field teams with attendance and leave review authority",
        "isSystemDefault": false,
        "permissions": [
          "attendance:view",
          "attendance:punch",
          "attendance:approve",
          "leaves:view",
          "leaves:apply",
          "leaves:approve"
        ],
        "userCount": 4
      }
    ]
  }
  ```

---

### 3. Create Custom Role
Atomically inserts a new role and maps permission codes.

- **Route**: `POST /api/roles`
- **Auth**: Protected (`role: 'admin'`)
- **Request Body**:
  ```json
  {
    "name": "Regional Operations Auditor",
    "description": "Audits leaves and attendance without modification access",
    "permissions": [
      "employees:view",
      "attendance:view",
      "leaves:view"
    ]
  }
  ```
- **Response `201 Created`**: Returns created role with assigned permissions.

---

### 4. Update Role Permissions
Updates role metadata and synchronizes permission associations.

- **Route**: `PUT /api/roles/:id`
- **Auth**: Protected (`role: 'admin'`)

---

### 5. Delete Custom Role
Safely unassigns users (`users.roleId = null`) and deletes custom role. System default roles cannot be deleted.

- **Route**: `DELETE /api/roles/:id`
- **Auth**: Protected (`role: 'admin'`)
- **Response `200 OK`**:
  ```json
  {
    "message": "Role deleted successfully",
    "roleId": "d1e7c930-b991-4c1d-84e2-63b72c918201"
  }
  ```
