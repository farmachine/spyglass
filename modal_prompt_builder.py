#!/usr/bin/env python3

def build_modal_extraction_prompt(
    target_schema_fields,
    target_collections,
    extraction_rules,
    knowledge_documents,
    document_content,
    validated_reference_data,
    additional_instructions=""
):
    """
    Build a streamlined, targeted extraction prompt for modal extraction.
    Only includes what's specifically requested by the user.
    """
    
    # 1. GENERIC EXTRACTION INSTRUCTIONS
    prompt = """You are a data extraction specialist. Extract ONLY the specifically targeted fields from the provided documents.

## EXTRACTION APPROACH:
- Focus ONLY on the target fields specified below
- Use the knowledge documents for context and validation
- Apply extraction rules exactly as specified
- For collections: Find identifiers first, then extract properties for each identifier found

"""

    # 2. TARGET DATA SCHEMA - Only include selected fields
    if target_schema_fields:
        prompt += "## TARGET SCHEMA FIELDS:\n"
        for field in target_schema_fields:
            field_desc = f"- **{field.get('field_name', 'Unknown')}** (ID: {field.get('field_id', 'unknown')})\n"
            field_desc += f"  Type: {field.get('field_type', 'TEXT')}\n"
            if field.get('description'):
                field_desc += f"  Description: {field.get('description')}\n"
            if field.get('choices'):
                field_desc += f"  Valid choices: {field.get('choices')}\n"
            prompt += field_desc + "\n"

    if target_collections:
        prompt += "## TARGET COLLECTIONS:\n"
        for collection in target_collections:
            prompt += f"### {collection.get('collection_name', 'Unknown Collection')}\n"
            prompt += f"Description: {collection.get('description', '')}\n\n"
            
            # COLLECTION IDENTIFICATION LOGIC
            prompt += "**IDENTIFICATION PROCESS:**\n"
            prompt += "1. FIRST: Look for identifiers that indicate distinct items in this collection\n"
            prompt += "2. THEN: For each identifier found, extract all properties below\n"
            prompt += "3. Each collection item needs a unique record index starting from 0\n\n"
            
            prompt += "**Properties to extract for each item:**\n"
            for prop in collection.get('properties', []):
                prop_desc = f"- **{prop.get('property_name', 'Unknown')}** (ID: {prop.get('property_id', 'unknown')})\n"
                prop_desc += f"  Type: {prop.get('property_type', 'TEXT')}\n"
                if prop.get('description'):
                    prop_desc += f"  Description: {prop.get('description')}\n"
                prompt += prop_desc + "\n"
            prompt += "\n"

    # 3. RELEVANT EXTRACTION RULES
    if extraction_rules:
        prompt += "## EXTRACTION RULES:\n"
        for rule in extraction_rules:
            target_field = rule.get('targetField', 'All Fields')
            rule_content = rule.get('ruleContent', '')
            prompt += f"- **{target_field}**: {rule_content}\n"
        prompt += "\n"

    # 4. KNOWLEDGE DOCUMENTS
    if knowledge_documents:
        prompt += "## KNOWLEDGE DOCUMENTS:\n"
        for doc in knowledge_documents:
            doc_name = doc.get('document_name', 'Unknown Document')
            doc_content = doc.get('content', '')
            prompt += f"### {doc_name}\n{doc_content}\n\n"

    # 5. DOCUMENT CONTENT
    prompt += "## DOCUMENT CONTENT TO PROCESS:\n"
    prompt += document_content + "\n\n"

    # 6. VALIDATED REFERENCE DATA
    if validated_reference_data:
        prompt += "## ALREADY VALIDATED REFERENCE DATA:\n"
        prompt += "Use this information for context and to avoid duplicating existing data:\n"
        for field_name, data in validated_reference_data.items():
            prompt += f"- **{field_name}**: {data.get('extractedValue', 'Not set')}\n"
        prompt += "\n"

    # 7. ADDITIONAL INSTRUCTIONS
    if additional_instructions:
        prompt += f"## ADDITIONAL INSTRUCTIONS:\n{additional_instructions}\n\n"

    # 8. OUTPUT FORMAT
    prompt += """## REQUIRED OUTPUT FORMAT:
Return a JSON object with this exact structure:
```json
{
  "field_validations": [
    {
      "field_id": "exact-uuid-from-schema",
      "field_name": "Field Name",
      "extracted_value": "extracted data or null",
      "confidence": 85,
      "collection_name": "Collection Name (only for collection properties)",
      "collection_record_index": 0
    }
  ]
}
```

**CRITICAL REQUIREMENTS:**
- Use exact field_id UUIDs from the target schema above
- For collections: Include collection_name and collection_record_index
- Confidence as integer percentage (0-100)
- Extract ALL items found, don't limit artificially
- If no data found for a field, use null value with confidence 0"""

    return prompt