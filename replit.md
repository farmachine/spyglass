# extrapl - AI-Powered Document Data Extraction Platform

## Overview
extrapl is an AI-powered document data extraction platform built with React, Express, and TypeScript. It processes legal and business documents, offering enhanced conflict detection and collaborative workspace features. The platform enables users to configure extraction schemas, upload documents, and review AI-analyzed data with knowledge-based validation. extrapl aims to streamline data extraction from complex documents, offering significant market potential by reducing manual effort and improving accuracy.

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

### UI/UX Decisions
- **Color Scheme**: Professional slate blue (`#4F63A4`) as primary color.
- **Visual Consistency**: Unified borderless design for statistics cards; consistent tick-based verification icons.
- **Layout**: Optimized dashboard and form layouts for better space utilization and visual hierarchy.
- **Interaction**: Icon-only UI system, comprehensive optimistic updates, streamlined workflow from upload to review.
- **Responsiveness**: Responsive design using Tailwind CSS.
- **Navigation**: Consolidated Project Admin interface and streamlined session view navigation with integrated left sidebar.

### Technical Implementations
- **Document Processing**: Supports PDF, DOCX, DOC, XLSX, XLS files with intelligent chunking for large PDFs and Python-based processing for Excel files.
- **Hybrid Extraction System**: Two-tier approach combining direct extraction for basic tasks with AI-powered reasoning for complex analytical fields.
- **AI Integration**: Comprehensive AI-powered data extraction and validation using Google Gemini API for intelligent reasoning, auto-verification, and conflict detection. Includes dynamic Excel function generation via AI.
- **Multi-Tenancy**: Role-based access control (Admin/User) and organization-level data isolation.
- **Data Validation**: Field-level validation with visual indicators, manual editing, and revert-to-AI options. Graceful handling of empty AI extraction results.
- **Workflow**: Streamlined multi-step loading popups and automated extraction flow.
- **Dynamic Features**: Dynamic naming, column resizing, drag-and-drop reordering, and multi-sheet Excel export.
- **AI Chat Integration**: Real-time chat feature within session views using Gemini AI, with JWT authentication, persistent storage, and context-aware responses.
- **Modal-Based AI Extraction**: Targeted extraction functionality for specific documents and fields, with intelligent collection record exclusion and progressive extraction.
- **Centralized Prompt Management**: Unified prompt control (`all_prompts.py`) for consistent AI behavior, including document format analysis and detailed field context for Gemini.
- **Complete Extraction Workflow**: End-to-end document analysis system integrating document content, target field descriptions, and AI analysis for intelligent extraction recommendations.
- **Session Document Storage**: Storage of uploaded documents and extracted content in PostgreSQL for comprehensive tracking and AI chat context.
- **Updated UI Terminology**: Renamed "Extraction Sessions" to "Overview" throughout the application for cleaner, more user-friendly language. This affects page titles, API comments, and user-facing text in AllData component, storage interfaces, and dialog descriptions.
- **Dynamic Page Titles System**: Implemented comprehensive dynamic page title system using usePageTitle hook with "extrapl • {Page}" format and blue dot separator. All major pages (Dashboard, ProjectLayout, SessionView, AdminPanel, ProjectAdmin, OrganizationConfig) now display contextual titles based on actual data (project names, session names, organization names) making multi-tab navigation more intuitive and user-friendly.
- **Enhanced Field Validation Mapping**: Updated field validation system to use both field_id and collection_id for more robust mapping instead of relying solely on collection_name. Added collectionId column to field_validations table, implemented new storage methods getValidationsByFieldAndCollection and populateMissingCollectionIds, and updated API routes to populate collectionId from collection name lookups. Migrated 20,847 existing validation records to include proper collection ID references.
- **Dual Extraction Mode Configuration**: Enhanced project schema to support configurable extraction types (AI vs Function) for both main schema fields and collection properties. Added extraction_type, knowledge_document_ids, extraction_rule_ids, documents_required, function_id, and required_document_type columns to both project_schema_fields and collection_properties tables. The system now supports AI extraction with knowledge documents and extraction rules, or Function-based extraction with Excel/Word/PDF document type requirements and wizardry function selection.
- **Excel Wizardry Functions System**: Advanced reusable function system for Excel extraction that stores AI-generated Python functions in PostgreSQL. When processing Excel documents, the system first checks for existing functions that match similar document types or field patterns, reuses them with usage tracking, or creates new functions via Gemini AI. Functions include metadata (name, description, tags, usage count) and are executed in secure sandboxed environments.
- **Enhanced Excel Preprocessing Pipeline**: Intelligent Excel document preprocessing system (`enhanced_excel_extractor.py`) that cleans and normalizes Excel data before extraction. Features include multi-line header detection and merging, data boundary identification, cell value cleaning, whitespace normalization, and intelligent header reconstruction. Successfully processes complex Excel files with 6 sheets and 185+ columns. Debug output is redirected to stderr to prevent JSON parsing issues during document upload. This preprocessing significantly improves extraction accuracy by resolving common Excel formatting issues like split headers and inconsistent cell formatting.
- **Multi-Step Extraction System**: Complete auto-rerun functionality with progressive identifier reference chaining. System processes one target property per extraction run (based on extraction_number), builds cumulative identifier references, and maintains consistent 185-record validation count across all extraction steps. Supports existing function reuse, new function generation, and AI extraction methods with identifier-aware prompting. Enhanced with intelligent counter logic that continues extraction until all target fields are processed, and streamlined console logging with emoji-based status indicators and concise progress summaries.
- **Strict Function vs AI Extraction Logic**: Enhanced decision criteria that only creates Excel functions for computational tasks (calculations, aggregations, data transformations) while using AI extraction for knowledge document comparisons, reasoning fields, and standard mappings. System now properly analyzes field descriptions for knowledge document indicators and defaults to AI extraction when external resource comparison is required.
- **Unified Extraction System**: All extraction endpoints now consistently use `extraction_wizardry.py` as the primary extraction processor for maximum compatibility and reliability. The enhanced processor remains available for future development but the system prioritizes the proven wizardry extraction workflow for production stability.
- **Function Extraction Type Detection**: Enhanced `extraction_wizardry.py` to detect `extractionType = 'FUNCTION'` and `functionID` metadata in target fields. When detected, the system completely bypasses AI analysis and routes directly to the specified Excel function for execution, providing faster processing for predefined extraction tasks.
- **Excel Function Sandbox Compatibility**: Updated Excel wizardry functions to work within sandboxed execution environments by removing dependencies on built-in Python functions (isinstance, type, Exception, set) and using alternative approaches. Functions now successfully execute with proper error handling and type checking using hasattr() and manual list-based uniqueness tracking.
- **Fixed Excel Column Name Extraction**: Resolved critical issue where "Get Column Names" function was attempting to parse binary Excel data instead of pre-processed text content. Updated function to properly parse sheet sections (marked with "=== Sheet:") and extract tab-separated column headers. Fixed testing system double-wrapping issue where field validation objects were being JSON-stringified again, now properly extracts just the column name values. Removed test input validation objects from results to show only actual extracted data.
- **Sequential Function Extraction Workflow**: Fully implemented identifier reference chaining between function extractions. The "Extract Column Names" function processes all Excel sheets and creates 185 column name references, which are then properly passed to the "Find Worksheet Name" function for processing. Each identifier reference object accumulates data from multiple extractions at the same index, creating combined records like `{"Data Field[0]": "Column Name", "Worksheet[0]": "Sheet Name"}`. This enables complex multi-step extraction workflows where later functions can analyze results from earlier extractions.
- **Unified Tool-First Configuration System**: Completely redesigned all field configuration interfaces (PropertyDialogNew and SchemaFieldDialog) with consistent tool-first approach. Features global extraction method selector at top right, dynamic form generation based on selected tool metadata, built-in @-key referencing with autocomplete, multi-select document support, and streamlined property settings. All property types (main schema fields, collection properties, and identifiers) now use the same unified configuration pattern for consistent user experience and maintainability.
- **Complete Terminology Standardization**: Updated all user-facing interfaces to use "tool" instead of "function" for extrapl Tools, providing consistent terminology throughout CreateToolDialog, PropertyDialogNew, and SchemaFieldDialogNew components. Updated variable names, comments, and UI text while maintaining backend compatibility.
- **Sample Document Processing System**: Enhanced Excel wizardry function testing with comprehensive sample document upload and processing. When creating tools, users can upload sample files (Excel, Word, PDF, CSV, JSON) or enter sample text for each input parameter. Sample documents are processed using the exact same extraction pipeline as session documents (`document_extractor.py`) to ensure test consistency. Extracted content is stored in the `sample_documents` database table, enabling accurate function testing with realistic data that mirrors actual session processing. File upload accepts proper MIME types for all supported document formats.
- **Data Input Sample Tables**: Implemented table-based sample data creation for data type input parameters. Users can create up to 5 rows of sample data with customizable columns for testing tools with structured data inputs. Features column/row addition/deletion, editable text fields, and automatic JSON conversion for processing. Console logging displays JSON arrays during tool creation/update for debugging purposes. Data samples are processed through the same pipeline as other sample content types.

