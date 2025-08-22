# Extrapl App - Flow Steps Test Feature Development Plan

## Executive Summary
After deep analysis of the Extrapl codebase, I've identified the current state of the flow steps feature and areas that need development to create a comprehensive test feature that enables users to run extractions of structured data from documents.

## Current State Analysis

### What's Working
1. **Workflow Builder** (`client/src/components/WorkflowBuilder.tsx`)
   - Users can define multi-step workflows with "page" (single values) and "list" (collections) steps
   - Each step can have multiple values with assigned tools
   - Test documents can be uploaded per step
   - Basic workflow persistence to database

2. **Tool System** (`server/toolEngine.ts`)
   - Two tool types: AI_ONLY and CODE
   - Tool testing infrastructure exists for individual tools
   - Tool parameter configuration and dynamic rendering
   - Document content extraction and preparation

3. **Individual Tool Testing** (`client/src/components/Tools.tsx`)
   - Users can test individual tools with sample inputs
   - Debug functionality for failed tests
   - AI-powered tool generation and fixes

4. **Document Processing** (`document_extractor.py`, `enhanced_excel_extractor.py`)
   - PDF, DOCX, and Excel file extraction
   - Enhanced Excel preprocessing for clean data
   - Text extraction stored in database

### What's Missing/Not Working

1. **No Batch Flow Execution**
   - Workflows are defined but there's no "Run Workflow" feature
   - No way to execute all steps sequentially on multiple documents
   - Missing UI for batch document processing

2. **No Test Run Management**
   - No test run history or results tracking
   - No comparison between test runs
   - No validation of workflow outputs

3. **Limited Step Orchestration**
   - Steps don't pass data between each other effectively
   - Identifier references system exists but isn't fully integrated with workflows
   - No conditional logic or branching in workflows

4. **Missing Processing Tab/Run Tab**
   - No dedicated UI for running workflows
   - No progress tracking during execution
   - No results visualization

## Root Cause Analysis

### 1. Incomplete Integration
The workflow builder saves step definitions but lacks the execution engine to run them. The `extraction_wizardry.py` script handles some extraction logic but isn't connected to the workflow system.

### 2. Missing Components
- **StepProcessor**: No component to execute workflow steps sequentially
- **RunTab/ProcessingTab**: No UI for initiating and monitoring workflow runs
- **BatchProcessor**: No system for handling multiple documents through a workflow

### 3. Data Flow Issues
- Step values can reference other steps (`@stepName.valueName`) but this isn't resolved during execution
- Test documents are uploaded but not used in actual workflow runs
- Results aren't aggregated or validated against expected outputs

## Development Plan

### Phase 1: Build Core Execution Engine

#### 1.1 Create WorkflowExecutor Service
**File**: `server/workflowExecutor.ts`
```typescript
class WorkflowExecutor {
  async executeWorkflow(projectId: string, documents: Document[], testMode: boolean = false)
  async executeStep(step: WorkflowStep, documents: Document[], previousResults: Map<string, any>)
  async resolveReferences(inputValues: Record<string, any>, previousResults: Map<string, any>)
}
```

#### 1.2 Implement Step Processing Logic
- Sequential step execution
- Reference resolution between steps
- Error handling and recovery
- Progress tracking and logging

### Phase 2: Create Test Run Infrastructure

#### 2.1 Database Schema Updates
**File**: `shared/schema.ts`
```typescript
// Add new tables
export const testRuns = pgTable('test_runs', {
  id: uuid('id').primaryKey(),
  projectId: uuid('project_id').references(() => projects.id),
  workflowSnapshot: json('workflow_snapshot'),
  status: text('status'), // 'pending', 'running', 'completed', 'failed'
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  results: json('results'),
  errors: json('errors')
});

export const testRunDocuments = pgTable('test_run_documents', {
  id: uuid('id').primaryKey(),
  testRunId: uuid('test_run_id').references(() => testRuns.id),
  documentId: uuid('document_id'),
  processingStatus: text('processing_status'),
  extractedData: json('extracted_data')
});
```

#### 2.2 Storage Layer Updates
**File**: `server/storage.ts`
- Add methods for test run management
- Store execution results and errors
- Track document processing status

### Phase 3: Build UI Components

