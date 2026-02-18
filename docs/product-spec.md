# Extrapl — Technical Product Specification

**Version:** 1.0
**Date:** 16 February 2026
**Status:** ISO 27001 & AWS Migration — Implementation Complete, Deployment Pending

---

## 1. Product Overview

Extrapl is a multi-tenant SaaS platform for AI-powered document data extraction. Organizations ingest data from emails, attachments, PDFs, Word docs, and Excel files. The platform uses Google Gemini to extract structured data, validate it against configurable schemas, and route it through customizable workflows (info pages, data lists, kanban boards).

### Core Capabilities

| Capability | Description |
|---|---|
| **Email ingestion** | AgentMail or IMAP inbox per project. Incoming emails are parsed, attachments extracted, and sessions created automatically. |
| **Document processing** | PDF, DOCX, XLSX upload via presigned URLs. Text extraction with poppler (PDF) and openpyxl (Excel). |
| **AI extraction** | Gemini 2.0 Flash extracts structured data against user-defined schemas. Returns values with confidence scores, reasoning, and document source references. |
| **Configurable workflows** | Three step types — info pages (key-value), data lists (tabular), kanban boards (task tracking). Each step has typed fields (TEXT, NUMBER, DATE, CHOICE). |
| **Custom AI tools** | Users create reusable extraction tools: pure AI prompts, Python functions, database lookups, or data source dropdowns. Tools chain via `@references` in input parameters. |
| **Knowledge base** | Upload reference documents that provide context to the AI during extraction (e.g. classification tables, policy definitions). |
| **Extraction rules** | Named rules that guide AI behaviour for specific fields. |
| **Multi-tenancy** | Organization-based isolation with subdomain routing (`org.extrapl.io`). Users can belong to multiple organizations with role-based access (admin/user). |
| **Session linking** | Sessions can be linked for similarity analysis and gap detection across submissions. |

---

## 2. Architecture

### Current State (Replit)

```
Client (React 18 / Vite)
  └─ Express.js API (TypeScript, port 5000)
       ├─ Neon Serverless PostgreSQL (Drizzle ORM)
       ├─ Google Cloud Storage (Replit sidecar)
       ├─ Google Gemini API
       └─ Python 3.11 subprocess (code tools)
```

### Target State (AWS)

```
Route 53 → ALB (HTTPS/TLS) → ECS Fargate (auto-scale 2–10)
                                 ├─ RDS PostgreSQL 16 (Multi-AZ, KMS encrypted)
                                 ├─ S3 (KMS encrypted, versioned, lifecycle tiering)
                                 ├─ Google Gemini API
                                 ├─ Python 3.11 (in-container)
                                 ├─ Secrets Manager
                                 └─ CloudWatch (structured JSON logs)

WAF ──► ALB (rate limiting, OWASP managed rules)
CloudTrail / GuardDuty / SecurityHub / AWS Config
```

### Key Design Decisions

1. **Dual database driver** — `DB_DRIVER=neon` for backwards compatibility on Replit, `DB_DRIVER=pg` for AWS RDS. Same Drizzle ORM schema, different connection layer. No application code changes needed.
2. **S3 module mirrors GCS interface** — `ObjectStorageService` class in `server/s3.ts` exposes the same methods as the existing `objectStorage.ts`. Routes can be swapped with a single import change.
3. **Frontend is unchanged** — All modifications are backend and infrastructure. The React app, Radix UI components, routing, and API contracts remain identical.
4. **Non-root container** — Dockerfile creates a dedicated `extrapl` user. No processes run as root in production.

---

## 3. Tech Stack

### Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, Python 3.11 |
| Framework | Express.js (TypeScript) |
| ORM | Drizzle ORM 0.39 |
| Database | PostgreSQL 16 (Neon serverless or AWS RDS) |
| Object storage | AWS S3 (replaces GCS) |
| AI | Google Gemini 2.0 Flash (`@google/genai`) |
| Auth | JWT (15-min access tokens) + refresh token rotation, bcrypt 12 rounds |
| Encryption | AES-256-GCM (credentials at rest), KMS (storage/database at rest) |

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 18.3 + TypeScript 5.6 |
| Build | Vite 5.4 |
| Routing | Wouter 3.3 |
| UI components | Radix UI (40+ primitives) |
| Styling | Tailwind CSS 3.4 |
| State | TanStack React Query 5.60 |
| Forms | react-hook-form 7.55 + Zod 3.24 |
| File upload | Uppy (S3 presigned URLs) |
| DnD | react-beautiful-dnd |
| Charts | Recharts 2.15 |

