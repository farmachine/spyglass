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