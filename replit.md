# extrapl - AI-Powered Document Data Extraction Platform

## Overview
extrapl is an AI-powered document data extraction platform designed for legal and business documents. It aims to streamline data extraction, offer enhanced conflict detection, and provide collaborative workspaces. The platform allows users to configure extraction schemas, upload documents, and review AI-analyzed data with knowledge-based validation, significantly improving accuracy and reducing manual effort. Its business vision is to become the leading solution for automated, intelligent document data extraction in specialized domains.

## User Preferences
- **Communication style**: Simple, everyday language
- **UI/UX approach**: Clean, professional interface with slate blue (#4F63A4) theming
- **Development philosophy**: Architecture-first, no patchy workarounds

## System Architecture

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
*   **Kanban Board Feature**: Introduced a "kanban" step type with dedicated database tables (`kanban_cards`, `kanban_checklist_items`, etc.) and a `KanbanBoard.tsx` component for drag-and-drop management. AI integration supports task generation.
*   **Analytics Pane Feature**: An analytics pane within the project overview uses AI to generate charts (pie/bar) from extracted data, leveraging Recharts for visualization.
*   **Session Linking Feature**: Automatically scans previous sessions for similar content using AI and offers to copy relevant tasks to new sessions, including gap analysis.
*   **Email-to-Session Feature**: Allows projects to have unique email inboxes to receive documents, which are then processed to create new sessions. Includes auto-reply functionality that validates attachments against required document types and sends AI-generated responses (rejection with guidance if documents missing, confirmation if accepted).
*   **Document Validation Feature**: AI-powered validation checks if uploaded documents match expected document type descriptions during session creation.

### Database Schema
Key tables include `workflow_steps` (defining steps), `step_values` (defining fields/columns), `field_validations` (storing extracted data), `kanban_cards` (for tasks), `kanban_checklist_items`, `kanban_comments`, `kanban_attachments`, and `processed_emails` (for tracking inbound emails).

## External Dependencies
*   **Database**: PostgreSQL (Neon)
*   **AI Service**: Google Gemini API
*   **Frontend Libraries**: React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter, React Hook Form, Zod.
*   **Backend Libraries**: Node.js, Express, Drizzle ORM.
*   **Python Services**: For PDF/Excel document processing.
*   **Session Management**: `connect-pg-simple`.