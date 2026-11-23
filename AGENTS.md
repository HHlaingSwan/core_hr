# Agent Guidelines & Operational Rules

## 1. Always Check Current Situation First
- Before proposing changes or editing any component, thoroughly inspect the current implementation, visual layout, and established UI/UX patterns in the codebase.
- Preserve existing interaction paradigms (e.g. icon-only inactive tabs vs text-on-active tabs) unless the user explicitly requests to change them.
- Never make arbitrary assumptions that override intentional design patterns.

## 2. Planning First
- Always operate in Planning Mode first: perform analysis, provide suggestions, and present an implementation plan.
- Do NOT modify codebase files or execute implementation steps until the user explicitly responds with "go", "proceed", or gives clear approval.

## 3. Reuse Existing Documentation & Implementation Files
- Do NOT create multiple or redundant `.md` or `.txt` files for implementation plans, notes, or walkthroughs.
- Always reuse, update, and overwrite existing files (`implementation_plan.md` and `walkthrough.md`) instead of creating new separate files.

## 4. UI/UX & Component Design Standards
- **No Badge Boxes (Use Text Color Only):** Do NOT enclose statuses, states, or category pills in boxed container badges (no `rounded-full bg-*-50 border` wrappers). Use pure typographic colored text (with an optional indicator dot) instead of container boxes.
- **No Close Button in Bottom Sheets:** Do NOT add an `X` / close button in the header of bottom sheets. Bottom sheets must rely strictly on the native swipe-down drag handle / pan gesture and backdrop tap to dismiss.
- **Currency Standard:** Always use `MMK` (Myanmar Kyats) for all monetary values; never use Dollar (`$`).

## 5. Server Architecture & Database Operational Standards
- **SQL Aggregations First:** Never fetch unbounded database tables into Node.js or application memory to run `.filter()`, `.find()`, or `.reduce()`. Always push aggregation and filtering to PostgreSQL using Drizzle SQL operators (`count()`, `sum()`, `avg()`, `case when`) with index-backed date boundaries.
- **Atomic Multi-Table Mutations:** All multi-step write operations across multiple tables must be wrapped in `await db.transaction(async (tx) => { ... })` for automatic rollback on failure.
- **Object-Level Authorization (IDOR Prevention):** Every endpoint accessing an entity by ID must check user ownership (`table.userId === request.user.userId`) unless the caller holds an authorized administrative role.
- **Token Security:** Never store plaintext refresh tokens or credentials in the database; always hash with SHA-256 before storage.
- **Case-Insensitive Search:** Always use `ilike` from `drizzle-orm` for text search fields in PostgreSQL.

## 6. Execution & Operational Boundaries
- **No Automatic Git Commits or Pushes:** Do NOT commit or push changes to git automatically. Keep all changes in the local working tree and only commit/push when the user explicitly requests it.
- **No Automatic Database Execution:** Do NOT run database commands, migrations, seeds, or resets (`npm run db:migrate`, `npm run db:seed`, `drizzle-kit push`, etc.) automatically. Only run database operations when the user explicitly asks for them.
