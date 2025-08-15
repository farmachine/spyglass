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
- **Enhanced Field Validation Mapping**: Updated field validation system to use both field_id and collection_id for more robust mapping instead of relying solely on collection_name. Added collectionId column to field_validations table, implemented new storage methods getValidationsByFieldAndCollection and populateMissingCollectionIds, and updated API routes to populate collectionId from collection name lookups. Migrated 20,847 existing validation records to include proper collection ID references.
- **Automatic Field Validation Saving**: Enhanced extraction_wizardry.py to automatically save field validations to the database after each extraction step using API calls to the save-validations endpoint. The extraction wizard modal now closes after the first fields are saved, allowing users to see results in the UI while subsequent extraction steps continue in the background. Added comprehensive error handling and validation saving for both Excel function and AI extraction methods.
- **Delete All Data Feature**: Reinstated the delete all data functionality behind a three-dot menu (MoreVertical icon) in the action column header of collection tables. Users can now delete all validation records for an entire collection through a dropdown menu with confirmation toasts. Includes optimistic UI updates and proper error handling with rollback functionality.
- **Excel Wizardry Functions System**: Advanced reusable function system for Excel extraction that stores AI-generated Python functions in PostgreSQL. When processing Excel documents, the system first checks for existing functions that match similar document types or field patterns, reuses them with usage tracking, or creates new functions via Gemini AI. Functions include metadata (name, description, tags, usage count) and are executed in secure sandboxed environments.
- **Enhanced Excel Preprocessing Pipeline**: Intelligent Excel document preprocessing system (`enhanced_excel_extractor.py`) that cleans and normalizes Excel data before extraction. Features include multi-line header detection and merging, data boundary identification, cell value cleaning, whitespace normalization, and intelligent header reconstruction. Successfully processes complex Excel files with 6 sheets and 185+ columns. Debug output is redirected to stderr to prevent JSON parsing issues during document upload. This preprocessing significantly improves extraction accuracy by resolving common Excel formatting issues like split headers and inconsistent cell formatting.
- **Multi-Step Extraction System**: Complete auto-rerun functionality with progressive identifier reference chaining. System processes one target property per extraction run (based on extraction_number), builds cumulative identifier references, and maintains consistent 185-record validation count across all extraction steps. Supports existing function reuse, new function generation, and AI extraction methods with identifier-aware prompting. Enhanced with intelligent counter logic that continues extraction until all target fields are processed, and streamlined console logging with emoji-based status indicators and concise progress summaries.
- **Strict Function vs AI Extraction Logic**: Enhanced decision criteria that only creates Excel functions for computational tasks (calculations, aggregations, data transformations) while using AI extraction for knowledge document comparisons, reasoning fields, and standard mappings. System now properly analyzes field descriptions for knowledge document indicators and defaults to AI extraction when external resource comparison is required.

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