#### 3.1 Create RunTab Component
**File**: `client/src/components/RunTab.tsx`
```typescript
interface RunTabProps {
  projectId: string;
  workflow: WorkflowStep[];
}

// Features:
// - Document upload/selection
// - Test vs Production mode toggle
// - Run workflow button
// - Progress indicator
// - Results viewer
```

#### 3.2 Create ProcessingStatus Component
**File**: `client/src/components/ProcessingStatus.tsx`
- Real-time progress updates
- Step-by-step execution visualization
- Error display and debugging info
- Results preview

### Phase 4: Connect Everything

#### 4.1 API Endpoints
**File**: `server/routes.ts`
```typescript
// New endpoints needed:
POST /api/projects/:projectId/test-runs          // Start a test run
GET  /api/test-runs/:runId                       // Get run status
GET  /api/test-runs/:runId/results               // Get run results
POST /api/test-runs/:runId/stop                  // Stop a running test
GET  /api/projects/:projectId/test-runs          // List all test runs
```

#### 4.2 Frontend Integration
- Add "Test Workflow" button to WorkflowBuilder
- Create navigation to RunTab
- Implement real-time updates using polling or websockets
- Add results export functionality

### Phase 5: Enhance Tool Integration

#### 5.1 Tool Chaining
- Implement proper parameter passing between steps
- Support for dynamic tool selection based on document type
- Add validation rules for tool outputs

#### 5.2 Batch Processing
- Parallel document processing within steps
- Result aggregation across documents
- Performance optimization for large batches

## Implementation Steps

### Week 1: Foundation
1. Create WorkflowExecutor service
2. Implement basic step execution logic
3. Add database schema for test runs
4. Create API endpoint for starting test runs

### Week 2: UI Development
1. Build RunTab component
2. Create ProcessingStatus component
3. Add navigation and routing
4. Implement document upload for test runs

### Week 3: Integration
1. Connect WorkflowExecutor to existing tool system
2. Implement reference resolution
3. Add progress tracking
4. Create results storage and retrieval

### Week 4: Testing & Polish
1. Add error handling and recovery
2. Implement test run history
3. Create results export functionality
4. Add validation and comparison features

## Success Metrics

1. **Functional Requirements**
   - Users can execute complete workflows on test documents
   - All workflow steps run in sequence with proper data passing
   - Results are stored and retrievable
   - Errors are handled gracefully

2. **Performance Requirements**
   - Workflows complete within reasonable time (< 1 min for 10 documents)
   - UI remains responsive during execution
   - Progress updates in real-time

3. **User Experience**
   - Clear indication of workflow progress
   - Easy-to-understand error messages
   - Intuitive results visualization
   - Simple workflow testing process

## Technical Considerations

### 1. Asynchronous Processing
- Use job queues for long-running workflows
- Implement proper timeout handling
- Support for canceling running workflows

### 2. Error Recovery
- Save partial results on failure
- Allow retry from failed step
- Provide detailed error logs

### 3. Scalability
- Design for parallel document processing
- Optimize database queries
- Consider caching for frequently used tools

### 4. Security
- Validate all inputs
- Sanitize document content
- Implement proper access controls

## Migration Strategy

1. **Phase 1**: Deploy execution engine without UI changes
2. **Phase 2**: Add new UI components alongside existing ones
3. **Phase 3**: Migrate existing test documents to new system
4. **Phase 4**: Deprecate old testing methods

## Risk Mitigation

1. **Data Loss**: Implement comprehensive logging and backup
2. **Performance**: Add monitoring and optimization as needed
3. **User Confusion**: Provide clear documentation and tooltips
4. **Integration Issues**: Extensive testing with existing tools

## Next Steps

1. Review this plan with the team
2. Prioritize features based on user needs
3. Create detailed technical specifications
4. Begin implementation with Phase 1
5. Set up testing environment
6. Plan user acceptance testing

## Conclusion

The Extrapl app has a solid foundation with its workflow builder and tool system. The missing piece is the execution engine that ties everything together. By implementing the proposed test feature, users will be able to:

1. Define complex multi-step extraction workflows
2. Test workflows on sample documents
3. View and validate extraction results
4. Iterate and improve their workflows
5. Eventually run production extractions at scale

This development plan provides a clear path to building a comprehensive test feature that will enable users to effectively extract structured data from documents using the defined workflows and tools.