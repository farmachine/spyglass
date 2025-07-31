# Extractly - AI-Powered Document Data Extraction Platform

## Overview
Extractly is an AI-powered document data extraction platform designed to process complex legal and business documents. It offers enhanced conflict detection, collaborative workspaces, and AI-driven analysis with knowledge-based validation. The platform enables users to configure extraction schemas, upload documents, and review extracted data efficiently. Its vision is to streamline data extraction, improve accuracy, and reduce manual effort in document processing, targeting a broad market of legal and business professionals.

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
- **Color Scheme**: Professional slate blue (#4F63A4)
- **Component Library**: shadcn/ui for consistent, accessible components
- **Visual Feedback**: Optimistic updates for CRUD operations, icon-based verification (CheckCircle), and percentage progress bars.
- **Layouts**: Tab-based interfaces for structured navigation, unified borderless statistics cards, and fixed headers for improved space utilization.
- **Branding**: "Extractly" rebranding with a wave design theme, applied consistently across logos and UI elements.

### Technical Implementations
- **AI Integration**: Comprehensive AI-powered extraction using Google Gemini API (Gemini 2.5 Pro) for document processing, data extraction, and intelligent reasoning.
- **Document Processing**: Handles various document types (.pdf, .docx, .xlsx, .xls) using Gemini API for PDFs/Word and pandas/openpyxl for Excel.
- **AI Prompt Engineering**: Genericized AI prompts, intelligent reasoning, explicit instructions for collection extraction, and auto-verification thresholds.
- **Robustness**: Implemented retry logic with exponential backoff for API overload handling (Google Gemini 503 errors), token limit management (1M input, 64K output), and database connection optimization (batch queries).
- **Data Validation**: AI-driven auto-verification based on confidence scores, manual override capabilities, and human-friendly AI reasoning for conflicts.
- **Workflow Automation**: End-to-end automated extraction pipeline from document upload to review.
- **Data Management**: Dynamic main object naming, drag-and-drop field reordering, and multi-document aggregation.
- **User Management**: Role-based access control (Admin/User), multi-tenancy with organization-level isolation, project publishing, and an admin panel for user and organization management.

### Feature Specifications
- **Project Management**: Top-level containers for data extraction configurations, including project schemas and object collections.
- **Schema Definition**: Supports TEXT, NUMBER, DATE, CHOICE field types, customizable choice options, and extraction rules.
- **Knowledge Base**: Document upload with text extraction and extraction rules management for AI guidance, including dynamic conflict detection.
- **Session Management**: Individual upload and processing instances with status tracking and detailed review capabilities.
- **Reporting**: Excel export of extracted data with multi-sheet support.

## External Dependencies

- **Google Gemini API**: Used for AI-powered document processing, text extraction, and data analysis.
- **pandas**: Python library for structured data manipulation, specifically used for Excel file processing.
- **openpyxl**: Python library for reading and writing Excel 2010 xlsx/xlsm/xltx/xltm files.
- **python-docx**: Python library for creating and updating Microsoft Word files (.docx).
- **Poppler**: System dependencies (poppler, poppler_utils) for robust PDF processing and image conversion.
- **Neon Database**: Serverless driver for PostgreSQL in production environments.
- **connect-pg-simple**: For PostgreSQL session management.
- **React Ecosystem**: React 18, React Hook Form, React Query (TanStack Query), Radix UI (primitives for shadcn/ui components).
- **React Beautiful DnD**: For drag-and-drop functionality.
- **Zod**: For runtime type checking and validation.
- **bcrypt**: For password hashing.
- **jsonwebtoken**: For JWT authentication.