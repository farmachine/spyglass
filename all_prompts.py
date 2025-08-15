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
3. If identifier_references is provided, the function MUST iterate through each identifier and extract the target field for that specific identifier
4. If no documents are available (empty extracted_content), the function must work purely from identifier_references data
5. Output format: Return a list of dictionaries, each with these exact keys:
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