# Control Center - Monorepo Functions & Handlers Catalog

Canonical AST-derived architectural index of all functions, handlers, Fastify route endpoints, UI components, hooks, and contracts across the `control-center` repository.

## Inventory Overview

- **Total Catalogued Elements**: 626 elements
- **Backend API (`@cc/api`)**: 365 functions and route handlers
- **Frontend Cockpit (`@cc/web`)**: 255 components, hooks, formatters, and page handlers
- **Shared Contracts (`@cc/shared`)**: 5 pure domain utilities and normalization functions
- **Automation Scripts (`scripts/`)**: 1 standalone MCP JSON-RPC protocol server

---

## 1. Backend Core & Services (`apps/api`)

### Fastify Route Endpoints (`apps/api/src/routes/api.ts`, `auth/routes.ts`)
- **GET Endpoints**: `/api/overview`, `/api/targets`, `/api/targets/:id`, `/api/checkers`, `/api/incidents`, `/api/domains`, `/api/databases`, `/api/backups`, `/api/backups/inspect/:filename`, `/api/backups/download/:filename`, `/api/vps/overview`, `/api/vps/docker/containers`, `/api/vps/security`, `/api/vps/security/audit`, `/api/vault/overview`, `/api/vault/export`, `/api/vault/audit`, `/api/vault/diff`, `/api/vault/discover`, `/api/files/list`, `/api/files/read`, `/api/knowledge`, `/api/knowledge/graph`, `/api/knowledge/functions`, `/api/knowledge/*`, `/api/agent/context`, `/api/leads`, `/api/leads/export/csv`, `/api/leads/whatsapp/status`, `/api/leads/whatsapp/qr`, `/api/leads/whatsapp/metrics`, `/api/marketing/overview`, `/api/marketing/drafts`, `/api/marketing/brands`, `/api/marketing/campaigns`, `/api/marketing/scheduler/status`, `/api/promociones/overview`, `/api/promociones/glitches`, `/api/cloudflare/zones`, `/api/cloudflare/dns`, `/api/cloudflare/security`, `/auth/me`.
- **POST Endpoints**: `/api/targets`, `/api/checkers/run`, `/api/backups/run`, `/api/vps/command`, `/api/vps/docker/action`, `/api/vault`, `/api/vault/import`, `/api/vault/deploy`, `/api/vault/config`, `/api/files/write`, `/api/files/entry`, `/api/knowledge/graph/analyze`, `/api/mcp`, `/api/leads/scrape`, `/api/leads/import`, `/api/leads/whatsapp/connect`, `/api/leads/whatsapp/disconnect`, `/api/leads/whatsapp/sync-messages`, `/api/leads/whatsapp/sync-groups`, `/api/leads/whatsapp/send`, `/api/leads/whatsapp/send-bulk`, `/api/leads/whatsapp/outreach`, `/api/marketing/drafts/generate`, `/api/marketing/drafts/batch-generate`, `/api/marketing/campaigns`, `/api/marketing/chat/test`, `/api/cloudflare/dns`, `/api/cloudflare/cache/purge`, `/auth/login`, `/auth/logout`.
- **PATCH / PUT / DELETE Endpoints**: `/api/targets/:id`, `/api/improvements/:id`, `/api/vault/:id`, `/api/files/entry`, `/api/knowledge/*`, `/api/leads/:id`, `/api/marketing/drafts/:id`, `/api/marketing/drafts/:id/approve`, `/api/marketing/brands/:id/integrations`, `/api/cloudflare/dns/:id`, `/api/cloudflare/security`.

