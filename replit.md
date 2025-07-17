# Document Data Extraction App

## Overview

This is a full-stack document data extraction application built with React, Express, and TypeScript. The app uses AI to extract structured data from PDF/Excel documents, allowing users to configure extraction schemas, upload documents, and review extracted data. The system is designed around projects that contain configurable data schemas and object collections for flexible data extraction.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**January 17, 2025**
- ✓ **COMPLETE UUID MIGRATION**: Successfully migrated entire application from auto-incrementing integers to ISO UUIDs
- ✓ Updated database schema to use UUID primary keys for all tables (organizations, users, projects, etc.)
- ✓ Migrated PostgreSQL storage layer to handle string UUIDs instead of integer parsing operations
- ✓ Fixed all API routes to process UUID parameters instead of parseInt() calls
- ✓ Updated frontend components to work with UUID organization and user identifiers
- ✓ Created sample data with proper UUID values for authentication testing
- ✓ Verified complete authentication workflow works with UUID-based user identification
- ✓ **PRIMARY ORGANIZATION PROTECTION**: Implemented comprehensive protection for primary organizations
- ✓ Added `type` field to organizations schema with enum values ("primary", "standard")
- ✓ Updated existing "Internal" organization to be marked as primary type
- ✓ Implemented frontend restrictions preventing deletion of primary organizations
- ✓ Added server-side validation to block deletion attempts on primary organizations
- ✓ Created visual indicators with badges showing "Primary" vs "Standard" organization types
- ✓ Added informational messages explaining primary organization restrictions
- ✓ System now properly distinguishes between primary and standard organizations for access control