### Infrastructure

| Layer | Technology |
|---|---|
| Container | Docker (multi-stage: node + python) |
| Orchestration | ECS Fargate (auto-scaling) |
| Load balancer | ALB with HTTPS termination |
| DNS/TLS | Route 53 + ACM |
| Firewall | AWS WAF (rate limiting, OWASP rules) |
| IaC | Terraform (10 modules, ~38 files) |
| CI/CD | GitHub Actions (4 workflows) |
| Secrets | AWS Secrets Manager |
| Monitoring | CloudWatch, CloudTrail, GuardDuty, SecurityHub |
| Encryption | AWS KMS (5 keys: ECR, S3, RDS, CloudWatch, Secrets) |

---

## 4. Database Schema (38 tables)

### Core Domain

| Table | Purpose |
|---|---|
| `organizations` | Tenant isolation. UUID PK, name, subdomain, type (primary/standard). |
| `users` | Accounts. Email, passwordHash, role (admin/user), MFA support (mfaSecret, mfaEnabled). |
| `userOrganizations` | Multi-org membership. Junction table with per-org role. |
| `projects` | Top-level container. Inbox config (AgentMail/IMAP), required doc types, email templates, workflow status config. |
| `workflowSteps` | Configurable steps: page (info), list (tabular), kanban (board). Ordered, with identifier reference. |
| `stepValues` | Fields within steps. Typed (TEXT/NUMBER/DATE/CHOICE). Can reference AI tools via `toolId` + `inputValues`. |

### Document Processing

| Table | Purpose |
|---|---|
| `extractionSessions` | Processing sessions. Status lifecycle: in_progress → completed → verified. Stores extracted JSON and token counts. |
| `sessionDocuments` | Uploaded files. Tracks fileName, mimeType, extractedContent. |
| `fieldValidations` | Per-field extraction results. Confidence score (0–100), AI reasoning, validation status, document source. |
| `processedEmails` | Email deduplication. Tracks messageId, subject, sender, linked session. |

### Kanban & Collaboration

| Table | Purpose |
|---|---|
| `kanbanCards` | Cards on board steps. Status, field values, AI-generated flag, assignees. |
| `kanbanChecklistItems` | Checklists within cards. |
| `kanbanComments` | Card-level discussion thread. |
| `kanbanAttachments` | Files on cards/comments. |

### AI & Tools

| Table | Purpose |
|---|---|
| `excelWizardryFunctions` | Reusable tools. Four types: AI_ONLY, CODE (Python), DATABASE_LOOKUP, DATASOURCE_DROPDOWN. Configurable inputs, model selection. |
| `knowledgeDocuments` | Reference docs providing extraction context. |
| `extractionRules` | Named rules guiding AI for specific fields. |
| `apiDataSources` | External API connectors for lookup tools. Auth types: none, bearer, basic, api_key. |
| `chatMessages` | Per-session AI assistant conversation. |

### Security & Compliance (new)

| Table | Purpose |
|---|---|
| `refreshTokens` | Refresh token rotation. SHA-256 hashed, 7-day expiry, revocation chain. |
| `auditLogs` | Security event trail. 40+ action types, outcome (success/failure/denied), IP, user agent. |

---

## 5. API Surface

**172 REST endpoints** under `/api/`. Key groups:

| Group | Endpoints | Notes |
|---|---|---|
| Auth | 4 | Login, me, reset-password, change-password. Refresh token endpoint pending. |
| Organizations | 5 | CRUD + member management. |
| Projects | 12 | CRUD, duplicate, generate-schema, import-tools. |
| Inbox | 6 | Configure, process, list messages, test IMAP/SMTP. |
| Workflow steps | 8 | CRUD for steps and values. |
| Sessions | 10 | CRUD, document upload, extraction, direct Excel data. |
| Field validations | 4 | Get, update, bulk update. |
| Kanban | 12 | Cards, checklists, comments, attachments. |
| AI tools | 8 | CRUD, test, execute. |
| Knowledge | 4 | Upload, list, reprocess, delete. |
| Rules | 4 | CRUD. |
| Data sources | 5 | CRUD, fetch data. |
| Dashboard | 1 | Statistics. |

