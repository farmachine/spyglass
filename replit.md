# extrapl - AI-Powered Document Data Extraction Platform

## Overview
extrapl is an AI-powered document data extraction platform designed for legal and business documents. It aims to streamline data extraction, offer enhanced conflict detection, and provide collaborative workspaces. The platform allows users to configure extraction schemas, upload documents, and review AI-analyzed data with knowledge-based validation, significantly improving accuracy and reducing manual effort. Its business vision is to become the leading solution for automated, intelligent document data extraction in specialized domains.

## User Preferences
- **Communication style**: Simple, everyday language
- **UI/UX approach**: Clean, professional interface with slate blue (#4F63A4) theming
- **Development philosophy**: Architecture-first, no patchy workarounds

## System Architecture

### Multi-Tenancy Architecture
**Organizations are Tenants**: In this system, "organizations" represent isolated tenants with strict data boundaries:
- Each organization has its own projects, users, and data that cannot be accessed by other organizations
- Subdomain-based routing provides tenant identification (e.g., `acme.extrapl.com`)
- The `authenticateToken` middleware enforces tenant validation on all authenticated routes
- Projects can only be created and accessed within a tenant's subdomain context
- Primary organization admins have system-wide visibility for administrative purposes

**Security Enforcement**:
- Tenant validation is integrated into authentication middleware
- Cross-tenant access attempts return 403 TENANT_MISMATCH errors
- Environment variables `BASE_DOMAIN` (server) and `VITE_BASE_DOMAIN` (client) configure subdomain routing

### Core Architecture Principles
The system uses strict architectural principles including identifier-based data mapping with UUIDs, tool-based extraction where each value is tied to a single, configuration-driven tool, and clear distinctions between multi-field (Info Page Steps) and single-field (Data Table Steps) extraction. It maintains data flow integrity using `orderIndex` and employs a unified database architecture where schema fields and collections are treated as "steps" with "values."

### Data Extraction Pipeline
The core pipeline involves Document Upload -> Tool Selection -> Extraction Engine -> AI/Function Processing -> Validation Storage -> UI Display, supported by Tool Configuration, Previous Data, and Knowledge Documents.

### Key Components
*   **Tool Engine**: Orchestrates extraction, prepares inputs, and routes to appropriate extraction methods.
*   **Extraction Wizardry (Python)**: A unified Python system for both AI-powered and function-based extraction, handling result mapping and multi-field extraction.
*   **Storage Layer**: Manages database operations, data persistence, UUID generation, and `orderIndex` preservation.
*   **Session View**: The main UI for extraction sessions, managing workflows, validation display, and data table rendering, relying on `identifierId` for data lookups.

### Critical Data Structures
*   **FieldValidation**: Represents an extracted data point.
*   **ExtractionRequest**: Contains parameters for an extraction job, including `__infoPageFields` for multi-field handling.

### Data Flow Preservation
The system ensures data chain integrity for multi-column extraction by building comprehensive `previousData` in `routes.ts`, preserving it in `toolEngine.ts`, and providing the full data context to the Python extraction processor for UPDATE operations.

### Batch Processing System
The platform supports batch extraction for AI tools, processing large datasets in 50-record batches. The frontend and backend collaborate to filter and limit unvalidated records for efficient user workflow.

### Tool Architecture: Identifier Array Handling
Both AI and Code tools consistently support identifier arrays for UPDATE operations. Reference data (read-only) is used for context, while update data is modified to extract new values, always preserving `identifierId`.

### UI/UX Architecture
The design system uses Slate Blue (#4F63A4) as the primary color, features comprehensive dark mode theming, and manages loading states with an overlay. Components include modals, fixed-width tables, and forms built with React Hook Form and Zod.

### Technical Stack
*   **Frontend**: React 18, TypeScript, Tailwind CSS with shadcn/ui, TanStack Query v5, Wouter, React Hook Form with Zod.
*   **Backend**: Node.js with Express, TypeScript (ESM modules), PostgreSQL with Drizzle ORM, Google Gemini API, Python services, `connect-pg-simple`.
*   **Infrastructure**: Deployed on Replit, database on Neon (PostgreSQL), NixOS.

### Feature Specifications
*   **Subdomain Multi-Tenancy**: Organizations can be configured with unique subdomains (e.g., `acme.yourapp.com`). The system extracts subdomains from request host headers, validates user access, and redirects users to their organization's subdomain after login. Admin UI available at Organization Settings to configure subdomains. Environment variable `BASE_DOMAIN` configures the base domain for subdomain routing, and `VITE_BASE_DOMAIN` for frontend redirection.
*   **Kanban Board Feature**: Introduced a "kanban" step type with dedicated database tables (`kanban_cards`, `kanban_checklist_items`, etc.) and a `KanbanBoard.tsx` component for drag-and-drop management. AI integration supports task generation.
*   **Analytics Pane Feature**: An analytics pane within the project overview uses AI to generate charts (pie/bar) from extracted data, leveraging Recharts for visualization.
*   **Session Linking Feature**: Automatically scans previous sessions for similar content using AI and offers to copy relevant tasks to new sessions, including gap analysis. Uses main object name (e.g., "link tender") instead of generic "link session".
*   **Email-to-Session Feature**: Allows projects to have unique email inboxes to receive documents, which are then processed to create new sessions. Supports two inbox types: (1) Auto-generated `@extrapl.io` inboxes via AgentMail API with webhooks, and (2) Custom IMAP/SMTP mailbox connections for bring-your-own-email (Gmail, Outlook, etc.). Both types support the same session creation and attachment processing pipeline. Includes auto-reply functionality that validates attachments against required document types and sends AI-generated responses (rejection with guidance if documents missing, confirmation if accepted). Supports custom HTML email templates with placeholders ({{subject}}, {{body}}, {{projectName}}, {{senderEmail}}). IMAP/SMTP credentials are stored in the projects table. IMAP service uses `imap` + `mailparser` packages, SMTP uses `nodemailer`.
*   **Document Validation Feature**: AI-powered validation checks if uploaded documents match expected document type descriptions during session creation.
*   **Workflow Status Feature**: Projects can define workflow status options (e.g., "New", "In Progress", "Complete") with a configurable default status. Sessions display a status chain in the header showing progression: green for past statuses, purple (#4F63A4) for current, grey for future. The status chain replaces the traditional statistics cards when workflow statuses are configured.
*   **Step Actions Feature**: Info Page and Data Table steps can have an optional action button that triggers a workflow status change. Configuration includes:
    - `actionName`: Button label (e.g., "Submit", "Approve", "Complete")
    - `actionStatus`: The status to set when the action is clicked
    - `actionLink` (optional): URL to open, supporting `{{Field Name}}` placeholders for field value substitution
    When an action is configured on a step, no additional values can be added to that step (enforced in UI). The action button appears at the bottom of the step card in SessionView.

### Database Schema
Key tables include `workflow_steps` (defining steps), `step_values` (defining fields/columns), `field_validations` (storing extracted data), `kanban_cards` (for tasks), `kanban_checklist_items`, `kanban_comments`, `kanban_attachments`, and `processed_emails` (for tracking inbound emails).

## External Dependencies
*   **Database**: PostgreSQL (Neon)
*   **AI Service**: Google Gemini API
*   **Frontend Libraries**: React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter, React Hook Form, Zod.
*   **Backend Libraries**: Node.js, Express, Drizzle ORM.
*   **Python Services**: For PDF/Excel document processing.
*   **Session Management**: `connect-pg-simple`.