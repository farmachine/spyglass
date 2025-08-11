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

### UI/UX Decisions
- **Color Scheme**: Professional slate blue (`#4F63A4`) as primary color.
- **Visual Consistency**: Unified borderless design for statistics cards; consistent tick-based verification icons.
- **Layout**: Optimized dashboard and form layouts for better space utilization and visual hierarchy.
- **Interaction**: Icon-only UI system, comprehensive optimistic updates, streamlined workflow from upload to review.
- **Responsiveness**: Responsive design using Tailwind CSS.

### Technical Implementations
- **Document Processing**: Supports PDF, DOCX, DOC, XLSX, XLS files.
- **Hybrid Extraction System**: Two-tier approach combining simple direct extraction for basic tasks (column mapping, document metadata) with complex AI-powered reasoning for analytical fields, optimizing speed and cost efficiency.
- **Task Classification**: Intelligent classification system determining whether to use direct extraction or AI reasoning based on field complexity and requirements.
- **AI Integration**: Comprehensive AI-powered data extraction and validation using Google Gemini API for complex fields requiring intelligent reasoning, auto-verification, and conflict detection.
- **Multi-Tenancy**: Role-based access control with Admin/User roles and organization-level data isolation.
- **UUID Migration**: Full migration to ISO UUIDs for all database entities and API parameters.
- **Project Management**: Project creation, schema definition (global fields, object collections), knowledge base management, and session tracking.
- **Data Validation**: Comprehensive field-level validation with visual indicators, manual editing capabilities, field clearing functionality, revert-to-AI options, and smart status handling (empty fields = unverified, filled fields = verified).
- **Dynamic Naming**: "Main Object Name" feature allows dynamic renaming of UI elements.
- **Workflow**: Streamlined multi-step loading popups and automated extraction flow with task-specific optimization.
- **Table Features**: Dynamic column resizing, drag-and-drop reordering of schema fields/properties.
- **Excel Export**: Multi-sheet Excel export functionality for session validation data.
- **Large PDF Handling**: Intelligent chunking system for processing large PDFs, splitting them into manageable chunks and reassembling after processing.
- **Enhanced Field Editing**: Complete field editing system with inline clear icons, manual update tracking, AI reasoning display control, and comprehensive revert functionality.
- **Collection Management**: Fixed "Add new +" functionality with proper index calculation and consistent validation filtering for both legacy and new records.
- **Empty Data Handling**: Robust session view loading that gracefully handles empty AI extraction results, displaying functional empty states without errors or crashes.
- **Enhanced Truncation Repair**: Improved JSON repair functionality for truncated Gemini API responses, with comprehensive parsing logic that recovers complete field validation objects and maintains data integrity during AI extraction failures.
- **Dashboard Tile Swap**: Complete tile reordering functionality with "Move Left" and "Move Right" options in project settings dropdowns, enabling visual rearrangement of project tiles with persistent ordering state.
- **Excel Extraction Optimization**: Significantly enhanced Excel processing capabilities with 4x increased document limits (800KB per document), 3x increased total content limits (1.5MB), intelligent graduated sampling for large sheets (up to 400 rows vs 90), 53% increased AI output tokens (100K), and removal of hard 100-record response limits for comprehensive data extraction.
- **AI Chat Integration**: Fully functional real-time chat feature within session views using Gemini AI, with JWT-based authentication, persistent message storage, and context-aware responses based on session data and validation states.

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