**January 16, 2025**
- ✓ Built complete organization and user management system with admin access controls
- ✓ Implemented JWT authentication with bcrypt password hashing for secure login
- ✓ Added role-based access control with Admin/User roles and organization-level isolation
- ✓ Created multi-tenancy system where users belong to organizations and can only access their organization's data
- ✓ Built admin panel with settings wheel navigation instead of tabbed interface
- ✓ Created separate AdminPanel page with organization overview and management
- ✓ Added OrganizationConfig page with dedicated settings and user management tabs
- ✓ Implemented user active/inactive toggle functionality with Switch components
- ✓ Added organization CRUD operations with proper validation and error handling
- ✓ Created API endpoints for updating users and organizations with admin-only access
- ✓ Fixed bcrypt import issues in storage layer using dynamic imports
- ✓ Updated navigation to use home icon back links instead of arrow buttons
- ✓ Replaced admin table interface with discrete settings wheel next to user icon
- ✓ Added organization deletion functionality with confirmation dialogs
- ✓ Implemented comprehensive admin dashboard with user and organization statistics
- ✓ Fixed authentication issues in all admin mutations by implementing proper apiRequest helper usage
- ✓ Added "Add Organization" functionality to AdminPanel with complete form validation
- ✓ Resolved 401 authentication errors affecting user creation, organization updates, and user toggles
- ✓ Added DialogDescription components to fix accessibility warnings
- ✓ Successfully tested end-to-end admin workflow: organization creation, user management, and settings updates
- ✓ Implemented comprehensive admin password reset system with temporary password generation
- ✓ Added "Reset Password" buttons to user management interface with secure 12-character temporary passwords
- ✓ Created password change dialog component requiring users to set new passwords after reset
- ✓ Enhanced authentication flow to detect temporary passwords and force password changes on login
- ✓ Updated database schema with isTemporaryPassword field for tracking password status
- ✓ Successfully tested complete password reset workflow: admin resets → user logs in → forced password change → normal access
- ✓ Enhanced password reset system to accept admin-specified custom temporary passwords
- ✓ Added reset password dialog in Organization Config with form validation for temporary password input
- ✓ Updated API endpoints to handle custom temporary passwords instead of auto-generated ones
- ✓ Verified end-to-end workflow: admin sets custom temp password → user receives it → forced password change on login
- ✓ Removed demo credentials from login screen for production-ready appearance
- ✓ Removed user registration functionality - system is now invitation-only
- ✓ Removed registration routes from both frontend and backend
- ✓ Created production admin account (joshfarm@gmail.com) with full admin privileges in primary organization
- ✓ Diagnosed and fixed AI extraction issues: API calls succeeding but returning empty responses
- ✓ Identified API key conflict between GOOGLE_API_KEY and GEMINI_API_KEY  
- ✓ Verified Gemini API connectivity with standalone test script - API is functional
- ✓ Fixed 503 model overload errors with retry logic and exponential backoff
- ✓ Successfully implemented real AI data extraction from PDF documents
- ✓ **MAJOR BREAKTHROUGH**: Real AI data extraction now fully operational with Gemini API
- ✓ Fixed critical token limit issues by reducing max_output_tokens to 2,048 and simplifying prompts
- ✓ Resolved response parsing bugs - properly extract text from API candidate parts without modifying read-only properties
- ✓ Successfully tested end-to-end: PDF upload → real AI extraction → verification interface with actual contract data
- ✓ System now extracts authentic data (company names, dates, addresses) with high confidence scores (0.98)
- ✓ Processing time optimized to 6 seconds vs previous timeout issues
- ✓ **CRITICAL DATE FIELD FIX**: Resolved date field value handling to ensure proper date type behavior
- ✓ Fixed AI extraction value normalization to convert empty date strings to null values
- ✓ Enhanced field validation processing to handle DATE field types with proper null handling
- ✓ Verified date fields now display "Not set" for empty values with correct "Unverified" status
- ✓ Date picker functionality working correctly for manual date input and editing
- ✓ **CONFIDENCE RATING SYSTEM**: Implemented comprehensive confidence percentage display with color-coded badges
- ✓ Added knowledge-based confidence calculation with field-specific adjustments (company names, dates, addresses)
- ✓ Created visual confidence badges: Green (80-100%), Yellow (50-79%), Red (1-49%) with "Confidence: X%" labels
- ✓ Enhanced AI extraction to return proper null values instead of string "null" for missing data
- ✓ Confidence system shows percentages only for extracted fields, hidden for empty/invalid fields
- ✓ **PROJECT PUBLISHING SYSTEM**: Implemented organization-based project sharing functionality
- ✓ Added Publishing tab with organization selection and publish/unpublish capabilities
- ✓ Created project publishing database schema and API endpoints with proper authentication
- ✓ **ROLE-BASED ACCESS CONTROL**: Implemented granular tab access restrictions
- ✓ Users with 'user' role can only access Upload and Data tabs (cannot configure schema or rules)
- ✓ Publishing tab restricted to admins of primary organization ('Internal') only
- ✓ Admin users from external organizations can access Define Data and Knowledge/Rules but not Publishing
- ✓ **UI CLEANUP AND CONSISTENCY**: Streamlined interface headers and navigation
- ✓ Consolidated NewUpload tab headers into single "Add New {Main Object Name}" header
- ✓ Combined Documents and Configuration sections into unified card without separate headers
- ✓ Removed redundant sidebar titles and warning messages for cleaner appearance
- ✓ Updated "All Data" tab to "All {Main Object Name}s" with proper plural naming
- ✓ Changed upload description to organization-focused messaging ("into your organization's desired format")
- ✓ Fixed SessionView Publishing tab visibility with consistent role-based access control
- ✓ Added back arrow navigation to session review pages with actual session names as titles

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
- ✓ Built comprehensive New Upload system with file validation and session management
- ✓ Fixed critical API request format issues affecting all CRUD operations
- ✓ Successfully tested end-to-end workflow from project creation to data extraction
- ✓ Applied consistent layout spacing with p-8 padding between sidebar and content areas
- ✓ Fixed SelectItem empty string value error in extraction rule dialog
- ✓ Converted Target Field to multi-select with badge display and removal functionality
- ✓ Improved project deletion error handling to prevent double-click issues
- ✓ Created complete AI extraction system using Google Gemini API
- ✓ Added Python service for document processing with structured prompts
- ✓ Updated database schema to store extraction results
- ✓ Built API endpoint for AI processing workflow with error handling
- ✓ Integrated frontend to trigger AI extraction after file upload
- ✓ Added demo data fallback when API key is not configured
- ✓ Implemented comprehensive field validation system with visual feedback
- ✓ Created ValidationIcon component with green checkmarks for valid fields and red warnings for invalid
- ✓ Added field-level validation status tracking in database schema
- ✓ Enhanced AI extraction to include validation logic and reasoning
- ✓ Built SessionView component for detailed validation review and manual editing
- ✓ Integrated manual override functionality for field validation
- ✓ Added validation progress tracking and completion percentage display
- ✓ Updated AllData component to show session validation details
- ✓ Implemented Main Object Name feature with dynamic UI renaming throughout application
- ✓ Added mainObjectName field to projects database schema with default "Session" value
- ✓ Created editable Main Object Name section in DefineData component with inline editing
- ✓ Updated all UI components to dynamically use Main Object Name (NewUpload, AllData, SessionView, ProjectLayout)
- ✓ Enhanced tab navigation and headers to reflect custom object naming (e.g., "Invoice Data", "Upload New Contract")
- ✓ Applied contextual naming to field labels, buttons, and descriptions throughout interface
- ✓ Implemented welcome flow for new projects with Define Data tab as introduction
- ✓ Added isInitialSetupComplete field to projects database schema with automatic completion marking
- ✓ Created welcome banner with step-by-step guidance that displays only for new projects
- ✓ Enhanced navigation with disabled states for incomplete projects until first schema field/collection is added
- ✓ Added always-visible "Add Field" and "Create Collection" buttons for easy line-by-line data entry
- ✓ Improved UI consistency by moving action buttons to dedicated sections within each tab
- ✓ Fixed date field editing functionality with proper null value handling and date formatting
- ✓ Enhanced date display to show "Not set" for empty values and readable format for valid dates