**Rate limits:** 200 req/15min general, 50 req/15min auth.
**Body limit:** 10 MB (documents use presigned URL upload).
**Request timeout:** 120s default, 300s for AI operations.

---

## 6. Security Posture (ISO 27001)

### Application-Level Controls

| Control | Implementation |
|---|---|
| A.9.1 Access control | JWT with 15-min expiry, refresh token rotation, bcrypt-12, RBAC (admin/user), multi-tenant isolation |
| A.9.4 MFA | Schema ready (mfaSecret, mfaEnabled on users table, `otpauth` package added). Endpoint implementation pending. |
| A.10.1 Encryption | AES-256-GCM for credentials at rest. KMS for S3, RDS, ECR, CloudWatch, Secrets Manager. TLS in transit (ALB + HSTS). |
| A.12.4 Logging | Structured JSON audit logs. 40+ event types. CloudWatch with 365-day retention. |
| A.14.1 Secure development | Helmet CSP, CORS restricted to *.extrapl.io, HSTS (1yr, preload), X-Content-Type-Options, debug routes blocked in prod. |
| A.14.2 Security testing | Semgrep SAST in CI, npm audit, Trivy container scanning, weekly CodeQL. |

### Infrastructure-Level Controls

| Control | Implementation |
|---|---|
| Network | VPC with public/private/isolated subnets. ECS in private, RDS in isolated. NAT gateways + VPC endpoints. |
| WAF | AWS managed rules (SQL injection, XSS, known bad inputs), rate limiting. |
| Encryption at rest | KMS keys for all data stores. RDS storage encryption, S3 SSE-KMS, ECR image encryption. |
| Backup | RDS automated backups (30-day retention), S3 versioning, lifecycle to Glacier. |
| Monitoring | CloudTrail, GuardDuty, SecurityHub, AWS Config, CloudWatch alarms (CPU, memory, 5xx). |
| Secrets | Secrets Manager with rotation support. No hardcoded secrets anywhere. |

### ISMS Documentation (10 policies)

1. Information Security Policy
2. Risk Assessment Methodology
3. Access Control Policy
4. Incident Response Plan
5. Business Continuity Plan
6. Change Management Procedure
7. Data Classification Policy
8. Data Retention Policy
9. Supplier Management Policy
10. Internal Audit Program

---

## 7. Infrastructure as Code

### Terraform Modules

| Module | Resources |
|---|---|
| `kms` | 5 KMS keys (ECR, S3, RDS, CloudWatch, Secrets Manager) with key policies and aliases |
| `vpc` | VPC, 3 subnet tiers, NAT gateways (1 staging / multi-AZ prod), VPC endpoints for S3/ECR/Secrets |
| `dns` | Route 53 hosted zone, ACM certificate with DNS validation, wildcard support |
| `ecr` | Container registry with KMS encryption, image scanning, lifecycle policy |
| `secrets` | Secrets Manager entries for DB credentials, JWT secret, encryption keys, API keys |
| `s3` | Documents bucket (versioned, lifecycle tiering), access logs bucket |
| `alb` | Application Load Balancer, HTTPS listener, health checks, access logging |
| `ecs` | Fargate cluster, task definition, auto-scaling service (CPU + memory targets), Container Insights |
| `rds` | PostgreSQL 16, Multi-AZ (prod), KMS encryption, 30-day backups, parameter group |
| `waf` | Rate limiting, AWS managed rule groups (SQLi, XSS, known bad inputs), geo-blocking ready |
| `security` | CloudWatch alarms, GuardDuty, SNS alerting |

**State backend:** S3 + DynamoDB locking.
**Environments:** Staging and production via `terraform.workspace`.

---

## 8. CI/CD Pipelines

| Workflow | Trigger | What it does |
|---|---|---|
| **ci.yml** | PR to `main` | TypeScript check, ESLint, Semgrep SAST, npm audit, Docker build test, Terraform plan |
| **deploy-staging.yml** | Push to `main` | Build → push to ECR → Terraform apply (staging) → ECS deploy → smoke test |
| **deploy-prod.yml** | Manual (requires typing "production") | Promote staging image → Terraform apply (prod) → ECS deploy → smoke test → Slack notify |
| **security-scan.yml** | Weekly cron | CodeQL, Trivy container scan, npm audit |

