# Database Schema & Relational Models

Control Center uses PostgreSQL 16 managed via Prisma ORM (`apps/api/prisma/schema.prisma`).

## 1. Connection Strings & Engines

- **Directus CMS Database**: `postgresql://cms:${POSTGRES_PASSWORD}@cms-postgres-1:5432/cms`
- **Control Center Database**: `postgresql://control:${POSTGRES_PASSWORD}@control-center-postgres-1:5432/control`
- **Adapter**: `@prisma/adapter-pg` with native connection pooling.

## 2. Core Models

### `Lead` (B2B Prospecting & Sales)
Stores business entities discovered via Google Maps intelligence and tracks outreach lifecycle.

```prisma
enum LeadStatus {
  discovered   // Scraped from Google Maps, pending contact review
  enriched     // Additional contact info (email, Instagram) gathered
  contacted    // Message sent via WhatsApp or email
  replied      // Prospect answered or showed interest
  converted    // Deal closed / Client website acquired
  discarded    // Not interested or out of scope
}

model Lead {
  id             String      @id @default(uuid()) @db.Uuid
  name           String
  query          String      // e.g. "Gyms & Crossfit Centers en Palermo, CABA"
  category       String      // Niche identifier
  city           String      // Geographical area
  address        String      // Street address
  rating         Float?      // Google Maps stars (e.g. 4.8)
  reviewsCount   Int         @default(0)
  phone          String?     // Raw telephone from Google Maps
  phoneFormatted String?     // Normalized E.164 (+54 9 ...)
  email          String?     // Enriched business email
  website        String?     // Official domain or null
  instagram      String?     // Instagram profile link
  facebook       String?     // Facebook page link
  hasWebsite     Boolean     @default(false)
  status         LeadStatus  @default(discovered)
  suggestedDemo  String?     // Pre-matched Vercel demo link
  notes          String      @default("")
  metadata       Json        @default("{}") // Stores sourceUrl with exact place_id
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  contactedAt    DateTime?   // Timestamp of initial dispatch

  @@index([status])
  @@index([category, city])
  @@index([hasWebsite])
}
```

### `Monitor` & `Result` (Uptime & Performance)
Tracks monitored endpoints, HTTP health status, response latencies, and TLS expiration.

```prisma
enum CheckStatus {
  up
  down
  degraded
  maintenance
}

model Monitor {
  id          String      @id @default(uuid()) @db.Uuid
  name        String
  url         String
  type        String      // "http", "tcp", "ssl"
  intervalSec Int         @default(60)
  status      CheckStatus @default(up)
  results     Result[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model Result {
  id         String      @id @default(uuid()) @db.Uuid
  monitorId  String      @db.Uuid
  status     CheckStatus
  durationMs Int
  message    String?
  metrics    Json        @default("{}")
  checkedAt  DateTime    @default(now())
  monitor    Monitor     @relation(fields: [monitorId], references: [id], onDelete: Cascade)

  @@index([monitorId, checkedAt])
}
```

### `User` & `Session` (Auth & Access)
Manages single-tenant and admin session authentication using secure HTTP-only cookies.

```prisma
model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique
  password  String   // Scrypt / Argon2 hash
  role      String   @default("admin")
  createdAt DateTime @default(now())
}
```
