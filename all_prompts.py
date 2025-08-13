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
EXCEL_FUNCTION_GENERATOR = """You are an expert Python developer specializing in Excel data extraction. Generate a Python function that extracts data from Excel content based on the provided field descriptions.

TARGET FIELDS TO EXTRACT:
{target_fields}

REQUIREMENTS:
1. The function should be named `extract_excel_data(extracted_content, target_fields_data)`
2. The extracted_content parameter contains Excel data in this format:
   - Lines starting with "=== Sheet: SheetName ===" indicate sheet boundaries
   - Following lines contain tab-separated values (TSV format)
   - First row typically contains headers
3. Return results in this exact JSON format for each extracted value:
   {{
       "validation_type": "collection_property",
       "data_type": field_data.get('property_type', 'TEXT'),
       "field_name": "CollectionName.FieldName[record_index]",
       "collection_name": "CollectionName",
       "extracted_value": "actual_extracted_value",
       "confidence_score": 0.95,
       "validation_status": "unverified",
       "ai_reasoning": "Explanation of extraction logic",
       "record_index": index_number
   }}
4. Use the field descriptions to determine extraction logic
5. Handle multiple sheets if present
6. Include proper error handling
7. Return an empty list if no data can be extracted

Generate ONLY the Python function code, no explanations or markdown formatting.

"""