### Knowledge Base & MCP Engine (`apps/api/src/knowledge/`)
- `getKnowledgeBaseDir()`: Deterministic root resolution for `knowledge/` directory across local and VPS environments.
- `extractTitle(content)`: Parses markdown H1 heading from raw document string.
- `sanitizeSlug(raw)`: Cleans and validates slug path against directory traversal attacks.
- `listKnowledgeDocs()`: Scans knowledge directory recursively and returns metadata list (`KnowledgeDocMeta[]`).
- `readKnowledgeDoc(slug)`: Loads document content, frontmatter metadata, and mtime.
- `writeKnowledgeDoc(slug, content)`: Atomically updates physical markdown files with parent folder creation.
- `getSystemContext(topics)`: Compiles aggregated system context markdown for LLMs and MCP consumers.
- `handleMcpRequest(req)`: Standard JSON-RPC handler serving tools `list_knowledge_docs`, `read_knowledge_doc`, `get_system_context`, and `save_knowledge_doc`.
- `analyzeControlCenterRepo()`: Analyzes topology, dependencies, nodes, edges, and inter-service flows.
- `getOrRunDailyRepoGraph(forceRefresh)`: Caches daily graph analysis to prevent disk churn.
- `getFunctionsCatalog()`: Serves the full AST-indexed functions catalog for frontend and agents.

### Secrets & Vault Engine (`apps/api/src/vault/`)
- `parseEnvContent(raw)`: Parses `.env` lines preserving comments, empty lines, and quotation rules.
- `findGitRoot(startDir)`: Ascends directory tree to locate `.git` repository boundaries.
- `checkGitSecurity(projectPath)`: Audits `.gitignore` to ensure `.env` is never accidentally tracked.
- `auditProjectEnv(projectPath, envPath)`: Cross-references physical `.env` variables against database records.
- `runSecurityAudit()`: Runs multi-project security scan across known VPS repositories.
- `computeVaultDiff(project)`: Generates line-by-line diff between database Vault secrets and disk files.
- `deployVaultToDisk(project, targetPath)`: Writes atomic `.env` with `.env.backup` timestamp preservation.
- `discoverVpsEnvFiles(rootDirs)`: Discovers unmanaged or orphan `.env` files across `/home/adminnico`.
- `importEnvFromDiskFile(filePath, project)`: Ingests existing `.env` variables into database Vault.
- `getVaultOverview()`: Returns high-level overview of encrypted keys, project counts, and audit status.
- `upsertVaultItem(item)`: Encrypts secret key/value using scrypt-salted cryptographic envelope.
- `deleteVaultItem(id)`: Removes secret item from PostgreSQL store.

### Leads & WhatsApp Pipeline (`apps/api/src/leads/`, `marketing/`)
- `scrapeGoogleMapsPlaces(category, city)`: Queries and extracts business leads from Google Maps feeds.
- `formatArgentinePhone(phone)`: Strips non-digit chars, handles `54`, `0`, and prepends Argentine country codes.
- `enrichLeadSocials(lead)`: Analyzes lead websites for Instagram, Facebook, and WhatsApp links.
- `verifyInstagramProfile(handle)`: Validates Instagram profile existence without triggering anti-scraping bans.
- `generatePersonalizedPitch(lead, niche)`: Formulates targeted AI pitch templates based on business attributes.
- `setPrismaForWhatsApp(prisma)`: Configures database instance for Baileys auth state synchronization.
- `connectToWhatsApp()`: Initializes Baileys multi-device socket connection with QR generation.
- `disconnectWhatsApp()`: Gracefully closes socket and cleans session state.
- `sendWhatsAppMessage(to, message)`: Transmits outbound text message with delivery tracking.
- `sendBulkWhatsAppMessages(recipients, template)`: Batched dispatcher with rate limiting and random jitter.
- `createOutreachQueue()`, `createOutreachWorker()`: BullMQ background queue management for scheduled campaigns.

