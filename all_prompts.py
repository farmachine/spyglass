# Document format analysis prompt
DOCUMENT_FORMAT_ANALYSIS = """Analyze these documents and determine their format. Either "Excel", "Word", or "PDF".

Documents to analyze:
{documents}

Fields to extract:
{target_fields}

Existing Excel Wizardry Functions:
{existing_functions}

Identifier References from Previous Extraction:
{identifier_references}

Extraction Number: {extraction_number}

Based on the document format and target fields, determine which extraction process to use:

STRICT CRITERIA FOR EXCEL FUNCTION CREATION:
Excel functions should ONLY be created for tasks involving:
- Mathematical calculations or computations on Excel data
- Complex data transformations or aggregations
- Column-to-column comparisons within the same Excel file
- Data processing that requires iterating through multiple rows/columns
- Extracting patterns or performing analysis across multiple cells

DO NOT CREATE EXCEL FUNCTIONS FOR:
- Fields requiring comparison to external knowledge documents or standards
- Reasoning or explanation fields that need AI analysis
- Simple text extraction from single cells
- Fields that reference external documents or resources
- Any task that mentions "knowledge document", "standard mapping", or "comparison to standard"

FIELD ANALYSIS REQUIRED:
Before making a decision, analyze each target field for these patterns:

KNOWLEDGE DOCUMENT INDICATORS (→ AI Extraction):
- Field name contains: "Standardised", "Standard", "Mapping", "Reasoning"
- Description mentions: "knowledge document", "standard", "comparison", "mapping", "most relevant"
- Description references external resources or documents
- Description asks for reasoning, explanation, or justification

COMPUTATION INDICATORS (→ Excel Function):
- Description mentions calculations, sums, averages, counts
- Requires processing multiple rows or columns
- Involves data transformation or aggregation

DECISION LOGIC:
1. Check field descriptions for knowledge document indicators
2. If ANY field mentions knowledge documents/standards/reasoning → Use "AI Extraction" 
3. If format is Excel AND ALL fields are computational → Use "Excel Wizardry Function"
4. For non-Excel formats → Use "AI Extraction"
5. When in doubt → Use "AI Extraction"

CRITICAL FUNCTION SELECTION RULES:
- FIRST EXTRACTION (extraction_number = 0): Use existing functions designed for initial data discovery
- SUBSEQUENT EXTRACTIONS (extraction_number > 0): Only use existing functions if they explicitly handle identifier arrays and record matching
- If identifier_references are provided but existing function descriptions don't mention identifier array handling, you MUST use "Excel Wizardry Function|CREATE_NEW"
- NO DOCUMENTS SELECTED: If documents show "NO DOCUMENTS SELECTED", the extraction must work purely from identifier_references - you MUST use "Excel Wizardry Function|CREATE_NEW"
- When in doubt about function compatibility, always choose CREATE_NEW to ensure proper handling

IMPORTANT: Read function descriptions carefully. Many existing functions only work for first-time extractions and cannot handle identifier-based matching for subsequent runs. If no documents are provided, the function must generate results based solely on identifier references.

Response format:
- For existing function: "Excel Wizardry Function|<function_id>"
- For new function: "Excel Wizardry Function|CREATE_NEW"
- For non-Excel: "AI Extraction"

"""

# Excel function generation prompt
ENHANCED_AI_EXTRACTION_PROMPT = """
Extract data from the provided documents using the field configuration and context provided.

TARGET FIELD: {field_name}
FIELD TYPE: {field_type}
DESCRIPTION: {field_description}

KNOWLEDGE DOCUMENTS:
{knowledge_context}

EXTRACTION RULES:
{rules_context}

PREVIOUS EXTRACTIONS:
{previous_context}

SOURCE DOCUMENTS:
{document_context}

Instructions:
1. Extract the exact value for the target field based on the description and rules
2. Use knowledge documents for validation and reference standards
3. Consider previous extractions for context and consistency
4. Return confidence score (0-100) based on certainty
5. Provide clear reasoning for your extraction

Return JSON format:
{{
    "extracted_value": "value found in documents",
    "confidence_score": 85,
    "reasoning": "explanation of how value was found and validated"
}}
"""

