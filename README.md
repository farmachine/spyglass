# extrapl - AI-Powered Document Data Extraction Platform

## Overview

extrapl is an enterprise-grade platform that uses AI to extract structured data from legal and business documents. It supports PDF, Word, and Excel files, offering intelligent field mapping, validation, and collaborative workspaces.

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Python 3.8+ (for AI extraction scripts)
- Google Gemini API key

### Environment Variables

Create a `.env` file with the following:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/extrapl

# AI Configuration
GEMINI_API_KEY=your-gemini-api-key-here
GOOGLE_API_KEY=your-google-api-key-here  # Alternative to GEMINI_API_KEY

# Session Secret (for authentication)
SESSION_SECRET=your-session-secret-here

# Optional: Object Storage (for document uploads)
# Configure if using cloud storage instead of local
```

### Installation

1. Install Node.js dependencies:
```bash
npm install
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
# or using uv (if available):
uv pip install -r pyproject.toml
```

3. Set up the database:
```bash
npm run db:push
```

### Running the Application

Development mode:
```bash
npm run dev
```

This starts both the Express backend (port 5000) and Vite dev server for the frontend.

Production build:
```bash
npm run build
npm start
```

## Features

- **Multi-tenancy**: Organization-based data isolation
- **Document Processing**: Supports PDF, DOCX, XLSX formats
- **AI Extraction**: Powered by Google Gemini for intelligent data extraction
- **Workflow Builder**: Visual tool for configuring extraction schemas
- **Validation System**: Field-level validation with manual override options
- **Session Management**: Track extraction sessions with version history
- **Excel Functions**: Custom Python-based functions for Excel data extraction
- **Real-time Chat**: Context-aware AI assistant within sessions

## Project Structure

```
extrapl/
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route pages
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities and helpers
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database abstraction layer
│   └── *.ts          # Service modules
├── shared/           # Shared types and schemas
│   └── schema.ts     # Database schema definitions
└── *.py             # Python AI extraction scripts
```

## API Endpoints

The application exposes a RESTful API at `/api/*`:

- **Authentication**: `/api/auth/*` - Login, register, session management
- **Projects**: `/api/projects/*` - Project CRUD operations
- **Sessions**: `/api/sessions/*` - Extraction session management
- **Validations**: `/api/validations/*` - Field validation operations
- **Documents**: `/api/documents/*` - Document upload and processing
- **Workflow**: `/api/workflow-steps/*` - Workflow configuration

## Database Schema

The application uses PostgreSQL with the following main tables:
- `organizations` - Multi-tenant organizations
- `users` - User accounts with role-based access
- `projects` - Extraction projects
- `workflow_steps` - Configurable extraction steps
- `step_values` - Values within workflow steps
- `extraction_sessions` - Document extraction sessions
- `field_validations` - Extracted field validations

## Testing

Run TypeScript type checking:
```bash
npm run check
```

## Deployment

The application is designed to run on platforms that support Node.js and PostgreSQL. Ensure all environment variables are properly configured in your deployment environment.

### Key Deployment Considerations

1. **Database**: Requires PostgreSQL 14+
2. **File Storage**: Configure object storage for production
3. **Timeouts**: AI extraction can take 2-5 minutes for large documents
4. **Memory**: Recommend 2GB+ RAM for processing large Excel files
5. **Python Runtime**: Required for document processing scripts

## Troubleshooting

### Common Issues

1. **Database connection errors**: Check DATABASE_URL format
2. **AI extraction failures**: Verify GEMINI_API_KEY is valid
3. **File upload issues**: Ensure proper storage permissions
4. **Session timeouts**: Configured for 5 minutes on AI endpoints

### Logs

- Server logs appear in the console when running `npm run dev`
- Database operations log to console in development mode
- Python extraction scripts output to stdout

## Support

For issues or questions, please check the codebase documentation in `CODEBASE_OVERVIEW.md`.