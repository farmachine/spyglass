# Codebase Architecture Overview

## System Architecture

extrapl follows a three-tier architecture with clear separation of concerns:

```
┌─────────────────────────────────────┐
│         React Frontend              │
│     (TypeScript, Tailwind CSS)      │
└──────────────┬──────────────────────┘
               │ REST API
┌──────────────▼──────────────────────┐
│         Express Backend             │
│    (TypeScript, Node.js ESM)        │
└──────────────┬──────────────────────┘
               │ 
┌──────────────▼──────────────────────┐
│  PostgreSQL DB │ Python AI Scripts  │
│  (Drizzle ORM) │ (Gemini API)       │
└─────────────────────────────────────┘
```

## Core Components

### Frontend (`/client`)

#### Key Pages (`/client/src/pages`)
- **Login.tsx/Register.tsx**: Authentication flow
- **Dashboard.tsx**: Main user dashboard showing projects
- **ProjectView.tsx**: Project configuration and schema setup
- **SessionView.tsx**: Document extraction session interface (main workspace)
- **AdminPanel.tsx**: System administration interface

#### Core Components (`/client/src/components`)
- **WorkflowBuilder.tsx**: Visual workflow configuration tool
- **DefineDataNew.tsx**: Schema field definition interface
- **SessionChat.tsx**: AI chat assistant interface
- **Various UI components**: Button, Card, Dialog, Form components from shadcn/ui

#### State Management
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state with Zod validation
- **Local State**: Component-level state for UI interactions

### Backend (`/server`)

#### Main Modules
- **index.ts**: Express server initialization and middleware setup
- **routes.ts**: All API route definitions and request handlers
- **storage.ts**: Database abstraction layer (supports both PostgreSQL and in-memory storage)
- **auth.ts**: Authentication logic using JWT and sessions
- **chatService.ts**: AI chat integration for session assistant
- **toolEngine.ts**: Execution engine for extraction tools
- **validationFilter.ts**: Field validation logic
- **vite.ts**: Vite integration for development

#### Key Features
- **Multi-tenancy**: Organization-based data isolation
- **Session Management**: Express sessions with PostgreSQL store
- **File Processing**: Document upload and text extraction
- **AI Integration**: Communication with Python extraction scripts

### Database (`/shared/schema.ts`)

#### Core Tables
- **organizations**: Multi-tenant organizations
- **users**: User accounts with roles (admin/user)
- **projects**: Extraction project configurations
- **workflow_steps**: Configurable extraction workflow steps
- **step_values**: Individual values within workflow steps
- **extraction_sessions**: Document extraction sessions
- **session_documents**: Documents uploaded to sessions
- **field_validations**: Extracted and validated field data
- **excel_wizardry_functions**: Reusable Python extraction functions

#### Migration Strategy
The system is transitioning from a schema/collection model to a unified workflow model:
- Legacy: `projectSchemaFields` + `objectCollections` + `collectionProperties`
- New: `workflowSteps` + `stepValues`

### AI Extraction (`/*.py`)

#### Python Scripts
- **extraction_wizardry.py**: Main extraction orchestrator
- **ai_extraction_wizard.py**: AI-powered field extraction
- **excel_wizard.py**: Excel-specific extraction logic
- **enhanced_excel_extractor.py**: Advanced Excel processing
- **document_extractor.py**: Document text extraction
- **column_mapping_extractor.py**: Column mapping logic
- **all_prompts.py**: AI prompt templates

#### Extraction Flow
1. Document upload → Text extraction
2. Schema analysis → Field identification  
3. AI processing → Value extraction
4. Validation → Manual review
5. Export → Structured data output

## Data Flow

### Document Processing Pipeline

```
1. User uploads document
   ↓
2. Server stores in object storage / database
   ↓
3. Python script extracts text/structure
   ↓
4. AI analyzes against schema
   ↓
5. Results saved to field_validations
   ↓
6. User reviews and validates
   ↓
7. Export to Excel/JSON
```

### Authentication Flow

```
1. User login → JWT token generation
2. Token stored in localStorage
3. API requests include Authorization header
4. Server validates token on each request
5. Session management via express-session
```

## Key Design Patterns

### 1. Storage Abstraction
- Interface `IStorage` defines all database operations
- Two implementations: `PostgreSQLStorage` and `MemStorage`
- Allows easy switching between production and development

### 2. Workflow-Based Extraction
- Steps can be "page" (single values) or "list" (multiple records)
- Each step contains ordered values with extraction tools
- Tools can reference other values using @syntax

### 3. Tool System
- Excel functions stored as reusable Python code
- Dynamic parameter mapping with @references
- Sandboxed execution environment

### 4. Validation States
- `pending`: Awaiting extraction
- `extracted`: AI extracted, needs review
- `valid`/`verified`: Human approved
- `invalid`: Marked as incorrect
- `manual`: Manually entered

## External Integrations

### Google Gemini API
- Primary AI model for extraction
- Configured via GEMINI_API_KEY
- Used for field extraction, validation, chat

### Object Storage
- Optional cloud storage for documents
- Falls back to database storage
- Supports pre-signed upload URLs

### Authentication
- JWT for API authentication
- Express sessions for web sessions
- bcrypt for password hashing

## Configuration Files

### TypeScript Configuration
- **tsconfig.json**: TypeScript compiler options
- **vite.config.ts**: Vite build configuration
- **drizzle.config.ts**: Database migration config
- **tailwind.config.ts**: Tailwind CSS customization

### Package Management
- **package.json**: Node.js dependencies
- **pyproject.toml**: Python dependencies
- **uv.lock**: Python lock file

## Development Workflow

### Hot Reloading
- Vite handles frontend with HMR
- tsx watches backend TypeScript files
- Automatic restart on file changes

### Database Migrations
- `npm run db:push`: Apply schema changes
- Drizzle Kit manages migrations
- No manual SQL required

### Type Safety
- TypeScript throughout frontend/backend
- Zod schemas for runtime validation
- Drizzle provides type-safe queries

## Performance Considerations

### Timeouts
- AI extraction: 5 minutes
- Regular API calls: 2 minutes
- Database operations: Retry logic included

### Caching
- TanStack Query caches API responses
- Session storage for auth tokens
- Database connection pooling

### Optimization
- Lazy loading for large components
- Pagination for data tables
- Chunked document processing

## Security Measures

### Authentication
- Password hashing with bcrypt
- JWT token expiration
- Session invalidation on logout

### Authorization
- Role-based access (admin/user)
- Organization-level isolation
- Project-level permissions

### Data Protection
- SQL injection prevention via Drizzle
- XSS protection in React
- CORS configuration for API

## Error Handling

### Frontend
- Toast notifications for user errors
- Error boundaries for component crashes
- Network retry logic

### Backend
- Try-catch blocks with logging
- Graceful degradation
- Detailed error responses in development

### Database
- Transaction support
- Retry logic for transient failures
- Foreign key constraints

## Monitoring and Logging

### Development
- Console logging for debugging
- Database query logging
- API request/response logging

### Production Considerations
- Structured logging format
- Error tracking integration points
- Performance metrics collection

## Future Considerations

The codebase shows signs of evolution:
- Migration from collections to workflow steps
- Expanding AI capabilities
- Enhanced Excel processing
- Real-time collaboration features

## Developer Notes

### Common Patterns
- Use `@` prefix for shadcn component imports
- Prefer editing existing files over creating new ones
- Follow existing code style and conventions
- Test changes thoroughly before committing

### Debugging Tips
- Check browser console for frontend errors
- Server logs in terminal for backend issues
- Database logs for query problems
- Python script output for extraction errors