EXCEL_FUNCTION_GENERATOR = """You must generate a complete Python function that extracts data from Excel content.

CRITICAL EXCEL DOCUMENT FORMAT TRAINING:

EXCEL FILE FORMAT IN THIS SYSTEM:
Excel files are NOT provided as file paths or pandas-compatible files. Instead, they are provided as TEXT STRINGS with this exact format:

```
=== Sheet: SheetName1 ===
Column1 Column2 Column3 Column4
value1  value2  value3  value4
value5  value6  value7  value8

=== Sheet: SheetName2 ===  
HeaderA HeaderB HeaderC
dataA1  dataB1  dataC1
dataA2  dataB2  dataC2
```

MANDATORY EXCEL PARSING RULES:
1. NEVER use pandas.ExcelFile() or pd.read_excel() - the input is a TEXT STRING, not a file path
2. Parse sheets using the delimiter pattern: `=== Sheet: SheetName ===`
3. Split sheet content by newlines to get rows
4. Split each row by tab character `\t` to get columns
5. First row after sheet delimiter is the header row with column names
6. Use regular expressions or string splitting for parsing

CORRECT EXCEL PARSING EXAMPLE:
```python
import re

def parse_excel_text(excel_text):
    # Split by sheet delimiter, keeping sheet names
    sheets_data = re.split(r'===\s*Sheet:\s*(.*?)\s*===', excel_text)
    sheets = {}
    
    # Process pairs of sheet_name, sheet_content
    for i in range(1, len(sheets_data), 2):
        sheet_name = sheets_data[i].strip()
        sheet_content = sheets_data[i+1].strip()
        
        if sheet_content:
            # Split into rows and get headers
            rows = sheet_content.split('\n')
            headers = [h.strip() for h in rows[0].split('\t')] if rows else []
            sheets[sheet_name] = {
                'headers': headers,
                'rows': rows[1:] if len(rows) > 1 else []
            }
    
    return sheets
```

FUNCTION SIGNATURE REQUIREMENT:
Your generated function must use this exact signature and handle the Excel text format:
```python
def extract_function(parameter1_name, parameter2_name):
    # parameter1_name might be: Columns (array of column names)
    # parameter2_name might be: Excel_File (text string with sheet delimiters)
    
    # Extract column names from data structure
    if isinstance(parameter1_name, dict) and 'rows' in parameter1_name:
        identifier = parameter1_name.get('identifierColumn', 'Column Name')
        column_names = [row[identifier] for row in parameter1_name['rows']]
    elif isinstance(parameter1_name, list):
        column_names = parameter1_name
    else:
        column_names = [str(parameter1_name)]
    
    # Parse Excel text content (NOT a file path!)
    sheets = parse_excel_text(parameter2_name)
    
    # Process each column and find its sheet
    results = {}
    for column_name in column_names:
        for sheet_name, sheet_data in sheets.items():
            if column_name in sheet_data['headers']:
                results[column_name] = sheet_name
                break
        else:
            results[column_name] = None
    
    return results
```

COMMON MISTAKES TO AVOID:
❌ Using pandas.ExcelFile(Excel_File) - will fail because Excel_File is text, not file path
❌ Trying to read Excel_File as a file - it's a string with sheet delimiters
❌ Expecting .xlsx/.xls file format - it's already converted to text with === delimiters
❌ Not handling the specific `=== Sheet: Name ===` delimiter format
❌ Not splitting by tab characters for column separation

CRITICAL ARRAY ITERATION TRAINING:
When you receive data input parameters, check if they contain arrays of objects that need individual processing:

SINGLE VALUE PROCESSING:
- If input is single object/string: process once, return one result
- Example: column_name = "Employee ID" → find this one column

ARRAY ITERATION PROCESSING:
- If input is array of objects: iterate through each item, return array of results
- Example: column_names = [{"Column Name": "Employee ID"}, {"Column Name": "Salary"}] 
- MUST iterate: for each item in column_names, extract item["Column Name"] individually
- MUST return: separate result for "Employee ID" and separate result for "Salary"

ARRAY DETECTION PATTERNS:
- Input parameter is list/array: [{"Column Name": "X"}, {"Column Name": "Y"}]
- Multiple objects with same structure indicates iteration needed
- Function should loop through array items, not treat entire array as single value

COMMON MISTAKE TO AVOID:
❌ WRONG: Trying to find entire array '[{"Column Name": "X"}, {"Column Name": "Y"}]' as single column name
✅ CORRECT: Loop through array, process "X" first, then "Y" separately

REQUIRED CODE PATTERN FOR ARRAY PROCESSING:
```python
def extract_excel_data(extracted_content, target_fields_data, identifier_references=None):
    results = []
    
    # Get input parameters
    column_data = target_fields_data.get('Column Headings', [])  # This might be an array
    
    # Check if it's an array and iterate
    if isinstance(column_data, list):
        for idx, item in enumerate(column_data):
            column_name = item.get('Column Name', '')  # Extract individual column name
            # Process this single column_name
            worksheet_name = find_worksheet_containing_column(extracted_content, column_name)
            results.append({
                "validation_type": "collection_property",
                "extracted_value": worksheet_name,
                "record_index": idx
                # ... other required fields
            })
    else:
        # Handle single value case
        column_name = column_data.get('Column Name', '') if isinstance(column_data, dict) else str(column_data)
        worksheet_name = find_worksheet_containing_column(extracted_content, column_name)
        results.append({
            "validation_type": "collection_property", 
            "extracted_value": worksheet_name,
            "record_index": 0
            # ... other required fields
        })
    
    return results
```

TARGET FIELDS TO EXTRACT:
{target_fields}

The function must accept the following parameters from the target fields and pass them straight to the output body. They should not influnce the function's behavior:

"id"
"collectionId"

SOURCE DOCUMENTS (for context):
{source_documents}

NOTE: If source documents show "NO DOCUMENTS SELECTED", you must create a function that works purely from identifier_references without reading any document content.

IDENTIFIER REFERENCES FROM PREVIOUS EXTRACTION:
{identifier_references}

EXTRACTION NUMBER: {extraction_number}

FUNCTION METADATA:
Create a descriptive name and description for this function based on the extraction task.

MANDATORY REQUIREMENTS:
1. Function name MUST be: extract_excel_data(extracted_content, target_fields_data, identifier_references=None)
2. Input format: extracted_content has lines like "=== Sheet: Name ===" followed by tab-separated rows (may be empty if no documents selected)
3. ARRAY ITERATION LOGIC: If any input parameter (from target_fields_data) is an array, you MUST iterate through each array item:
   - Check if parameter value is list: isinstance(param_value, list)
   - If list: for item in param_value: process each item individually  
   - If not list: process single value once
   - Example: [{"Column Name": "A"}, {"Column Name": "B"}] → process "A", then process "B"
4. If identifier_references is provided, the function MUST iterate through each identifier and extract the target field for that specific identifier
5. If no documents are available (empty extracted_content), the function must work purely from identifier_references data
6. Output format: Return a list of dictionaries, each with these exact keys:
   - "validation_type": "collection_property"
   - "data_type": field's property_type or "TEXT"
   - "field_name": "CollectionName.FieldName[INDEX]" 
   - "collection_id": field's collection id
   - "field_id": field's id
   - "extracted_value": the actual extracted data
   - "confidence_score": 0.95
   - "validation_status": "unverified"
   - "ai_reasoning": brief explanation
   - "record_index": unique number starting from 0

CRITICAL INDEXING AND COUNT RULES:
- If identifier_references provided: MUST return EXACTLY the same number of results as identifiers (e.g., 185 identifiers = 185 results)
- Use record_index = 0 at start, increment by 1 for each result
- If a value cannot be found for an identifier, still create a result with extracted_value: null
- Every result must have different index: 0, 1, 2, 3, etc.
- For each identifier, use the identifier value to find the corresponding target field value in the Excel data

ITERATION LOGIC FOR SUBSEQUENT EXTRACTIONS:
If identifier_references is provided:
1. Loop through each identifier reference object
2. Extract the identifier value (e.g., "Column Heading[0]: 'Member Reference No'")
3. If documents available: Use this identifier to locate the target field in the Excel sheets
4. If no documents available (NO DOCUMENTS SELECTED): Generate appropriate values based on identifier context and target field requirements
5. For column extraction: find the worksheet containing this column and extract the target property (or generate contextually appropriate worksheet names if no docs)
6. Maintain the same index as the identifier reference
7. Set confidence_score appropriately (lower for generated vs extracted data)

RESPONSE FORMAT:
Return ONLY a valid JSON object with these four keys: function_name, description, tags, function_code
Start response with opening brace and end with closing brace
NO markdown blocks, NO explanations, ONLY the JSON object
Escape all quotes and newlines properly in function_code field

"""

# AI document extraction prompt
AI_DOCUMENT_EXTRACTION = """You are a document extraction expert specializing in intelligent data extraction from various document types including PDFs, Word documents, and complex formats.

DOCUMENT CONTENT:
{documents}

IDENTIFIER REFERENCES FROM PREVIOUS EXTRACTION:
{identifier_references}

EXTRACTION NUMBER: {extraction_number}

SUBSEQUENT EXTRACTION INSTRUCTIONS:
If identifier_references are provided, you MUST:
1. Extract the target field for each identifier reference
2. Return EXACTLY the same number of results as identifier references
3. Use the identifier value to locate and extract the corresponding target field
4. Maintain the same index order as the identifier references
5. If a value cannot be found for an identifier, return null but still create the validation entry

CRITICAL COUNT REQUIREMENT:
- Number of validation results MUST equal number of identifier references (e.g., 185 identifiers = 185 validations)
- Use record_index matching the identifier index: 0, 1, 2, 3, etc.
- If extraction fails for any identifier, still create validation with extracted_value: null

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
    "collection_id": field's collection id,
    "field_id": field's id,
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