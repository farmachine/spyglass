# extrapl - AI-Powered Document Data Extraction Platform

## Overview
extrapl is an AI-powered document data extraction platform built with React, Express, and TypeScript. It processes legal and business documents, offering enhanced conflict detection and collaborative workspace features. The platform enables users to configure extraction schemas, upload documents, and review AI-analyzed data with knowledge-based validation. extrapl aims to streamline data extraction from complex documents, offering significant market potential by reducing manual effort and improving accuracy.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ESM modules
- **Development**: tsx
- **Build**: esbuild
- **API**: RESTful endpoints under `/api`

### Database & ORM
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Migrations**: Drizzle Kit
- **Driver**: Neon Database serverless driver
- **Unified Architecture** (January 2025): New `workflow_steps` and `step_values` tables unify schema fields and collections as "steps" with "values". Each step has `valueCount` and `identifierId` fields for tracking value counts and identifier references. Legacy tables maintained for backward compatibility.

### UI/UX Decisions
- **Color Scheme**: Professional slate blue (`#4F63A4`).
- **Visual Consistency**: Unified borderless design for statistics cards; consistent tick-based verification icons.
- **Layout**: Optimized dashboard and form layouts for better space utilization.
- **Interaction**: Icon-only UI, comprehensive optimistic updates, streamlined workflow.
- **Responsiveness**: Responsive design using Tailwind CSS.
- **Navigation**: Consolidated Project Admin interface and streamlined session view navigation with integrated left sidebar. Removed redundant "Schema Information" section from Project Admin sidebar (January 2025).
- **Terminology**: "Extraction Sessions" renamed to "Overview" for clarity. "Data" tab renamed to "Flow" in Project Admin interface (January 2025).
- **Flow Interface Updates** (January 2025): Simplified workflow builder with type selector as top-right dropdown (Data Table/Info Page), removed "Step" prefix from labels, non-editable value names when collapsed, data type icons (T for text, # for number, etc.), tool filtering by outputType, minimal output display with centered dot and description.
- **Dynamic Page Titles**: Comprehensive system using `usePageTitle` hook for contextual titles.

### Technical Implementations
- **Document Processing**: Supports PDF, DOCX, DOC, XLSX, XLS with intelligent chunking and Python-based Excel processing.
- **Hybrid Extraction System**: Two-tier approach combining direct extraction with AI-powered reasoning.
- **AI Integration**: Comprehensive AI-powered data extraction and validation using Google Gemini API for intelligent reasoning, auto-verification, conflict detection, and dynamic Excel function generation.
- **Multi-Tenancy**: Role-based access control and organization-level data isolation.
- **Data Validation**: Field-level validation with visual indicators, manual editing, and revert-to-AI options. Handles empty AI results gracefully.
- **Workflow**: Streamlined multi-step loading and automated extraction flow.
- **Dynamic Features**: Dynamic naming, column resizing, drag-and-drop reordering, multi-sheet Excel export.
- **AI Chat Integration**: Real-time chat within session views using Gemini AI, with JWT authentication, persistent storage, and context-aware responses.
- **Modal-Based AI Extraction**: Targeted extraction for specific documents and fields, with intelligent record exclusion and progressive extraction.
- **Centralized Prompt Management**: Unified prompt control (`all_prompts.py`) for consistent AI behavior and detailed field context.
- **Complete Extraction Workflow**: End-to-end document analysis system integrating content, target fields, and AI analysis.
- **Session Document Storage**: Storage of uploaded documents and extracted content in PostgreSQL for tracking and AI chat context.
- **Enhanced Field Validation Mapping**: Uses both `field_id` and `collection_id` for robust mapping.
- **Dual Extraction Mode Configuration**: Project schema supports configurable AI vs. Function extraction types for fields and collection properties.
- **Excel Wizardry Functions System**: Reusable, AI-generated Python functions for Excel extraction stored in PostgreSQL, with usage tracking and sandboxed execution.
- **Enhanced Excel Preprocessing Pipeline**: Intelligent system (`enhanced_excel_extractor.py`) for cleaning and normalizing Excel data, improving extraction accuracy.
- **Multi-Step Extraction System**: Auto-rerun functionality with progressive identifier reference chaining, supporting existing function reuse, new function generation, and AI extraction.
- **Strict Function vs AI Extraction Logic**: Creates Excel functions only for computational tasks, using AI for knowledge document comparisons and reasoning fields.
- **Unified Extraction System**: All extraction endpoints consistently use `extraction_wizardry.py`.
- **Function Extraction Type Detection**: `extraction_wizardry.py` detects `extractionType = 'FUNCTION'` to bypass AI for predefined tasks.
- **Sequential Function Extraction Workflow** (January 2025): Successfully implemented identifier reference chaining between function extractions. Functions with `output_type: 'multiple'` properly iterate over previous step results, processing each item individually. The "Get Worksheet from Column" function now correctly maps 185 columns to their respective worksheets.
- **Unified Tool-First Configuration System**: Redesigned field configuration interfaces with consistent tool-first approach, dynamic form generation, and @-key referencing.
- **Comprehensive AI Function Training System**: Enhanced AI training prompts with function generation patterns for array iteration and single object processing, including mandatory structure, parameter validation, and common patterns.
- **Excel Format Training Integration**: Both main function generation and debug systems now include comprehensive Excel text format training, preventing pandas usage and enforcing proper text parsing with regex and string methods.
- **Manual Fix System**: Added manual fix endpoints for correcting pandas-based functions when AI generation encounters temporary issues, ensuring system reliability.
- **Enhanced Sample Data Structure**: Column objects with `identifierId` and `name` properties for improved tracking, backward compatible with legacy string format.
- **Fixed Excel Function Generation**: Resolved `actualFunctionType` variable definition issue in function generation endpoint.
- **Complete Tool Testing Workflow Implementation**: Document extraction on tool creation, structured sample data storage in metadata, enhanced test UI with document preview and proper data tables, multiple record iteration support for CODE tools, debug workflow with failure analysis, automatic sample document/data replacement on tool updates.
- **Fixed Document Extraction for AI Tools** (January 2025): Resolved critical issue where AI tools received placeholder text instead of actual Excel content. Fixed document_extractor.py input format, updated toolEngine.ts to properly use pre-extracted content from sample_documents table instead of metadata, and verified full Excel extraction with all sheets (12,925 characters from 6 sheets).
- **Enhanced Tool Engine Document Retrieval** (January 2025): Updated toolEngine.ts to fetch pre-extracted content from sample_documents table first, with fallback to metadata. Fixed "Get Worksheet from Column" function to handle structured input and correctly identify sheet locations for all 185 columns across 6 Excel sheets.
- **Complete Schema and Collection Forms Overhaul** (January 2025): Rebuilt SchemaFieldDialogNew and CollectionCard components to solely rely on functions/tools system. Removed all hardcoded fields, implementing dynamic parameter rendering based on tool selection. Both forms now use identical patterns with tool selection as primary driver, dynamic configuration panels, and unified document selection combining session and knowledge documents.
- **Collection Property UI Improvements** (January 2025): Updated CollectionCard inline property editor to match schema field dialog layout with consistent numbered steps. Changed "Data Sources & Configuration" to "Information Source" for clarity. Removed redundant tool description containers. Made Information Source section dynamic, only showing when extraction method has configurable parameters. Note: Identifier field name is hardcoded as "ID" on server-side during collection creation (line 841 in routes.ts) - requires server-side modification to make editable.
- **Unified Database Architecture** (January 2025): Restructured database to treat schema fields and collections consistently as "steps" with "values". New `workflow_steps` table stores both Info Pages (single values/schema) and Data Tables (multiple records/collections). Each step tracks `valueCount` (number of values) and `identifierId` (UUID of first value for list steps). New `step_values` table replaces both schema fields and collection properties, storing value configuration including `toolId` and `inputValues` for tool parameters and @references. Legacy tables maintained for backward compatibility during migration.

### Key Architectural Decisions
- **Monorepo Structure**: Single repository with shared types.
- **Drizzle ORM**: Chosen for TypeScript-first approach and strong type inference.
- **shadcn/ui**: Provides consistent, accessible components with high customizability.
- **React Query**: Manages server state, caching, and data synchronization.
- **Zod Integration**: Ensures runtime validation matching TypeScript types for end-to-end type safety.
- **Express + Vite**: Combines a robust backend framework with modern frontend tooling.
- **UUID Consistency**: Full UUID string consistency across all storage interfaces.
- **Graceful Error Handling**: Session views load successfully even with empty AI results.

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