# Document format analysis prompt
DOCUMENT_FORMAT_ANALYSIS = """Analyze these documents and determine their format. Either "Excel", "Word", or "PDF".

Documents to analyze:
{documents}

Fields to extract:
{target_fields}

Then based on the format, look at the provided descriptions of the target field and determine which of the following extraction processes to use:

- Excel Column Extraction: Extracts a list of all columns within an excel document.
- Excel Sheet Extraction: Extracts all sheets within an excel document.
- AI Extraction: Uses AI to extract the data from the document.

Just return the name of the extraction process to use.

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