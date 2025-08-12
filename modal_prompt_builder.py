#!/usr/bin/env python3

def build_modal_extraction_prompt(
    target_schema_fields,
    target_collections,
    extraction_rules,
    knowledge_documents,
    documents,
    validated_reference_data,
    additional_instructions=""
):
    """
    Build a comprehensive, targeted extraction prompt for modal extraction.
    Includes AI reasoning instructions and proper document handling.
    """
    
    # Format document names properly for verification
    document_names = []
    document_content = ""
    
    if documents and len(documents) > 0:
        for i, doc in enumerate(documents):
            doc_name = doc.get('file_name', f'Document_{i+1}')
            document_names.append(doc_name)
            doc_content = doc.get('content', doc.get('file_content', ''))
            document_content += f"## DOCUMENT: {doc_name}\n\n{doc_content}\n\n"
    
    document_list_str = ', '.join([f"'{name}'" for name in document_names])
    
    # 1. CORE EXTRACTION INSTRUCTIONS
    prompt = f"""You are an expert data extraction specialist. Your task is to extract ONLY the specifically targeted fields from the provided documents with detailed AI reasoning.

## EXTRACTION APPROACH:
- Focus EXCLUSIVELY on the target fields specified below
- Apply all relevant extraction rules and knowledge documents
- For collections: Use identifier-first workflow (find identifiers → extract properties for each)
- Provide detailed AI reasoning for every extraction decision
- Include relevant targeted/global extraction rules and knowledge documents in each field validation

## DOCUMENT VERIFICATION: 
Confirm you processed all {len(documents)} documents: [{document_list_str}]

"""

    # 2. TARGET SCHEMA FIELDS - Only selected fields
    if target_schema_fields:
        prompt += "## TARGET SCHEMA FIELDS TO EXTRACT:\n"
        for field in target_schema_fields:
            field_desc = f"- **{field.get('field_name', 'Unknown')}** (ID: `{field.get('field_id', 'unknown')}`)\n"
            field_desc += f"  Type: {field.get('field_type', 'TEXT')}\n"
            if field.get('description'):
                field_desc += f"  Description: {field.get('description')}\n"
            if field.get('choices'):
                field_desc += f"  Valid choices: {field.get('choices')}\n"
            prompt += field_desc + "\n"

    # 3. TARGET COLLECTIONS - Only selected collections with identifier-first logic
    if target_collections:
        prompt += "## TARGET COLLECTIONS TO EXTRACT:\n\n"
        
        # Separate section for collection identification
        prompt += "### COLLECTION IDENTIFICATION WORKFLOW:\n"
        prompt += "**CRITICAL: Use identifier-first approach for collections**\n\n"
        prompt += "**STEP 1: IDENTIFY COLLECTION ITEMS**\n"
        prompt += "- Look for identifier fields that indicate distinct items\n"
        prompt += "- Count total number of unique items found\n"
        prompt += "- Assign sequential record_index starting from 0\n\n"
        prompt += "**STEP 2: EXTRACT PROPERTIES FOR EACH ITEM**\n"
        prompt += "- For each identified item, extract all target properties\n"
        prompt += "- Include collection_name and record_index for each property\n\n"
        
        for collection in target_collections:
            prompt += f"### Collection: {collection.get('collection_name', 'Unknown Collection')}\n"
            prompt += f"Description: {collection.get('description', '')}\n\n"
            
            # Identify identifier properties
            identifier_props = []
            other_props = []
            
            for prop in collection.get('properties', []):
                prop_name = prop.get('property_name', 'Unknown')
                if 'identifier' in prop_name.lower() or 'id' in prop_name.lower():
                    identifier_props.append(prop)
                else:
                    other_props.append(prop)
            
            if identifier_props:
                prompt += "**IDENTIFIER PROPERTIES (find these first):**\n"
                for prop in identifier_props:
                    prop_desc = f"- **{prop.get('property_name', 'Unknown')}** (ID: `{prop.get('property_id', 'unknown')}`)\n"
                    prop_desc += f"  Type: {prop.get('property_type', 'TEXT')}\n"
                    if prop.get('description'):
                        prop_desc += f"  Description: {prop.get('description')}\n"
                    prompt += prop_desc + "\n"
                prompt += "\n"
            
            prompt += "**OTHER PROPERTIES (extract for each identified item):**\n"
            for prop in other_props:
                prop_desc = f"- **{prop.get('property_name', 'Unknown')}** (ID: `{prop.get('property_id', 'unknown')}`)\n"
                prop_desc += f"  Type: {prop.get('property_type', 'TEXT')}\n"
                if prop.get('description'):
                    prop_desc += f"  Description: {prop.get('description')}\n"
                prompt += prop_desc + "\n"
            prompt += "\n"

    # 4. TARGETED EXTRACTION RULES
    if extraction_rules:
        prompt += "## TARGETED/GLOBAL EXTRACTION RULES:\n"
        for rule in extraction_rules:
            target_field = rule.get('targetField', 'All Fields')
            rule_content = rule.get('ruleContent', '')
            prompt += f"- **{target_field}**: {rule_content}\n"
        prompt += "\n"

    # 5. KNOWLEDGE DOCUMENTS  
    if knowledge_documents:
        prompt += "## TARGETED/GLOBAL KNOWLEDGE DOCUMENTS:\n"
        for doc in knowledge_documents:
            doc_name = doc.get('document_name', 'Unknown Document')
            doc_content = doc.get('content', '')
            prompt += f"### {doc_name}\n{doc_content}\n\n"

    # 6. DOCUMENT CONTENT (single display)
    prompt += "## DOCUMENT CONTENT TO PROCESS:\n\n"
    prompt += document_content

    # 7. VALIDATED REFERENCE DATA
    if validated_reference_data:
        prompt += "## ALREADY VALIDATED REFERENCE DATA:\n"
        prompt += "Use this information for context and to avoid duplicating existing data:\n"
        for field_name, data in validated_reference_data.items():
            extracted_val = data.get('extractedValue', data.get('extracted_value', 'Not set'))
            prompt += f"- **{field_name}**: {extracted_val}\n"
        prompt += "\n"

    # 8. ADDITIONAL INSTRUCTIONS
    if additional_instructions:
        prompt += f"## ADDITIONAL INSTRUCTIONS:\n{additional_instructions}\n\n"

    # 9. COMPREHENSIVE OUTPUT FORMAT WITH AI REASONING
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
      "collection_record_index": 0,
      "extraction_rules": "[LIST RELEVANT TARGETED/GLOBAL EXTRACTION RULES]",
      "knowledge_documents": "[LIST RELEVANT TARGETED/GLOBAL KNOWLEDGE DOCUMENT NAMES]",
      "ai_reasoning": "Detailed explanation of extraction decision, document source, and confidence rationale"
    }
  ]
}
```

## AI REASONING REQUIREMENTS:
Each field validation MUST include detailed ai_reasoning that explains:
- What specific information was found in which document
- Why this extraction decision was made
- How extraction rules and knowledge documents influenced the decision  
- Confidence rationale (why this confidence score)
- For collections: Which identifier was used and which item index this represents

## CRITICAL REQUIREMENTS:
- Use exact field_id UUIDs from the target schema above
- For collections: Include collection_name and collection_record_index 
- Confidence as integer percentage (0-100)
- Include extraction_rules and knowledge_documents arrays for each field
- LIMIT OUTPUT TO MAXIMUM 100 field validations to prevent response overflow
- Prioritize the most relevant and confident extractions if limiting is needed
- If no data found for a field, use null value with confidence 0
- AI reasoning is MANDATORY for every field validation"""

    return prompt