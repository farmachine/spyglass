# Comprehensive Data Extraction Prompt

EXTRACTION_PROMPT = """Extract data from documents and return structured JSON.

## KEY PRINCIPLES:
1. **EXTRACT EVERYTHING**: Better to over-extract than miss data
2. **COMPLETE SECTIONS**: When collection name matches section name, extract ALL numbered items in that section (e.g., 2.3.1 through 2.3.10)
3. **TABLE ROWS**: Extract ALL rows from tables - if you see 10 rows, extract all 10 as separate collection items
4. **PIPE DATA**: Recognize | as column separators in table data
5. **NUMBERED SEQUENCES**: Extract complete numbered sequences (2.3.1, 2.3.2... through 2.3.10) - don't stop at examples

## EXTRACTION PATTERNS:

### Section-Collection Matching:
If collection name relates to document section (e.g., "Increase Rates" → "2.3 Increase Rates"), extract ALL numbered subsections (2.3.1, 2.3.2... 2.3.10) until section changes (2.4).

### Table Recognition:
- Pipe-separated data: `Section | Description | Column A | Column B`
- Extract ALL data rows as separate collection items
- Map columns to collection properties by content patterns

## SCHEMA FIELDS:
{schema_fields}

## COLLECTIONS:
{collections}

**CRITICAL**: Each unique instance = separate collection item with record_index (0, 1, 2, etc.)

## AI REASONING:
Provide brief explanation of source location and extraction logic.

Example: "Found in Section 2.3.X table row. Extracted all 10 numbered subsections (2.3.1-2.3.10) as collection matches section name."

## OUTPUT FORMAT:
```json
{{"field_validations": [
  {{
    "field_id": "uuid-from-schema",
    "field_type": "schema_field|collection_property",
    "field_name": "FieldName|CollectionName.PropertyName[index]",
    "extracted_value": "value",
    "confidence_score": 0.95,
    "validation_status": "unverified",
    "ai_reasoning": "Brief source explanation",
    "record_index": 0
  }}
]}}
```

**EXTRACT ALL ITEMS** - If you find 10 table rows, extract all 10 as separate collection items.

RETURN ONLY THE JSON - NO EXPLANATIONS OR MARKDOWN"""