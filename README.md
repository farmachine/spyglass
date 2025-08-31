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

## Getting Help

- Check the codebase documentation in `CODEBASE_OVERVIEW.md`
- Review the existing `replit.md` for detailed architecture information
- Examine the shared schema in `shared/schema.ts` for database structure

## Security Notes

- Environment variables contain sensitive API keys
- Session secrets should be cryptographically secure
- Database credentials should follow principle of least privilege
- File uploads are validated for type and size limits