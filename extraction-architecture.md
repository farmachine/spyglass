# Extraction Architecture Documentation

## Core Principles

### 1. Tool-Based Extraction
- **Every extraction must use a tool** via its `toolId`
- No hardcoded extraction functions are allowed
- Tools are generated dynamically based on configuration

### 2. Identifier ID Generation Rules
- **First Column**: `identifierId` is generated at save time (database) as a proper UUID
- **Subsequent Columns**: `identifierId` is passed via `previousData` for record linking
- **Extraction functions NEVER generate identifierIds** - they only extract data values

### 3. Extraction Function Output Format
Extraction functions (both AI and Python) must return:
```json
{
  "extractedValue": "the actual data",
  "validationStatus": "valid|invalid",
  "aiReasoning": "explanation of extraction",
  "confidenceScore": 0-100,
  "documentSource": "source reference"
}
```

Note: No `identifierId` field should be returned by extraction functions!

### 4. Record Linking Strategy
- **Order-based mapping**: Results maintain the same order as input
- **First column**: Generates new UUIDs for each record
- **Subsequent columns**: Use identifierIds from `previousData` array
- Database handles the linking, not the extraction functions

## Data Flow

### First Column Extraction
1. User triggers extraction for first column
2. Tool executes without previousData
3. Returns array of extraction results (no identifierIds)
4. Server generates UUID identifierIds when saving to `field_validations`
5. Each record gets a unique identifierId for cross-column linking

### Subsequent Column Extraction
1. User triggers extraction for subsequent column
2. Server fetches first column's identifierIds
3. Creates `previousData` array with identifierIds
4. Tool executes with previousData
5. Results are matched by array index
6. Server uses identifierIds from previousData when saving

## Key Files

### Server Side
- `server/routes.ts`: Handles extraction requests and identifierId generation
- `server/toolEngine.ts`: Manages tool execution and prompt generation
- `extraction_wizardry.py`: Unified extraction system for all tools

### Client Side
- `client/src/pages/SessionView.tsx`: Session view with extraction UI
- `client/src/components/ExtractWizardModal.tsx`: Modal for single-value extraction
- `client/src/components/ValidationIcon.tsx`: Visual validation indicators

## Common Pitfalls to Avoid

1. **DO NOT** include `identifierId` in extraction function prompts
2. **DO NOT** use placeholder identifiers like "col_0000"
3. **DO NOT** bypass the tool system with hardcoded functions
4. **DO NOT** generate identifierIds in extraction functions
5. **DO NOT** mix up array indices when mapping results to records

## Testing the System

1. Extract first column - should generate proper UUID identifierIds
2. Extract subsequent column - should use identifierIds from first column
3. Check database - all columns for same row should share identifierId
4. Verify UI - values should appear in correct rows across columns