### Key Architectural Decisions
- **Monorepo Structure**: Single repository with shared types.
- **Drizzle ORM**: Chosen for TypeScript-first approach and strong type inference.
- **shadcn/ui**: Provides consistent, accessible components with high customizability.
- **React Query**: Manages server state, caching, and data synchronization.
- **Zod Integration**: Ensures runtime validation matching TypeScript types for end-to-end type safety.
- **Express + Vite**: Combines a robust backend framework with modern frontend tooling.
- **UUID Consistency**: Full UUID string consistency across all storage interfaces.
- **Graceful Error Handling**: Session views load successfully even when AI returns empty results, maintaining full functionality for manual data entry.

## External Dependencies

- **React Ecosystem**: React 18, React Hook Form, React Query
- **UI Library**: Radix UI primitives, shadcn/ui components
- **Styling**: Tailwind CSS
- **Validation**: Zod
- **Database**: PostgreSQL, Drizzle ORM, Neon Database driver
- **Backend Development**: tsx, esbuild
- **Session Management**: connect-pg-simple
- **AI/ML**: Google Gemini API
- **Document Processing (Python)**: `python-docx`, `pandas`, `openpyxl`, `xlrd`, PyPDF2
- **Drag-and-Drop**: `react-beautiful-dnd`
- **Excel Export**: `xlsx` library
- **Authentication**: `bcrypt`, `jsonwebtoken`