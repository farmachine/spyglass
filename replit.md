# extrapl - AI-Powered Document Data Extraction Platform

## Overview
extrapl is an AI-powered document data extraction platform for legal and business documents, offering enhanced conflict detection and collaborative workspaces. It allows users to configure extraction schemas, upload documents, and review AI-analyzed data with knowledge-based validation. The platform streamlines data extraction from complex documents, reducing manual effort and improving accuracy, with significant market potential.

## User Preferences
Preferred communication style: Simple, everyday language.

## Development Rules & Principles

### Core Architectural Rules
1. **NEVER hardcode fixes** - All solutions must respect the existing architecture
2. **Suggest before implementing** - Propose changes and explain the approach before making them
3. **Maintain data flow integrity** - Respect the established data pipeline: extraction → validation → display
4. **Preserve existing patterns** - Follow established coding patterns and conventions in the codebase
5. **No patchy workarounds** - Address root causes, not symptoms

### Code Modification Guidelines
1. **Investigate thoroughly first** - Understand the complete data flow before proposing changes
2. **Respect the unified architecture** - Maintain consistency with workflow_steps and step_values tables
3. **Trust AI outputs** - Assume AI is correct; fix data processing, not prompts
4. **Maintain identifier consistency** - Use identifierId as the primary linking mechanism across all systems
5. **No arbitrary reordering** - Preserve original data order throughout the pipeline

### Communication Protocol
1. **Explain the issue** - Clearly identify what's wrong and why
2. **Propose the solution** - Describe the fix and its architectural impact
3. **Wait for approval** - Get confirmation before implementing changes
4. **Test thoroughly** - Verify changes work without breaking existing functionality
5. **Document significant changes** - Update this file with architectural decisions

### Data Integrity Rules
1. **Maintain order consistency** - Data order from source must be preserved through extraction, storage, and display
2. **Use proper identifiers** - Always use identifierId for row mapping, not array indices
3. **Respect validation states** - Don't modify validated records unless explicitly requested
4. **Preserve extraction context** - Keep reference documents and parameters intact

### Tool & Extraction Rules
1. **Tools are configuration-driven** - No hardcoded tool-specific logic
2. **Extraction is generic** - All tools follow the same extraction pattern
3. **AI prompts are data** - Store prompts in database, not in code
4. **Functions are reusable** - Excel wizardry functions must work across different contexts

## System Architecture

### UI/UX Decisions
- **Color Scheme**: Professional slate blue (`#4F63A4`).
- **Visual Consistency**: Unified borderless design for statistics cards; consistent tick-based verification icons.
- **Layout**: Optimized dashboard and form layouts for better space utilization.
- **Interaction**: Icon-only UI, comprehensive optimistic updates, streamlined workflow.
- **Responsiveness**: Responsive design.
- **Navigation**: Consolidated "Configure" interface (`/projects/:id/configure`), streamlined session view with integrated left sidebar. Distinct "extrapl • Configure" for project configuration and "extrapl • Admin" for system administration.
- **Terminology**: "Extraction Sessions" renamed to "Overview"; "Data" tab renamed to "Flow".
- **Flow Interface**: Simplified workflow builder with type selector, data type icons, tool filtering, and minimal output display.
- **Dynamic Page Titles**: Contextual titles using `usePageTitle` hook.
- **Dark Mode**: Comprehensive dark mode theming for admin pages with toggle.

### Technical Implementations
- **Frontend**: React 18 with TypeScript, Tailwind CSS with shadcn/ui, Wouter for routing, TanStack Query for state, React Hook Form with Zod for forms, Vite for build.
- **Backend**: Express.js with TypeScript, Node.js (ESM), RESTful API.
- **Database**: PostgreSQL with Drizzle ORM and Drizzle Kit for migrations.
- **Document Processing**: Supports PDF, DOCX, DOC, XLSX, XLS with intelligent chunking and Python-based Excel processing.
- **AI Integration**: Hybrid extraction combining direct extraction with AI-powered reasoning using Google Gemini API for extraction, validation, conflict detection, and dynamic Excel function generation.
- **Multi-Tenancy**: Role-based access control and organization-level data isolation.
- **Data Validation**: Field-level validation with visual indicators, manual editing, and revert-to-AI options.
- **Workflow**: Streamlined multi-step loading and automated extraction flow.
- **Dynamic Features**: Dynamic naming, column resizing, drag-and-drop reordering, multi-sheet Excel export.
- **AI Chat**: Real-time context-aware chat within session views.
- **Modal-Based Extraction**: Targeted extraction for specific documents and fields.
- **Prompt Management**: Centralized prompt control for consistent AI behavior.
- **Complete Extraction Workflow**: End-to-end document analysis.
- **Session Document Storage**: Documents and extracted content stored in PostgreSQL for tracking and AI chat context.
- **Dual Extraction Mode**: Project schema supports configurable AI vs. Function extraction types.
- **Excel Wizardry Functions**: Reusable, AI-generated Python functions for Excel extraction stored in PostgreSQL, with sandboxed execution.
- **Enhanced Excel Preprocessing**: Intelligent system for cleaning and normalizing Excel data.
- **Multi-Step Extraction**: Auto-rerun functionality with progressive identifier reference chaining, supporting function reuse, new function generation, and AI extraction.
- **Unified Extraction System**: All extraction endpoints use `extraction_wizardry.py`.
- **Sequential Function Extraction**: Identifier reference chaining between function extractions, with proper iteration over previous step results.
- **Enhanced Field Validation Mapping**: Proper identifierId-based mapping for field validations.
- **Unified Tool-First Configuration**: Redesigned field configuration interfaces with dynamic form generation and @-key referencing.
- **AI Function Training**: Enhanced AI training prompts for function generation, including array iteration and single object processing, with Excel format training.
- **Manual Fix System**: Endpoints for correcting pandas-based functions when AI generation fails.
- **Complete Tool Testing Workflow**: Document extraction on tool creation, structured sample data storage, enhanced test UI, debug workflow, and automatic sample document/data replacement.
- **Unified Database Architecture**: Schema fields and collections consistently treated as "steps" with "values" using `workflow_steps` and `step_values` tables. `workflow_steps` stores Info Pages and Data Tables, tracking `valueCount` and `identifierId`. `step_values` stores value configuration including `toolId` and `inputValues`.
- **Clean Extraction Pipeline**: Tool-based architecture where each value uses only its assigned tool via toolId. IdentifierIds are generated at database save time (proper UUIDs) for first columns, then passed via previousData for subsequent columns. Extraction functions never generate identifierIds - they only extract data values.

### Key Architectural Decisions
- **Monorepo Structure**: Single repository with shared types.
- **Drizzle ORM**: TypeScript-first ORM with strong type inference.
- **shadcn/ui**: Consistent, accessible components with high customizability.
- **React Query**: Manages server state, caching, and data synchronization.
- **Zod Integration**: Ensures runtime validation matching TypeScript types.
- **Express + Vite**: Robust backend with modern frontend tooling.
- **UUID Consistency**: Full UUID string consistency across all storage interfaces.
- **Graceful Error Handling**: Session views load successfully even with empty AI results.

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