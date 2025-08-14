# Document format analysis prompt
DOCUMENT_FORMAT_ANALYSIS = """Analyze these documents and determine their format. Either "Excel", "Word", or "PDF".

Documents to analyze:
{documents}

Fields to extract:
{target_fields}

Existing Excel Wizardry Functions:
{existing_functions}

Based on the document format and target fields, determine which extraction process to use:

1. If format is Excel, ALWAYS prefer "Excel Wizardry Function" for intelligent extraction:
   - If we have existing functions that match similar document types or field patterns, use: "Excel Wizardry Function|<function_id>"
   - If no matching functions exist or you want to create a new optimized function, use: "Excel Wizardry Function|CREATE_NEW"
2. For non-Excel formats (Word/PDF), return: "AI Extraction"

IMPORTANT: Excel Wizardry Function is the preferred method for ALL Excel documents as it provides intelligent, reusable extraction logic.

Legacy methods (Excel Column Extraction, Excel Sheet Extraction) should only be used if explicitly requested.

Response format:
- For existing function: "Excel Wizardry Function|<function_id>"
- For new function: "Excel Wizardry Function|CREATE_NEW"
- For non-Excel: "AI Extraction"

"""

# Excel function generation prompt
EXCEL_FUNCTION_GENERATOR = """You must generate a complete Python function that extracts data from Excel content.

TARGET FIELDS TO EXTRACT:
{target_fields}

SOURCE DOCUMENTS (for context):
{source_documents}

FUNCTION METADATA:
Create a descriptive name and description for this function based on the extraction task.

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
Return a JSON object with:
{{
    "function_name": "descriptive_name_for_this_extraction",
    "description": "detailed description of what this function does",
    "tags": ["tag1", "tag2", "tag3"], // relevant tags for searching
    "function_code": "def extract_excel_data(extracted_content, target_fields_data):\n    # Your complete function here\n    return results"
}}

NO markdown, NO extra explanations, ONLY the JSON object.

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