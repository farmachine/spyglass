# extrapl - AI-Powered Document Data Extraction Platform

## Overview
extrapl is an AI-powered document data extraction platform designed for legal and business documents. Its primary purpose is to streamline data extraction from complex documents, offering enhanced conflict detection and collaborative workspaces. The platform enables users to configure extraction schemas, upload documents, and review AI-analyzed data with knowledge-based validation, significantly reducing manual effort and improving accuracy.

## User Preferences
- **Communication style**: Simple, everyday language
- **UI/UX approach**: Clean, professional interface with slate blue (#4F63A4) theming
- **Development philosophy**: Architecture-first, no patchy workarounds

## System Architecture

### Core Architecture Principles
The system is built on strict architectural principles:
1.  **Identifier-Based Data Mapping**: All data relationships are mapped using UUIDs (`identifierId`) for stability and permanence, never array indices.
2.  **Tool-Based Extraction**: Each extracted value is tied to a single, configuration-driven tool (`toolId`). Tool selection occurs at configuration time, not runtime, ensuring immutability of assigned tools.
3.  **Multi-Field vs Single-Field Extraction**:
    *   **Info Page Steps (Multi-Field)**: A single value can contain multiple fields, extracted in one AI call. Each field receives its own validation record but shares the parent value's UUID as `fieldId`.
    *   **Data Table Steps (Single-Field)**: Each value represents one column, with a direct 1:1 mapping between value and validation.
4.  **Data Flow Integrity**: Data order and relationships are preserved from source document through extraction, storage, and display. The system relies on `orderIndex` from the database for sequencing.
5.  **Unified Database Architecture**: Schema fields and collections are consistently treated as "steps" with "values," ensuring a cohesive data model.

### Data Extraction Pipeline
The core pipeline involves: Document Upload -> Tool Selection -> Extraction Engine -> AI/Function Processing -> Validation Storage -> UI Display. This process is supported by Tool Configuration, Previous Data, and Knowledge Documents.

### Key Components
*   **Tool Engine (`server/toolEngine.ts`)**: Orchestrates extraction, prepares inputs while preserving metadata (`__infoPageFields`), and routes to appropriate extraction methods based on the assigned tool. **UPDATE (Oct 2025)**: Now passes `__infoPageFields` to BOTH AI and Code tools for consistent identifier mapping support.
*   **Extraction Wizardry (`extraction_wizardry.py`)**: A unified Python system for both AI-powered (`extract_with_ai()`) and function-based (`execute_function()`) extraction. It maps results back using provided `identifierId`s and handles multi-field extraction for Info Pages, but does not generate `identifierId`s.
*   **Storage Layer (`server/storage.ts`)**: Manages database operations, persists data, generates UUIDs for first column `identifierId`s, and preserves `orderIndex` for display sequencing.
*   **Session View (`client/src/pages/SessionView.tsx`)**: The main UI for extraction sessions, handling column extraction workflows, field validation display, and data table rendering. It relies on `identifierId` for data lookups and does not re-sort backend-ordered data.

### Critical Data Structures
*   **FieldValidation**: Represents an extracted data point, including `id`, `fieldId`, `identifierId`, `extractedValue`, and `validationStatus`.
*   **ExtractionRequest**: Contains parameters for an extraction job, including `stepId`, `valueId`, `previousData` (with `identifierId`s), and crucially, `__infoPageFields` for multi-field handling.

### Data Flow Preservation
The system maintains data chain integrity for multi-column extraction:
*   **routes.ts** builds comprehensive `previousData` with accumulated column values
*   **toolEngine.ts** preserves this data (does not overwrite with incremental data)
*   **Python extraction processor** receives the full data context for UPDATE operations
*   This ensures each column receives all previous column data in the extraction pipeline

### Batch Processing System (Oct 2025)
**Batch Extraction Workflow**: AI tools now properly process large datasets in 50-record batches:
- **Frontend (`SessionView.tsx:3171`)**: Slices `remainingData` from `extractedCount` and passes ONLY unextracted records to the extraction modal
- **Backend (`routes.ts:7502-7512`)**: Filters records where `validationStatus !== 'valid'` and limits to 50 records per batch
- **User Workflow**: Extract 50 → Validate → Extract next 50 unvalidated → Validate → Extract remaining → Complete
- **Key Fix**: Changed from sending all records to sending only remaining unextracted records

### Tool Architecture: Identifier Array Handling
**UPDATE (Oct 2025)**: Unified identifier array support for both AI and Code tools.

**Identifier Array Format**:
- All UPDATE operations receive data as: `[{"identifierId": "uuid", "Column 1": "val1", "Column 2": "val2"}, ...]`
- Built by `buildIncrementalData()` at line 2256 in toolEngine.ts
- Automatically injected for UPDATE operations at orderIndex > 0

**Reference Data vs Update Data**:
1. **Reference Data (Read-Only)**:
   - Excel/document content, reference documents, text inputs
   - Previous column values embedded in identifier objects
   - Used for LOOKUP, COMPARISON, or CONTEXT only
   - Functions access these for logic but NEVER copy to output

2. **Update Data (To Be Modified)**:
   - Identifier array parameter containing existing records
   - Functions extract NEW values and return with `identifierId` preserved
   - Output format: `{"identifierId": "uuid", "extractedValue": "new_value", "validationStatus": "valid", ...}`
   - Previous column properties are NOT included in output

**Implementation Details**:
- `runToolForExtraction()` passes `__infoPageFields` to BOTH AI and Code tools (server/toolEngine.ts:1612)
- `EXCEL_FUNCTION_GENERATOR` prompt (prompts/all_prompts.py:350-400) provides clear guidance on reference vs update data distinction
- Code tools handle identifier arrays the same way AI tools do for consistency

### UI/UX Architecture
The design system uses Slate Blue (#4F63A4) as the primary color and features comprehensive dark mode theming. Loading states are managed via an overlay with a spinner. Components include modals with collapsible sections, fixed-width tables, and forms built with React Hook Form and Zod validation.

### Technical Stack
*   **Frontend**: React 18, TypeScript, Tailwind CSS with shadcn/ui, TanStack Query v5, Wouter for routing, React Hook Form with Zod.
*   **Backend**: Node.js with Express, TypeScript (ESM modules), PostgreSQL with Drizzle ORM, Google Gemini API for AI integration, Python services for document processing, `connect-pg-simple` for session management.
*   **Infrastructure**: Deployed on Replit, database hosted on Neon (PostgreSQL), NixOS distribution, npm/pip for package management.

### Configurable Session Status (Jan 2026)
Projects can define custom workflow status options for their sessions:
- **Project-level configuration**: `sessionStatusOptions` JSON array on projects table (e.g., ["In Progress", "Responded", "Won", "Lost"])
- **Session-level status**: `workflowStatus` text field on extraction_sessions table
- **UI**: Admins configure options in DefineData.tsx; users select status via dropdown in AllData.tsx
- **Case-insensitive duplicate prevention**: Status entries are validated to avoid duplicates

### Database Schema
Core tables include:
*   `projects`: Added `session_status_options` (JSONB) for configurable workflow status options.
*   `extraction_sessions`: Added `workflow_status` (TEXT) for user-defined session status.
*   `workflow_steps`: Defines extraction steps (Info Pages, Data Tables) with `id`, `project_id`, `step_name`, `step_type`, `value_count`, and `identifier_id`.
*   `step_values`: Defines columns/fields within steps with `id`, `step_id`, `value_name`, `tool_id`, `order_index`, `input_values` (JSONB), and `fields` (JSONB for multi-field support).
*   `field_validations`: Stores extracted data with `id`, `field_id`, `identifier_id`, `extracted_value`, `validation_status`, `ai_reasoning`, and `confidence_score`.

## External Dependencies
*   **Database**: PostgreSQL (specifically Neon for hosting)
*   **AI Service**: Google Gemini API
*   **Frontend Libraries**: React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Wouter, React Hook Form, Zod.
*   **Backend Libraries**: Node.js, Express, Drizzle ORM.
*   **Python Services**: For PDF/Excel document processing.
*   **Session Management**: `connect-pg-simple`.