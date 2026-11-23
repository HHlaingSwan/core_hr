# Server Operational & Architectural Guidelines (Fastify + Drizzle)

This is a Fastify Node.js (v25) backend with PostgreSQL 16 and Drizzle ORM.

## Architecture & Conventions
- **Server Framework**: Fastify v5 on port 5050.
- **ORM / Database**: Drizzle ORM with PostgreSQL 16.
- **Statutory Rules**: Myanmar SSB and Personal Income Tax calculation engine.
- **Blueprint Reference**: See `workflow.md` for full database schemas, table relationships, and endpoint specifications.

## Strict Operational Rules
- **SQL Aggregations First**: Never pull unbounded tables into application memory to run `.filter()`, `.find()`, or `.reduce()`. Push aggregation to PostgreSQL using Drizzle SQL operators (`count()`, `sum()`, `avg()`, `case when`).
- **Atomic Multi-Table Mutations**: Wrap multi-step mutations in `await db.transaction(async (tx) => { ... })` for automatic rollback on failure.
- **IDOR Prevention**: Always verify user ownership (`table.userId === request.user.userId`) unless the caller is an authorized administrator.
- **Security**: Hash refresh tokens and credentials with SHA-256 before storing. Never log plain tokens or sensitive credentials.
- **Search**: Always use `ilike` from `drizzle-orm` for text queries in PostgreSQL.
- **Currency**: `MMK` (Myanmar Kyats) is the standard monetary unit; never use Dollar (`$`).
