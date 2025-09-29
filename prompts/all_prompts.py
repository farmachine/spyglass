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

EXCEL_FUNCTION_GENERATOR = """You must generate a complete Python function that extracts data from Excel content following EXACT patterns from working production tools.

CRITICAL EXCEL DOCUMENT FORMAT:
Excel files are provided as TEXT STRINGS with this exact format:

=== Sheet: SheetName1 ===
Column1[TAB]Column2[TAB]Column3[TAB]Column4
value1[TAB]value2[TAB]value3[TAB]value4
value5[TAB]value6[TAB]value7[TAB]value8

=== Sheet: SheetName2 ===  
HeaderA[TAB]HeaderB[TAB]HeaderC
dataA1[TAB]dataB1[TAB]dataC1
dataA2[TAB]dataB2[TAB]dataC2

Note: [TAB] represents the tab character (\\t)

EXCEL GRID STRUCTURE NORMALIZATION (MANDATORY):
ALL Excel extraction functions MUST normalize grid structure before processing:

1. **Consistent Column Count**: Every row must have the same number of columns per sheet
2. **Empty Cell Handling**: Convert all empty/whitespace-only cells to 'blank'
3. **Row Preservation**: Maintain all rows, even if they appear shorter

Example Normalization Pattern:
```python
def normalize_excel_content(content):
    if not content or "=== Sheet:" not in content:
        return content
    
    sections = content.split('=== Sheet:')
    normalized_sections = sections.copy()
    
    for i, section in enumerate(sections[1:], 1):  # Skip first empty section
        lines = section.split('\n')
        if len(lines) < 2:
            continue
            
        sheet_name_line = lines[0]
        data_lines = lines[1:]
        
        if not data_lines:
            continue
            
        # Find maximum column count
        cell_rows = [line.split('\t') for line in data_lines]
        max_columns = max(len(row) for row in cell_rows) if cell_rows else 0
        
        # Normalize each row
        normalized_lines = []
        for cells in cell_rows:
            # Pad to max columns
            while len(cells) < max_columns:
                cells.append('')
            
            # Convert empty cells to 'blank'
            normalized_cells = ['blank' if cell.strip() == '' else cell for cell in cells]
            normalized_lines.append('\t'.join(normalized_cells))
        
        normalized_sections[i] = sheet_name_line + '\n' + '\n'.join(normalized_lines)
    
    return '=== Sheet:'.join(normalized_sections)
```

MANDATORY PARSING RULES:
1. NEVER use pandas.ExcelFile() or pd.read_excel() - the input is a TEXT STRING
2. **ALWAYS normalize Excel content first** using the pattern above
3. Parse sheets using: `=== Sheet: SheetName ===`
4. Split rows by newlines (\n)
5. Split columns by TAB character (\t)
6. First row after sheet delimiter contains headers

CRITICAL INPUT PARAMETER HANDLING:
Functions MUST handle multiple parameter name variations:

Example Pattern:
def extract_function(*args, **kwargs):
    # Handle flexible input parameters like production tools
    
    # Extract document content (handle all common variations)
    document = None
    for doc_param in ['excel_file', 'excel_content', 'Excel File', 'document', 'Excel_File']:
        if doc_param in kwargs:
            document = kwargs[doc_param]
            break
    if not document and len(args) > 1:
        document = args[1]  # Second positional argument
    
    # Extract data input (handle all common variations)
    data_input = None
    for data_param in ['column_data', 'Column Data', 'data', 'columns', 'Column_Name', 'field']:
        if data_param in kwargs:
            data_input = kwargs[data_param]
            break
    if not data_input and len(args) > 0:
        data_input = args[0]  # First positional argument
    
    # Parse JSON strings if needed
    if isinstance(data_input, str):
        try:
            import json
            data_input = json.loads(data_input)
        except:
            pass  # Keep as string if not JSON

MANDATORY OUTPUT FORMAT - ALL FUNCTIONS MUST RETURN THIS STRUCTURE:

# For single results:
return [{
    "extractedValue": "actual extracted data or None",
    "validationStatus": "valid" or "invalid",
    "aiReasoning": "Clear explanation of what happened",
    "confidenceScore": 100,  # 0-100 scale
    "documentSource": "Sheet: SheetName" or "N/A"
}]

# For array results with identifierId:
return [{
    "identifierId": "unique-id-from-input",  # MUST preserve from input
    "extractedValue": "data for this identifier",
    "validationStatus": "valid",
    "aiReasoning": "Found value in column X",
    "confidenceScore": 95,
    "documentSource": "Column: ColumnName"
}]

IDENTIFIER ID HANDLING FOR ARRAYS:

Example Pattern:
def handle_identifier_array(data_input):
    # Process arrays with identifierId preservation
    results = []
    
    # Check if input is array with identifierId
    if isinstance(data_input, list) and len(data_input) > 0:
        if isinstance(data_input[0], dict) and 'identifierId' in data_input[0]:
            # Process each item preserving identifierId
            for item in data_input:
                identifier_id = item.get('identifierId')
                value = item.get('extractedValue') or item.get('name') or item.get('ID')
                
                # Extract data for this specific item
                extracted = process_single_item(value)
                
                results.append({
                    "identifierId": identifier_id,  # MUST preserve
                    "extractedValue": extracted,
                    "validationStatus": "valid" if extracted else "invalid",
                    "aiReasoning": f"Processed {value}",
                    "confidenceScore": 100 if extracted else 0,
                    "documentSource": "Input Data"
                })
    return results

EXCEL PARSING HELPER FUNCTION:

Example Pattern:
def parse_excel_sheets(excel_text):
    # MANDATORY: Normalize Excel content first
    excel_text = normalize_excel_content(excel_text)
    
    # Parse Excel text format into sheets dictionary
    sheets = {}
    
    if "=== Sheet:" in excel_text:
        # Split by sheet delimiter
        sections = re.split(r'===\s*Sheet:\s*(.*?)\s*===', excel_text)
        
        # Process pairs of sheet_name, sheet_content
        for i in range(1, len(sections), 2):
            sheet_name = sections[i].strip()
            sheet_content = sections[i+1].strip() if i+1 < len(sections) else ""
            
            if sheet_content:
                lines = sheet_content.split('\n')
                if lines:
                    # First line is headers
                    headers = [h.strip() for h in lines[0].split('\t')]
                    # Rest are data rows (already normalized to consistent column count)
                    rows = []
                    for line in lines[1:]:
                        row = [cell.strip() for cell in line.split('\t')]
                        rows.append(row)
                    
                    sheets[sheet_name] = {
                        'headers': headers,
                        'rows': rows
                    }
    
    return sheets

def normalize_excel_content(content):
    # MANDATORY normalization function - include in all generated functions
    if not content or "=== Sheet:" not in content:
        return content
    
    sections = content.split('=== Sheet:')
    normalized_sections = sections.copy()
    
    for i, section in enumerate(sections[1:], 1):  # Skip first empty section
        lines = section.split('\n')
        if len(lines) < 2:
            continue
            
        sheet_name_line = lines[0]
        data_lines = lines[1:]
        
        if not data_lines:
            continue
            
        # Find maximum column count
        cell_rows = [line.split('\t') for line in data_lines]
        max_columns = max(len(row) for row in cell_rows) if cell_rows else 0
        
        # Normalize each row
        normalized_lines = []
        for cells in cell_rows:
            # Pad to max columns
            while len(cells) < max_columns:
                cells.append('')
            
            # Convert empty cells to 'blank'
            normalized_cells = ['blank' if cell.strip() == '' else cell for cell in cells]
            normalized_lines.append('\t'.join(normalized_cells))
        
        normalized_sections[i] = sheet_name_line + '\n' + '\n'.join(normalized_lines)
    
    return '=== Sheet:'.join(normalized_sections)

TWO OPERATION TYPES:
1. **updateMultiple** - Updates existing records with identifierId matching:
   - Input has identifierId for each record
   - Must preserve identifierId in output
   - Used when updating existing data rows

2. **createMultiple** - Creates new records:
   - No identifierId in input
   - Generate new data from documents
   - Used for initial data extraction

ERROR HANDLING PATTERN:

# Always return proper error structure
if not document:
    return [{
        "extractedValue": None,
        "validationStatus": "invalid",
        "aiReasoning": "No Excel document provided",
        "confidenceScore": 0,
        "documentSource": "N/A"
    }]

if not data_input:
    return [{
        "extractedValue": None,
        "validationStatus": "invalid",
        "aiReasoning": "No input data provided",
        "confidenceScore": 0,
        "documentSource": "N/A"
    }]

COMPLETE WORKING EXAMPLE FROM PRODUCTION:

This is the exact pattern your generated function should follow:

import json
import re

def extract_function(*args, **kwargs):
    # Example function following all production patterns including normalization
    
    # 1. Handle flexible input parameters
    document = None
    for doc_param in ['excel_file', 'excel_content', 'Excel File', 'document']:
        if doc_param in kwargs:
            document = kwargs[doc_param]
            break
    
    data_input = None
    for data_param in ['column_data', 'Column Data', 'data', 'columns']:
        if data_param in kwargs:
            data_input = kwargs[data_param]
            break
    
    # 2. Validate inputs
    if not document:
        return [{
            "extractedValue": None,
            "validationStatus": "invalid",
            "aiReasoning": "No Excel document provided",
            "confidenceScore": 0,
            "documentSource": "N/A"
        }]
    
    # 3. MANDATORY: Normalize Excel content first
    document = normalize_excel_content(document)
    
    # 4. Parse JSON if needed
    if isinstance(data_input, str):
        try:
            data_input = json.loads(data_input)
        except:
            pass
    
    # 5. Handle array with identifierId
    if isinstance(data_input, list) and len(data_input) > 0:
        if isinstance(data_input[0], dict) and 'identifierId' in data_input[0]:
            results = []
            
            # Parse Excel sheets (content already normalized)
            sheets = parse_excel_sheets(document)
            
            # Process each item
            for item in data_input:
                identifier_id = item.get('identifierId')
                value_to_find = item.get('extractedValue') or item.get('name') or item.get('ID')
                
                # Find value in sheets
                found = None
                source = "N/A"
                
                for sheet_name, sheet_data in sheets.items():
                    if value_to_find in sheet_data.get('headers', []):
                        found = f"Column in {sheet_name}"
                        source = f"Sheet: {sheet_name}"
                        break
                
                results.append({
                    "identifierId": identifier_id,
                    "extractedValue": found,
                    "validationStatus": "valid" if found else "invalid",
                    "aiReasoning": f"Searched for '{value_to_find}'",
                    "confidenceScore": 100 if found else 0,
                    "documentSource": source
                })
            
            return results
    
    # 6. Handle single value
    return [{
        "extractedValue": "Single value result",
        "validationStatus": "valid",
        "aiReasoning": "Processed single input",
        "confidenceScore": 95,
        "documentSource": "Document"
    }]

KEY REQUIREMENTS FOR GENERATED FUNCTIONS:
1. **Flexible Parameter Handling**: Use *args, **kwargs to accept various parameter names
2. **Standard Output Format**: Always return list of dicts with extractedValue, validationStatus, etc.
3. **IdentifierId Preservation**: For arrays, MUST preserve identifierId from input to output
4. **Error Handling**: Return proper error structure even when extraction fails
5. **Document Parsing**: Use === Sheet: Name === delimiters and tab-separated columns
6. **Operation Types**: Handle both updateMultiple (with identifierId) and createMultiple (without)

TARGET FIELDS TO EXTRACT:
{target_fields}

SOURCE DOCUMENTS:
{source_documents}

IDENTIFIER REFERENCES:
{identifier_references}

EXTRACTION NUMBER: {extraction_number}

GENERATED FUNCTION REQUIREMENTS:
1. **Function Name**: Choose a descriptive name based on the task (e.g., get_column_names, extract_worksheet_mapping)
2. **Use Production Patterns**: Follow the COMPLETE WORKING EXAMPLE above
3. **Parameter Flexibility**: Accept multiple parameter name variations
4. **Output Format**: Return list of dicts with standard fields (extractedValue, validationStatus, etc.)
5. **IdentifierId Handling**: Preserve identifierId for updateMultiple operations
6. **Error Cases**: Always return proper error structure, never throw exceptions

RESPONSE FORMAT:
Return ONLY a valid JSON object with these keys:
{
    "function_name": "descriptive_function_name",
    "description": "Clear description of what the function does",
    "tags": ["excel", "extraction", "data"],
    "function_code": "complete Python function as string with proper escaping"
}

CRITICAL REMINDERS:
- NO markdown blocks in response
- NO explanations outside JSON
- Escape all quotes and newlines in function_code
- Follow the COMPLETE WORKING EXAMPLE pattern exactly
- Always return list of dicts with standard output format
- Handle all parameter name variations
- Preserve identifierId for array operations

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