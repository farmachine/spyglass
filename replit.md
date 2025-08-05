# Extrapl. - AI-Powered Document Data Extraction Platform

## Overview
Extrapl. is an AI-powered document data extraction platform built with React, Express, and TypeScript. It processes legal and business documents, offering enhanced conflict detection and collaborative workspace features. The platform enables users to configure extraction schemas, upload documents, and review AI-analyzed data with knowledge-based validation. Extrapl. aims to streamline data extraction from complex documents, offering significant market potential by reducing manual effort and improving accuracy.

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
- **AI Integration**: Comprehensive AI-powered data extraction and validation using Google Gemini API, including intelligent reasoning, auto-verification, and conflict detection.
- **Multi-Tenancy**: Role-based access control with Admin/User roles and organization-level data isolation.
- **UUID Migration**: Full migration to ISO UUIDs for all database entities and API parameters.
- **Project Management**: Project creation, schema definition (global fields, object collections), knowledge base management, and session tracking.
- **Data Validation**: Comprehensive field-level validation with visual indicators, manual editing capabilities, field clearing functionality, revert-to-AI options, and smart status handling (empty fields = unverified, filled fields = verified).
- **Dynamic Naming**: "Main Object Name" feature allows dynamic renaming of UI elements.
- **Workflow**: Streamlined multi-step loading popups and automated extraction flow.
- **Table Features**: Dynamic column resizing, drag-and-drop reordering of schema fields/properties.
- **Excel Export**: Multi-sheet Excel export functionality for session validation data.
- **Large PDF Handling**: Intelligent chunking system for processing large PDFs, splitting them into manageable chunks and reassembling after processing.
- **Enhanced Field Editing**: Complete field editing system with inline clear icons, manual update tracking, AI reasoning display control, and comprehensive revert functionality.
- **Collection Management**: Fixed "Add new +" functionality with proper index calculation and consistent validation filtering for both legacy and new records.
- **Empty Data Handling**: Robust session view loading that gracefully handles empty AI extraction results, displaying functional empty states without errors or crashes.
- **Chunked AI Extraction**: Complete implementation of intelligent chunking system for large schemas that exceed token limits, with separate processing of schema fields and collection properties, reassembly of results, and robust error handling.
- **Field Validation Save Process**: Fixed critical bug in `createFieldValidationRecords` function to properly handle the new `field_validations` array format from chunked extraction, ensuring collection property validations are correctly saved to the database.

### Key Architectural Decisions
- **Monorepo Structure**: Single repository with shared types.
- **Drizzle ORM**: Chosen for TypeScript-first approach and strong type inference.
- **shadcn/ui**: Provides consistent, accessible components with high customizability.
- **React Query**: Manages server state, caching, and data synchronization.
- **Zod Integration**: Ensures runtime validation matching TypeScript types for end-to-end type safety.
- **Express + Vite**: Combines a robust backend framework with modern frontend tooling.
- **UUID Consistency**: Full UUID string consistency across all storage interfaces.
- **Graceful Error Handling**: Session views load successfully even when AI returns empty results, maintaining full functionality for manual data entry.
- **Chunked Processing Architecture**: AI extraction uses intelligent chunking to handle large schemas, processing schema fields and collections separately to stay within token limits, then reassembling results for seamless user experience.
- **Field Validation Data Flow**: Standardized `field_validations` array format from AI extraction through to database storage, ensuring consistent data handling across the entire extraction pipeline.

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