**Authentication:** OIDC to AWS (no long-lived credentials in GitHub).
**Dependency management:** Dependabot for npm, Docker, GitHub Actions (weekly).

---

## 9. Estimated AWS Costs

| Resource | Staging | Production |
|---|---|---|
| ECS Fargate (2 tasks) | ~$75/mo | ~$150/mo |
| RDS PostgreSQL (db.t4g.medium) | ~$65/mo | ~$130/mo (Multi-AZ) |
| ALB | ~$25/mo | ~$25/mo |
| S3 + data transfer | ~$15/mo | ~$30/mo |
| NAT Gateway | ~$35/mo | ~$70/mo |
| WAF | ~$10/mo | ~$10/mo |
| CloudWatch / misc | ~$10/mo | ~$15/mo |
| **Subtotal** | **~$235/mo** | **~$430/mo** |

**Combined estimate: ~$665/month** for both environments.

Optimization paths: Reserved instances for RDS (-40%), Fargate Spot for staging (-70%), single NAT gateway in staging (already configured), S3 Intelligent-Tiering.

---

## 10. Remaining Work

### Code Changes (before first deployment)

| Task | Priority | Effort |
|---|---|---|
| Add refresh token endpoint (`POST /api/auth/refresh`) | High | ~2 hours |
| Add MFA setup/verify endpoints | High | ~4 hours |
| Update route imports from `./objectStorage` to `./s3` (conditional) | High | ~1 hour |
| Add health check endpoints (`/api/health/ready`, `/api/health/live`) | High | ~30 min |
| Run `npm install` and verify build | High | ~15 min |
| Database migration (Drizzle push for new tables) | High | ~30 min |

### Infrastructure Setup (sequential)

| Step | Owner | Dependency |
|---|---|---|
| Create AWS account + enable MFA | You | None |
| Create IAM admin user | You | AWS account |
| Bootstrap Terraform state (S3 + DynamoDB) | You / me | IAM user |
| `terraform init && terraform plan` (staging) | Me | State backend |
| `terraform apply` (staging) | You (approve) | Plan review |
| Set secrets in Secrets Manager | You | Infrastructure up |
| Build & push Docker image to ECR | CI/CD | ECR created |
| Run Drizzle migration against RDS | Me | RDS created |
| Migrate data from Neon → RDS | Me | Migration tested |
| DNS cutover (Route 53) | You | ALB healthy |
| `terraform apply` (production) | You (approve) | Staging validated |

### Compliance (post-deployment)

| Task | Owner |
|---|---|
| Fill org-specific details in ISMS policy templates | You |
| Conduct initial risk assessment | You + security lead |
| Penetration test against staging | External vendor |
| Internal audit (per internal-audit-program.md) | You |
| Management review meeting | Leadership |
| Engage ISO 27001 certification body | You |

---

## 11. File Inventory

### New Files (58)

```
Dockerfile                              # Multi-stage ECS Fargate build
.dockerignore                           # Excludes dev files from image
server/encryption.ts                    # AES-256-GCM credential encryption
server/audit.ts                         # ISO 27001 A.12.4 audit logging
server/s3.ts                            # AWS S3 storage (replaces GCS)
terraform/                              # 38 files across 10 modules + root
.github/workflows/ci.yml               # PR validation pipeline
.github/workflows/deploy-staging.yml    # Staging auto-deploy
.github/workflows/deploy-prod.yml       # Production manual deploy
.github/workflows/security-scan.yml     # Weekly security scanning
.github/dependabot.yml                  # Dependency update automation
docs/isms/                              # 10 ISO 27001 policy documents
```

### Modified Files (6)

```
package.json        # +5 deps (AWS SDK, pg, otpauth)
server/auth.ts      # 15-min tokens, refresh rotation, no fallback secrets
server/db.ts        # Dual driver (Neon/pg)
server/index.ts     # CSP, HSTS, CORS, body limits, graceful shutdown
server/logger.ts    # Structured JSON for CloudWatch
shared/schema.ts    # +refreshTokens, +auditLogs tables, +MFA columns
```
