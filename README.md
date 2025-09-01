# extrapl - AI-Powered Document Data Extraction Platform

extrapl is an AI-powered document data extraction platform designed for legal and business documents. It streamlines data extraction from complex documents, reduces manual effort, and improves accuracy through intelligent AI analysis and collaborative validation workflows.

## What It Does

- **Document Processing**: Upload and extract data from PDFs, Word documents, and Excel files
- **AI-Powered Extraction**: Uses Google Gemini AI to intelligently extract structured data
- **Validation Workflows**: Manual review and validation system for AI-extracted data
- **Project Management**: Multi-tenant system supporting organizations and projects
- **Collaborative Workspaces**: Team-based document processing and review
- **Excel Export**: Export validated data to Excel with proper formatting

## Quick Start

### Prerequisites

- Node.js 18+ 
- Python 3.11+
- PostgreSQL database
- Google Gemini API key

### Environment Variables

Create a `.env` file with:

```bash
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/extrapl

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Session Management
SESSION_SECRET=your_session_secret_here

# Optional: File Storage
GOOGLE_CLOUD_STORAGE_BUCKET=your_bucket_name
```

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set up Database**
   ```bash
   npm run db:push
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5000`

## Project Structure

```
extrapl/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Main application pages
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and configurations
├── server/                # Express.js backend
│   ├── routes.ts          # API endpoints
│   ├── db.ts             # Database operations
│   ├── auth.ts           # Authentication logic
│   └── gemini.ts         # AI integration
├── shared/                # Shared TypeScript definitions
│   └── schema.ts         # Database schema (Drizzle ORM)
├── *.py                  # Python AI extraction services
└── package.json          # Dependencies and scripts
```

## Key Features

### Document Upload & Processing
- Supports PDF, DOCX, XLSX file formats
- Intelligent content extraction and chunking
- Automatic text preprocessing and normalization

### AI-Powered Extraction
- Google Gemini integration for intelligent data extraction
- Configurable extraction schemas and workflows
- Confidence scoring and reasoning for extracted data

### Validation System
- Manual review interface for AI results
- Field-level validation with visual indicators
- Bulk validation operations for efficiency

### Project Management
- Multi-tenant organization structure
- Role-based access control
- Project-specific extraction schemas and rules

## Technologies Used

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** with shadcn/ui components
- **Wouter** for routing
- **TanStack Query** for state management
- **React Hook Form** with Zod validation

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL
- **Passport.js** for authentication
- **Express Session** for session management

### AI & Processing
- **Google Gemini API** for AI extraction
- **Python services** for document processing
- **Pandas** for Excel data manipulation

## Common Commands

```bash
# Development
npm run dev              # Start development server

# Database
npm run db:push          # Sync schema changes to database
npm run db:push --force  # Force sync (if warnings appear)

# Production
npm start               # Start production server
```

## File Upload Limits

- PDF files: Up to 50MB
- Excel files: Up to 25MB  
- Word documents: Up to 25MB
- Maximum 10 files per upload session

## First Time Setup

### Creating Your First User

1. Start the application with `npm run dev`
2. Navigate to `http://localhost:5000/register`
3. Create an organization and admin user account
4. Use these credentials to log in at `/login`

### Sample Data

To test the extraction workflow:
1. Log in and create a new project
2. Navigate to the project's Configure page
3. Set up workflow steps (Info Pages for single values, Data Tables for lists)
4. Create a new session and upload test documents
5. Run extractions on your configured fields

## Common Development Tasks

### Adding a New API Endpoint

1. Add the route handler in `server/routes.ts`
2. Add any database operations to `server/storage.ts`
3. Update TypeScript types in `shared/schema.ts` if needed
4. Create/update React hooks in `client/src/hooks/`

### Working with Python Extraction Scripts

```bash
# Test a Python script directly
python extraction_wizardry.py < test_input.json

# Debug Python subprocess calls from Node.js
# Add console.log in server/routes.ts before spawn()
# Python stdout/stderr will appear in terminal
```

### Database Operations

```bash
# Apply schema changes
npm run db:push

# Force push (data loss warning)
npm run db:push --force

# Connect to database directly
psql $DATABASE_URL
```

## Troubleshooting

### Common Issues

**Python extraction fails silently**
- Check Python dependencies are installed
- Verify GEMINI_API_KEY is set correctly
- Look for Python errors in server console output

**Database connection errors**
- Verify DATABASE_URL is correctly formatted
- Check PostgreSQL is running
- Ensure database exists and user has permissions

**File upload issues**
- Check file size limits in `server/routes.ts`
- Verify mime type validation
- Ensure temp directory has write permissions

**Authentication problems**
- Clear browser cookies/localStorage
- Check SESSION_SECRET is set
- Verify JWT token expiration

## API Reference

### Key Endpoints

- `POST /api/auth/login` - User authentication
- `GET /api/projects` - List user's projects
- `POST /api/sessions/:id/documents` - Upload documents
- `POST /api/sessions/:id/extract-column` - Run extraction
- `GET /api/sessions/:id/validations` - Get extraction results
- `POST /api/sessions/:id/export` - Export to Excel

See `server/routes.ts` for complete API documentation.

## Getting Help

- Check the codebase documentation in `CODEBASE_OVERVIEW.md`
- Review the existing `replit.md` for detailed architecture information
- Examine the shared schema in `shared/schema.ts` for database structure
- Python extraction logic is in `extraction_wizardry.py`

## Security Notes

- Environment variables contain sensitive API keys
- Session secrets should be cryptographically secure
- Database credentials should follow principle of least privilege
- File uploads are validated for type and size limits
- Python functions run in sandboxed environment