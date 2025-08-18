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

### UI/UX Decisions
- **Color Scheme**: Professional slate blue (`#4F63A4`).
- **Visual Consistency**: Unified borderless design for statistics cards; consistent tick-based verification icons.
- **Layout**: Optimized dashboard and form layouts for better space utilization.
- **Interaction**: Icon-only UI, comprehensive optimistic updates, streamlined workflow.
- **Responsiveness**: Responsive design using Tailwind CSS.
- **Navigation**: Consolidated Project Admin interface and streamlined session view navigation with integrated left sidebar.
- **Terminology**: "Extraction Sessions" renamed to "Overview" for clarity.
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
- **Sequential Function Extraction Workflow**: Implemented identifier reference chaining between function extractions, enabling complex multi-step workflows.
- **Unified Tool-First Configuration System**: Redesigned field configuration interfaces with consistent tool-first approach, dynamic form generation, and @-key referencing.
- **Comprehensive AI Function Training System**: Enhanced AI training prompts with function generation patterns for array iteration and single object processing, including mandatory structure, parameter validation, and common patterns.

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