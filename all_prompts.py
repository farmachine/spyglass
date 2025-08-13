# Document format analysis prompt
DOCUMENT_FORMAT_ANALYSIS = """Analyze these documents and determine their format. Either "Excel", "Word", or "PDF".

Documents to analyze:
{documents}

Fields to extract:
{target_fields}

Then based on the format, look at the provided descriptions of the target field and determine which of the following extraction processes to use:

- Excel Extraction: Any excel function that can be done without AI. (I.e. Extract a list of columns from an excel sheet; Extract the worksheet names; Extract a deduplicated list of values from a set of columns)
- AI Extraction: Uses AI to read the document and extract the data based on a set of instructions.

If you see that the task should be done using one or a combination of these two methods, then describe the sequence i.e.
1. Excel Extraction: Extract all the columns from the excel
2. AI Extraction: Use AI to compare the extracted column names based on a set of instructions in the knowledge documents
3. Excel Extraction: extract all the columns that were not found in the AI extraction.

Output format:
```
DOCUMENT_FORMAT: [Excel/Word/PDF]
EXTRACTION_SEQUENCE:
1. [Method]: [Description]
2. [Method]: [Description]
3. [Method]: [Description]
```
"""

# Excel function generation prompt
EXCEL_FUNCTION_GENERATOR = """You must generate a complete Python function that extracts data from Excel content.

TARGET FIELDS TO EXTRACT:
{target_fields}

MANDATORY REQUIREMENTS:
1. Function name MUST be: extract_excel_data(extracted_content, target_fields_data)
2. Input format: extracted_content has lines like "=== Sheet: Name ===" followed by tab-separated rows
3. Output format: Return a list of dictionaries, each with these exact keys:
   - "validation_type": "collection_property"
   - "data_type": field's property_type or "TEXT"
   - "field_name": "CollectionName.FieldName[INDEX]" 
   - "collection_name": field's collection name
   - "extracted_value": the actual extracted data
   - "confidence_score": 0.95
   - "validation_status": "unverified"
   - "ai_reasoning": brief explanation
   - "record_index": unique number starting from 0

CRITICAL INDEXING RULE:
- Use record_index = 0 at start
- For each extracted value: add record_index to result, then increment by 1
- Every result must have different index: 0, 1, 2, 3, etc.

RESPONSE FORMAT:
- Start with: def extract_excel_data(extracted_content, target_fields_data):
- End with: return results
- NO markdown, NO explanations, NO ```python blocks
- ONLY the complete function code

"""

# AI document extraction prompt
AI_DOCUMENT_EXTRACTION = """You are a document extraction expert specializing in intelligent data extraction from various document types including PDFs, Word documents, and complex formats.

DOCUMENT CONTENT:
{documents}

TARGET FIELD SCHEMA:
{target_fields}

MATCHING EXTRACTION RULES:
{extraction_rules}

RELEVANT KNOWLEDGE DOCUMENTS:
{knowledge_documents}

REQUIRED OUTPUT FORMAT:
For each extracted value, return a JSON object with these exact keys:
{{
    "validation_type": "collection_property",
    "data_type": field's property_type or "TEXT",
    "field_name": "CollectionName.PropertyName[record_index]",
    "collection_name": field's collection name,
    "extracted_value": "actual_extracted_data",
    "confidence_score": number between 0.0 and 1.0,
    "validation_status": "unverified",
    "ai_reasoning": "Brief explanation of extraction logic",
    "record_index": unique_sequential_number
}}

CRITICAL REQUIREMENTS:
1. Extract data based on the field descriptions and extraction rules provided
2. Use knowledge documents to validate and enhance extraction accuracy
3. Each record must have a unique, incrementing record_index starting from 0
4. Follow all global and targeted extraction rules
5. Maintain high confidence scores (0.8+) for clear extractions
6. Return results as a valid JSON array of objects
7. If no data can be extracted for a field, omit it from results rather than returning empty values

Return ONLY the JSON array, no explanations or markdown formatting.

"""