## Current Status

**Phase 9 Complete**: Multi-Tenancy and Admin Panel
- Complete authentication system with JWT tokens and bcrypt password hashing
- Role-based access control with Admin/User roles and organization-level data isolation
- Multi-tenancy where users belong to organizations and can only access their organization's data
- Admin panel with settings wheel navigation for managing organizations and users
- User active/inactive toggle functionality with real-time status updates
- Organization CRUD operations with proper validation and deletion capabilities
- Fully functional admin operations with proper JWT authentication for all API calls
- Complete organization creation, user management, and settings update workflow
- Complete project management with dashboard and detailed views
- Four-tab navigation: New Upload, Define Data, Knowledge/Rules, All Data
- Schema definition with global fields and object collections
- Knowledge base with document upload and extraction rules
- File upload system with drag-and-drop, validation, and progress tracking
- Extraction session management with status tracking and data overview
- Field-level validation with visual indicators and AI-driven explanations
- Manual override system for invalid fields with inline editing
- Progress tracking showing validation completion percentages
- Dynamic Main Object Name system that contextualizes the entire interface
- Customizable object naming (e.g., "Invoice", "Contract", "Report") with real-time UI updates
- Contextual field labels and navigation that adapt to user's domain
- Welcome flow for new projects with guided setup process
- Tab restrictions until initial data schema is defined
- Always-visible "Add Field" and "Create Collection" buttons for easy data entry
- Streamlined UI with dedicated action buttons in each section
- Full CRUD operations for all entities with proper error handling
- Responsive UI with modern design and accessibility features

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

### Document Processing Flow (Implemented)
1. User uploads documents through drag-and-drop interface with file validation
2. Creates extraction session with metadata and configuration
3. System simulates AI processing workflow with progress indicators
4. Results stored in database and displayed in All Data section
5. Session status tracking from in_progress to verified/completed

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