### Checkers & Monitoring Engine (`apps/api/src/checkers/`)
- `checkWebsite(url, options)`: Performs HTTP/HTTPS health checks, latency measurement, and TLS expiry audit.
- `checkDomainDns(domain)`: Queries DNS records (A, AAAA, MX, NS) and measures propagation.
- `checkDatabase(config)`: Probes PostgreSQL (`SELECT 1`) or Redis (`PING`) with timeout limits.
- `classifyBackup(archiveName)`: Parses timestamp from backup archives and computes retention age.
- `collect(logPath)`: Parses local backup log files and reports archive integrity.
- `statusRank(status)`, `worstStatus(statuses)`: Determines overall system health rank (`ok` < `warn` < `error` < `fail`).

### File Manager & VPS Tools (`apps/api/src/files/`, `vps/`)
- `getFilesRoot()`: Resolves root path restricted to `/home/adminnico`.
- `resolveSafePath(relPath)`: Prevents path traversal vulnerabilities (`..`).
- `listDirectory(dirPath)`: Returns directory listings with permissions, sizes, and file type flags.
- `readFileContent(filePath)`: Reads file contents with safety truncation for binary files.
- `writeFileContent(filePath, content)`: Writes file to disk with atomic replacement.
- `createEntry(targetPath, type)`: Creates new empty file or folder.
- `deleteEntry(targetPath)`: Deletes file or directory recursively.

---

## 2. Frontend Cockpit & UI (`apps/web`)

### Centralized API Client (`apps/web/src/api.ts`)
- `request<T>(path, options)`: Type-safe fetch wrapper with JSON serialization, timeout, and 401 handling.
- `overview()`: Fetches global system overview, monitors, incidents, and telemetry.
- `targets()`, `targetCreate()`, `targetUpdate()`, `targetDelete()`: Target CRUD operations.
- `checkersRun()`: Manually triggers checker execution cycle.
- `vpsOverview()`, `vpsCommand()`, `vpsSecurityAudit()`, `vpsSecurityFix()`: VPS host inspection and remediation.
- `vaultOverview()`, `vaultUpsert()`, `vaultDelete()`, `vaultDeploy()`: Secrets Vault management.
- `knowledgeList()`, `knowledgeGet()`, `knowledgeSave()`, `knowledgeGraph()`, `knowledgeFunctions()`: Knowledge Base API.
- `leadsList()`, `leadScrape()`, `leadExportCsvUrl()`: Lead discovery and CRM operations.
- `whatsappStatus()`, `whatsappConnect()`, `whatsappDisconnect()`, `whatsappSend()`: WhatsApp Baileys cockpit.

### Custom React Hooks (`apps/web/src/hooks/`)
- `useCopyLlmContext(getText)`: Extracts structured markdown context and handles clipboard writing with UI feedback.
- `useTableSelection<T>()`: Manages row selection sets (`Set<T>`) for bulk operations.
- `useClipboard(timeoutMs)`: Provides copy-to-clipboard state tracking with auto-reset feedback.

### UI Components & Navigation (`apps/web/src/components/`, `router.tsx`)
- `RepoGraphView`: Interactive SVG constellation graph showing services, databases, networks, and flows.
- `ProjectFunctionsView`: Interactive AST functions catalog with multi-module filtering, search, and pagination.
- `VpsSecurity`: Real-time audit visualizer for SSH ports, UFW firewall rules, and container privileges.
- `Router`: Lightweight hash/history router with `navigate()`, `usePath()`, and `Link`.

---

## 3. Shared Contracts (`packages/shared/src/index.ts`)

- `urlOf(target)`: Parses target config and returns standard WHATWG `URL` object.
- `hostOf(target)`: Extracts domain or hostname from target configuration.
- `safeHostOf(target)`: Non-throwing hostname extractor returning `string | null` on invalid targets.
- `statusRank(status)`: Numeric severity rank calculator for check outcomes.
- `worstStatus(statuses)`: Determines highest severity outcome from an array of statuses.

---

## 4. Automation & Integration Scripts (`scripts/`)

- `handleRequest(request)` in `scripts/mcp-server.mjs`: Stdio-based Model Context Protocol listener exposing Control Center knowledge to Claude Desktop, Cursor AI, Antigravity, and autonomous subagents.
