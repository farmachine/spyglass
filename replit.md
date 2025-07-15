# Document Data Extraction App

## Overview

This is a full-stack document data extraction application built with React, Express, and TypeScript. The app uses AI to extract structured data from PDF/Excel documents, allowing users to configure extraction schemas, upload documents, and review extracted data. The system is designed around projects that contain configurable data schemas and object collections for flexible data extraction.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**January 15, 2025**
- ✓ Built complete project dashboard with CRUD operations
- ✓ Implemented project view with four-tab navigation system
- ✓ Created responsive UI using Tailwind CSS and shadcn/ui components
- ✓ Set up full database schema with PostgreSQL support
- ✓ Fixed TypeScript type compatibility issues in storage layer
- ✓ Successfully tested project creation and navigation - confirmed working
- ✓ Implemented complete schema management in "Define Data" section
- ✓ Added form-based dialogs for creating/editing schema fields, collections, and properties
- ✓ Made all descriptions mandatory with AI-focused guidance and examples
- ✓ Fixed multi-property creation issue with persistent "Add Another Property" button
- ✓ Added status indicators with colored badges for field types
- ✓ Built complete knowledge document upload system with drag-and-drop functionality
- ✓ Added extraction rules management for AI guidance
- ✓ Fixed API request compatibility issues and file metadata handling
- ✓ Implemented display name field separate from filename for better organization

## Current Status

**Phase 3 Complete**: Knowledge & Rules Management System
- File upload with drag-and-drop interface supporting PDF, Word, Excel, CSV, text files
- Display name and description fields for better document organization
- Extraction rules creation with type categorization and field targeting
- Full CRUD operations for knowledge documents and rules
- Automatic file validation and metadata extraction
- Edit forms with proper pre-population of existing data
- Clean knowledge base overview with document management

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite with custom configuration

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ESM modules
- **Development**: tsx for TypeScript execution
- **Build**: esbuild for production bundling
- **API**: RESTful endpoints under `/api` prefix

### Database & ORM
- **Database**: PostgreSQL (configured for production)
- **ORM**: Drizzle ORM with TypeScript-first approach
- **Migrations**: Drizzle Kit for schema management
- **Driver**: Neon Database serverless driver
- **Schema Location**: `shared/schema.ts` for type sharing

## Key Components

### Project Management System
- **Projects**: Top-level containers for data extraction configurations
- **Project Schema**: Global fields that apply to entire document sets
- **Object Collections**: Reusable object types with properties for structured data extraction
- **Extraction Sessions**: Individual upload and processing instances

### Data Schema Configuration
- **Field Types**: TEXT, NUMBER, DATE, BOOLEAN
- **Project Schema Fields**: Global metadata fields
- **Collection Properties**: Structured object definitions
- **Validation**: Zod schemas for type safety

### UI Components
- **Dashboard**: Project overview and management
- **Project View**: Tabbed interface with four main sections:
  - New Upload: Document upload interface
  - Define Data: Schema configuration
  - Knowledge/Rules: Reference documents and extraction rules
  - All Data: Extraction sessions and results

### File Structure
```
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route components
│   │   ├── hooks/       # Custom React hooks
│   │   └── services/    # API client
├── server/          # Express backend
│   ├── routes.ts    # API route definitions
│   ├── storage.ts   # Database interface
│   └── vite.ts      # Development server setup
├── shared/          # Shared TypeScript types
│   └── schema.ts    # Database schema and types
└── migrations/      # Database migrations
```

## Data Flow

### Project Creation Flow
1. User creates project via dashboard dialog
2. Frontend validates data with Zod schema
3. API creates project record in database
4. React Query invalidates cache and refetches data

### Schema Configuration Flow
1. User defines project schema fields and object collections
2. Each collection can have multiple properties with types
3. Schema stored in relational database structure
4. Frontend provides real-time validation and editing

### Document Processing Flow (Planned)
1. User uploads documents through drag-and-drop interface
2. Creates extraction session linked to project
3. AI processes documents using configured schema
4. Results stored and displayed for review/editing
5. User can verify and save final dataset

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React Hook Form, React Query
- **UI Library**: Radix UI primitives with shadcn/ui components
- **Styling**: Tailwind CSS with custom theme configuration
- **Validation**: Zod for runtime type checking

### Backend Dependencies
- **Database**: Drizzle ORM, Neon Database driver
- **Development**: tsx, esbuild, Vite integration
- **Session Management**: connect-pg-simple for PostgreSQL sessions

### Development Tools
- **TypeScript**: Strict configuration with path mapping
- **Build Tools**: Vite for frontend, esbuild for backend
- **Code Quality**: ESLint integration via Vite plugins

## Deployment Strategy

### Development Setup
- **Frontend**: Vite dev server with HMR
- **Backend**: tsx with file watching
- **Database**: Drizzle push for schema updates
- **Integration**: Vite proxy handles API routing

### Production Build
- **Frontend**: Vite build to `dist/public`
- **Backend**: esbuild bundle to `dist/index.js`
- **Assets**: Static file serving from Express
- **Environment**: NODE_ENV-based configuration

### Database Management
- **Schema**: Version controlled via Drizzle migrations
- **Connection**: Environment variable configuration
- **Driver**: Neon serverless for production scalability

### Key Architectural Decisions

1. **Monorepo Structure**: Single repository with shared types between frontend and backend for type safety
2. **Drizzle ORM**: Chosen for TypeScript-first approach and better type inference than traditional ORMs
3. **shadcn/ui**: Provides consistent, accessible components while maintaining customization flexibility
4. **React Query**: Handles server state management, caching, and synchronization
5. **Zod Integration**: Runtime validation matching TypeScript types for end-to-end type safety
6. **Express + Vite**: Combines mature backend framework with modern frontend tooling