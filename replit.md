# Extractly - AI-Powered Document Data Extraction Platform

## Overview
Extractly is an AI-powered document data extraction platform built with React, Express, and TypeScript. It processes legal and business documents, offering enhanced conflict detection and collaborative workspace features. The platform enables users to configure extraction schemas, upload documents, and review AI-analyzed data with knowledge-based validation. Extractly aims to streamline data extraction from complex documents, offering significant market potential by reducing manual effort and improving accuracy.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ESM modules
- **Development**: tsx for TypeScript execution
- **Build**: esbuild for production bundling
- **API**: RESTful endpoints under `/api` prefix

### Database & ORM
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with TypeScript-first approach
- **Migrations**: Drizzle Kit for schema management
- **Driver**: Neon Database serverless driver
- **Schema Location**: `shared/schema.ts`

### UI/UX Decisions
- **Color Scheme**: Professional slate blue (`#4F63A4`) as primary color.
- **Visual Consistency**: Unified borderless design for statistics cards; consistent tick-based verification icons across the application.
- **Layout**: Optimized dashboard and form layouts for better space utilization and visual hierarchy.
- **Interaction**: Icon-only UI system, comprehensive optimistic updates for immediate UI feedback, streamlined workflow from upload to review.
- **Responsiveness**: Responsive design using Tailwind CSS.

### Recent Critical Fixes (August 1, 2025)
- **UUID/Integer Consistency Issue Resolved**: Fixed systematic data type mismatches in MemStorage where UUID session IDs were being parsed as integers using parseInt(), causing all field validation lookups to fail and collections to display "Not set" instead of actual extracted values.
- **Storage Interface Standardization**: Updated all storage methods to consistently use string UUIDs instead of mixed integer/string types, resolving LSP diagnostics and enabling proper data retrieval.
- **Sample Data Alignment**: Fixed sample validation data to use correct session UUIDs and field IDs, ensuring proper data relationships and display functionality.
- **Column Ordering Synchronization**: Implemented automatic synchronization between Define Data tab and Session View column ordering. SessionView now fetches schema data and sorts collection validations by property orderIndex, ensuring existing sessions reflect current schema column order when properties are reordered via drag-and-drop.
- **Modular AI Prompt System**: Moved AI extraction prompt from hardcoded strings in `ai_extraction_simplified.py` to dedicated `prompt.py` file. This enables easier customization and maintenance of extraction instructions while maintaining all existing functionality including section-aware extraction, inclusive collection detection, and intelligent AI reasoning requirements.
- **Simplified Validation Architecture**: Removed separate validation functions (`step2_validate_field_records`, `ValidationResult` dataclass, and `extract_and_validate_chain`) from the AI extraction system. Validation now occurs exclusively during the extraction process, eliminating redundant validation steps and simplifying the codebase while maintaining all validation functionality within the extraction workflow.
- **Enhanced Numbered Section Recognition**: Improved AI extraction prompt to recognize numbered section patterns (e.g., 2.3.1 through 2.3.10) and extract ALL items within section boundaries. Added specific instructions for section-collection matching where collection names correspond to document sections, ensuring complete extraction of all numbered subsections rather than limiting to sample items.
- **Markdown Table Recognition**: Added comprehensive markdown table parsing instructions to AI extraction prompt. System now recognizes markdown table format with pipe separators, distinguishes headers from data rows, and extracts ALL table rows as separate collection items rather than limiting to examples.
- **Comprehensive Token Usage Tracking**: Implemented complete token tracking system capturing input_tokens and output_tokens from Gemini API responses. Enhanced debugger interface with conditional token badges (blue/green for sessions with data, gray "No data" for older sessions). System provides detailed cost monitoring and performance analysis for AI extraction operations with accurate token count display and database storage.
- **Gemini 2.5 Pro Upgrade**: Upgraded AI extraction system from gemini-1.5-flash to gemini-2.5-pro with maximum token limits (1M input, 65,536 output tokens). Enhanced processing capabilities for complex reasoning, coding, STEM problems, and large dataset analysis. Fixed truncation repair system to save properly formatted JSON responses to database instead of raw truncated responses.

### Technical Implementations
- **Document Processing**: Supports PDF, DOCX, DOC, XLSX, XLS files. Uses Google Gemini API for text extraction from PDFs and images; `python-docx` for Word documents; `pandas` and `openpyxl` for Excel files.
- **AI Integration**: Comprehensive AI-powered data extraction and validation using Google Gemini API. Includes intelligent reasoning, auto-verification based on confidence thresholds, and conflict detection against knowledge documents.
- **Multi-Tenancy**: Role-based access control with Admin/User roles and organization-level data isolation. Primary organization protection.
- **UUID Migration**: Full migration from auto-incrementing integers to ISO UUIDs for all database entities and API parameters.
- **Project Management**: Project creation, schema definition (global fields, object collections), knowledge base management (documents, extraction rules), and session tracking.
- **Data Validation**: Field-level validation with visual indicators (confidence scores, manual input badges), manual override, and progress tracking.
- **Dynamic Naming**: "Main Object Name" feature allows dynamic renaming of UI elements based on user-defined object types (e.g., "Invoice", "Contract").
- **Workflow**: Streamlined multi-step loading popups, automated extraction flow from upload to review, and seamless navigation.
- **Column Resizing**: Implemented dynamic table column resizing with visual feedback.
- **Drag-and-Drop**: Reordering of schema fields and collection properties with optimistic updates.
- **Excel Export**: Multi-sheet Excel export functionality for session validation data.

### Key Architectural Decisions
- **Monorepo Structure**: Single repository with shared types between frontend and backend.
- **Drizzle ORM**: Chosen for TypeScript-first approach and strong type inference.
- **shadcn/ui**: Provides consistent, accessible components with high customizability.
- **React Query**: Manages server state, caching, and data synchronization.
- **Zod Integration**: Ensures runtime validation matching TypeScript types for end-to-end type safety.
- **Express + Vite**: Combines a robust backend framework with modern frontend tooling.
- **UUID Consistency**: Full UUID string consistency across all storage interfaces, eliminating integer/string mismatches that caused data retrieval failures.

## External Dependencies

- **React Ecosystem**: React 18, React Hook Form, React Query
- **UI Library**: Radix UI primitives, shadcn/ui components
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Database**: PostgreSQL, Drizzle ORM, Neon Database driver
- **Backend Development**: tsx, esbuild
- **Session Management**: connect-pg-simple
- **AI/ML**: Google Gemini API
- **Document Processing (Python)**: `python-docx`, `pandas`, `openpyxl`, `xlrd`
- **Drag-and-Drop**: `react-beautiful-dnd`
- **Excel Export**: `xlsx` library
- **Authentication**: `bcrypt` (for password hashing), `jsonwebtoken` (JWT)