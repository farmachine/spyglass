# extrapl Codebase Overview

This document provides a detailed technical overview of the extrapl codebase architecture, data flow, and key components.

## High-Level Architecture

extrapl follows a modern full-stack architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │───▶│  Express API    │───▶│   PostgreSQL    │
│   (Frontend)    │    │   (Backend)     │    │   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Python Services │
                       │ (AI Extraction) │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │  Gemini AI API  │
                       │  (Google Cloud) │
                       └─────────────────┘
```

## Database Relationships

### Entity Relationship Overview

```
organizations (1) ─────┬──── (*) users
                       ├──── (*) projects ──────┬──── (*) workflowSteps ──── (*) stepValues
                       │                        ├──── (*) extractionSessions ─┬── (*) sessionDocuments
                       │                        │                             └── (*) fieldValidations
                       │                        ├──── (*) knowledgeDocuments
                       │                        ├──── (*) extractionRules
                       │                        └──── (*) excelWizardryFunctions
                       └──── (*) projectPublishing
```

### Key Relationships

- **Multi-tenancy**: All data is scoped to organizations
- **Projects**: Belong to organizations, define extraction workflows
- **Workflow Steps**: Define the structure (Info Pages or Data Tables)
- **Step Values**: Individual fields/columns within steps
- **Sessions**: Instances of document processing for a project
- **Validations**: Store extraction results linked to sessions and values
- **Functions**: Reusable Python code for Excel extraction

## Core Components

### 1. Frontend (React/TypeScript)

**Location**: `client/src/`

**Key Technologies**:
- React 18 with TypeScript
- Tailwind CSS + shadcn/ui components
- Wouter for routing
- TanStack Query for server state
- React Hook Form + Zod for forms

**Main Directories**:
- `pages/` - Top-level application routes and views
- `components/` - Reusable UI components
- `hooks/` - Custom React hooks for data fetching
- `lib/` - Utilities and configurations
- `contexts/` - React context providers (Auth, Theme)

### 2. Backend (Express/TypeScript)

**Location**: `server/`

**Key Files**:
- `routes.ts` - Main API endpoint definitions
- `auth.ts` - Authentication and session management
- `db.ts` - Database connection and query helpers
- `gemini.ts` - Google Gemini AI integration
- `storage.ts` - File storage and management
- `toolEngine.ts` - AI extraction workflow engine

**Key Technologies**:
- Express.js with TypeScript
- Drizzle ORM for database operations
- Passport.js for authentication
- Express sessions for state management

### 3. AI Processing (Python)

**Key Files**:
- `extraction_wizardry.py` - Main AI extraction orchestrator
- `document_extractor.py` - Document parsing and preprocessing
- `excel_wizard.py` - Excel-specific processing logic
- `enhanced_excel_extractor.py` - Advanced Excel data extraction

**Purpose**: 
- Process uploaded documents (PDF, DOCX, XLSX)
- Interface with Google Gemini API for AI extraction
- Handle complex data transformations and validations

### 4. Database Layer

**Schema Definition**: `shared/schema.ts`

**Key Tables**:
- `users` - User accounts and authentication
- `organizations` - Multi-tenant organization structure
- `projects` - Extraction projects and configurations
- `sessions` - Document processing sessions
- `validations` - AI extraction results and manual validations
- `documents` - Uploaded file metadata and content

## Data Flow

### 1. Document Upload Flow

```
User Upload → Frontend Validation → Express Route → File Storage → Document Processing → Database Storage
```

**Steps**:
1. User selects files in React frontend
2. Files validated for type/size limits
3. POST to `/api/sessions/:id/documents`
4. Files stored in temporary/cloud storage
5. Python document processor extracts text content
6. Processed content saved to database

### 2. AI Extraction Flow

```
User Triggers Extraction → API Route → Python Service → Gemini AI → Results Processing → Database Storage → Frontend Update
```

**Steps**:
1. User initiates extraction from UI
2. Frontend calls extraction API endpoint
3. Express routes to appropriate Python service
4. Python service prepares data and calls Gemini API
5. AI results processed and validated
6. Results stored in validations table
7. Frontend receives updated data via React Query

### 3. Validation Workflow

```
AI Results → Manual Review Interface → User Validation → Status Updates → Export Generation
```

**Steps**:
1. AI extraction creates validation records with 'pending' status
2. User reviews results in validation interface
3. User can accept, reject, or modify extracted values
4. Validation status updated ('valid', 'invalid', 'manual')
5. Validated data available for Excel export

## Key Design Patterns

### 1. Multi-Tenancy

**Implementation**:
- Organization-based data isolation
- Role-based access control (RBAC)
- Project-level permissions and configurations

**Files**:
- Database schema enforces organization boundaries
- Authentication middleware checks organization membership
- Frontend routes protected by organization context

### 2. Optimistic Updates

**Pattern**: Frontend immediately updates UI, then syncs with server

**Implementation**:
- TanStack Query mutations with optimistic updates
- Automatic cache invalidation on server changes
- Error handling with rollback capabilities

**Example**: When user validates a field, UI immediately shows "validated" state while API call processes in background

### 3. Modular AI Processing

**Pattern**: Pluggable extraction tools and workflows

**Implementation**:
- `toolEngine.ts` orchestrates different extraction methods
- Python services can be AI-based or function-based
- Configurable extraction schemas per project

## External Integrations

### 1. Google Gemini AI

**Purpose**: Intelligent document data extraction
**Integration**: Python services call Gemini API with structured prompts
**Configuration**: API key managed via environment variables

### 2. PostgreSQL Database

**Purpose**: Primary data storage
**ORM**: Drizzle ORM with TypeScript definitions
**Deployment**: Neon database (cloud PostgreSQL)

### 3. File Storage

**Options**: 
- Local filesystem (development)
- Google Cloud Storage (production)
**Configuration**: Environment variable controlled

## Security Considerations

### 1. Authentication
- Session-based authentication with Express sessions
- Password hashing with bcrypt
- CSRF protection enabled

### 2. Data Isolation
- Organization-level data separation
- Role-based access controls
- API route protection middleware

### 3. File Upload Security
- File type validation
- Size limit enforcement
- Temporary file cleanup

## Understanding the Extraction Workflow

### Complete Extraction Process

1. **Project Configuration**
   - User creates workflow steps (Info Pages or Data Tables)
   - Each step contains values (fields/columns) to extract
   - Values are configured with extraction tools (AI or Function-based)

2. **Document Upload**
   - Files uploaded to session
   - Python `document_extractor.py` processes content
   - Text stored in `session_documents` table

3. **Extraction Execution**
   - User selects values to extract
   - `extraction_wizardry.py` orchestrates the process
   - For AI: Sends document + prompts to Gemini
   - For Functions: Executes stored Python pandas code
   - Results include extracted value, confidence, reasoning

4. **Identifier Reference Chaining**
   - First column in Data Tables becomes identifier
   - Subsequent extractions can reference previous results
   - Uses `@column_name` syntax for references
   - Enables multi-step dependent extractions

5. **Validation & Export**
   - Results stored in `fieldValidations` table
   - Users review and validate/reject results
   - Export generates Excel with proper sheet structure

### Key Code Patterns

#### API Route Pattern
```typescript
// server/routes.ts
app.post("/api/resource", authenticateToken, async (req, res) => {
  try {
    const validated = insertSchema.parse(req.body);
    const result = await storage.createResource(validated);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

#### React Query Hook Pattern
```typescript
// client/src/hooks/useResource.ts
export function useResource(id: string) {
  return useQuery({
    queryKey: ['/api/resource', id],
    enabled: !!id,
  });
}
```

#### Python Subprocess Pattern
```typescript
// server/routes.ts
const python = spawn('python', ['script.py']);
python.stdin.write(JSON.stringify(inputData));
python.stdin.end();

let output = '';
python.stdout.on('data', (data) => {
  output += data.toString();
});

python.on('close', (code) => {
  if (code === 0) {
    const result = JSON.parse(output);
    res.json(result);
  }
});
```

## Development Workflow

### 1. Database Changes
1. Modify `shared/schema.ts`
2. Run `npm run db:push` to sync schema
3. Use `--force` flag if conflicts arise
4. Update storage.ts interfaces if needed

### 2. Adding New Features
1. Define API routes in `server/routes.ts`
2. Add storage methods in `server/storage.ts`
3. Create React components/pages in `client/src/`
4. Add TypeScript types to `shared/schema.ts`
5. Create hooks in `client/src/hooks/`
6. Test functionality end-to-end

### 3. AI Integration
1. Add Python processing in appropriate service file
2. Define extraction prompts in `all_prompts.py`
3. Connect via API routes that call Python subprocess
4. Handle results in frontend validation interface
5. Test with sample documents

### 4. Debugging Tips

**Frontend Issues:**
- Check browser console for errors
- Use React DevTools for component state
- Verify API responses in Network tab
- Check TanStack Query cache state

**Backend Issues:**
- Add console.log before database operations
- Check TypeScript compilation errors
- Verify environment variables are loaded
- Monitor Python subprocess output

**Python Script Issues:**
- Test scripts independently with JSON input
- Add print statements for debugging
- Check stderr output from subprocess
- Verify all dependencies are installed

## Performance Considerations

### 1. Database Queries
- Drizzle ORM provides type-safe queries
- Indexes defined on frequently queried columns
- Connection pooling for concurrent requests

### 2. File Processing
- Asynchronous document processing
- Streaming for large file uploads
- Temporary file cleanup to manage disk space

### 3. Frontend Optimization
- React Query caching reduces API calls
- Component-level code splitting
- Optimistic updates for better UX

## Monitoring and Debugging

### 1. Logging
- Console logging throughout Python services
- Express request/response logging
- Frontend error boundaries for React errors

### 2. Error Handling
- Structured error responses from API
- User-friendly error messages in UI
- Fallback states for failed operations

### 3. Development Tools
- Hot reload for both frontend and backend
- TypeScript compilation checking
- Database schema validation