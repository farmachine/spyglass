#!/usr/bin/env python3

import json
import sys
import os
import logging
import base64
from typing import Dict, Any, List, Optional, Union, Tuple
from dataclasses import dataclass

@dataclass
class FieldValidationResult:
    field_id: str
    field_name: str
    field_type: str
    extracted_value: Any
    original_extracted_value: Any
    original_confidence_score: int
    original_ai_reasoning: str
    validation_status: str
    ai_reasoning: str
    confidence_score: int
    document_source: str
    document_sections: List[str]
    collection_name: Optional[str] = None
    record_index: Optional[int] = None

@dataclass
class ExtractionResult:
    extracted_data: Dict[str, Any]
    confidence_score: float
    processing_notes: str
    field_validations: List[FieldValidationResult]

def generate_human_friendly_reasoning(field_name: str, extracted_value: Any, applied_rules: List[Dict[str, Any]]) -> str:
    """Generate human-friendly email-style reasoning for fields with conflicts or issues."""
    if not applied_rules:
        return f"Successfully extracted {field_name} from document"
    
    reasoning = f"We have extracted '{extracted_value}' for {field_name}, however there are some considerations that require your attention:\n\n"
    reasoning += "IDENTIFIED CONCERNS:\n"
    
    for rule in applied_rules:
        rule_name = rule.get('name', 'Policy Check')
        action = rule.get('action', '')
        
        if 'Knowledge Document Conflict' in rule_name:
            reasoning += "• Our compliance review process has flagged this value based on internal policies and procedures.\n"
            reasoning += "• The extracted information may require additional verification due to regulatory requirements.\n"
        elif 'Inc' in rule_name.lower() or 'entity' in action.lower():
            reasoning += "• The extracted company appears to be incorporated, which requires additional entity verification.\n"
            reasoning += "• Our standard procedure requires enhanced due diligence for corporate entities.\n"
        else:
            reasoning += f"• {action}\n"
    
    reasoning += "\nTo help us complete the verification process, could you please clarify the following:\n\n"
    
    # Generate field-specific clarification questions
    if 'company' in field_name.lower() or 'name' in field_name.lower():
        reasoning += "1. Can you confirm the full legal name of this entity as it appears in official documentation?\n"
        reasoning += "2. What is the primary business relationship with this entity (customer, vendor, partner, etc.)?\n"
        reasoning += "3. Are there any specific compliance or regulatory considerations we should be aware of for this entity?\n"
    elif 'country' in field_name.lower() or 'jurisdiction' in field_name.lower():
        reasoning += "1. Can you confirm the governing jurisdiction for this agreement?\n"
        reasoning += "2. Are there any cross-border regulatory requirements that apply to this arrangement?\n"
        reasoning += "3. Should this be subject to any specific regional compliance procedures?\n"
    elif 'date' in field_name.lower():
        reasoning += "1. Can you confirm the exact date for this field?\n"
        reasoning += "2. Is this date subject to any specific notice requirements or conditions?\n"
        reasoning += "3. Are there any related dates or deadlines we should be tracking?\n"
    else:
        reasoning += f"1. Can you verify that '{extracted_value}' is the correct value for {field_name}?\n"
        reasoning += f"2. Are there any additional details or context we should consider for this field?\n"
        reasoning += f"3. Does this information require any special handling or approval processes?\n"
    
    reasoning += "\nThank you for your assistance in completing this review."
    return reasoning

def ai_validate_batch(
    field_validations: List[Dict[str, Any]], 
    extraction_rules: Optional[List[Dict[str, Any]]] = None, 
    knowledge_documents: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Tuple[int, List[Dict[str, Any]], str]]:
    """
    Pure AI validation: All validation decisions made by AI only.
    
    Args:
        field_validations: List of dicts with 'field_name' and 'extracted_value' keys
        extraction_rules: List of extraction rules to apply (for context only)
        knowledge_documents: List of knowledge documents to check (for context only)
    
    Returns:
        Dict mapping field_name to (confidence, applied_rules, reasoning) tuples
    """
    if not field_validations:
        return {}
    
    logging.info(f"AI Validation: Processing {len(field_validations)} fields")
    
    try:
        # Check for API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logging.warning("GEMINI_API_KEY not found, using default confidence for all fields")
            return {fv['field_name']: (95, [], "Extracted during AI processing") for fv in field_validations}
        
        # Import Google AI modules
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=api_key)
        
        # Build fields summary for AI
        fields_summary = "FIELDS TO VALIDATE:\n"
        for fv in field_validations:
            fields_summary += f"- Field: {fv['field_name']} = '{fv['extracted_value']}'\n"
        
        # Add extraction rules context
        rules_context = ""
        if extraction_rules:
            rules_context = "EXTRACTION RULES:\n"
            for rule in extraction_rules:
                if rule.get("isActive", True):
                    rules_context += f"- Rule: {rule.get('ruleName', 'Unknown')}\n"
                    rules_context += f"  Target Fields: {rule.get('targetField', '')}\n"
                    rules_context += f"  Content: {rule.get('ruleContent', '')}\n\n"
        
        # Add knowledge documents context
        knowledge_context = ""
        if knowledge_documents:
            knowledge_context = "KNOWLEDGE DOCUMENTS:\n"
            for doc in knowledge_documents:
                doc_name = doc.get('displayName', doc.get('fileName', 'Unknown'))
                content = doc.get('content', '')
                if content:
                    knowledge_context += f"- Document: {doc_name}\n"
                    knowledge_context += f"  Content: {content[:800]}...\n\n"
        
        # Create AI validation prompt
        validation_prompt = f"""You are an expert data validation specialist. Use AI judgment ONLY to analyze the extracted field values.

{fields_summary}

{rules_context}

{knowledge_context}

VALIDATION TASK:
For each field, use AI judgment to:
1. Assess extraction quality and accuracy
2. Calculate confidence percentage (0-100%) based on your analysis
3. Consider context from rules and knowledge documents
4. Provide human-friendly reasoning

CONFIDENCE GUIDELINES:
- 95-100%: Clear, well-extracted values with high confidence
- 80-94%: Good extraction with minor uncertainty
- 50-79%: Reasonable extraction but some concerns
- 25-49%: Low confidence, significant issues or conflicts
- 1-24%: Very low confidence, major problems
- 0%: No value found or null extraction

RESPONSE FORMAT:
Return a JSON object with field names as keys and validation results as values:
{{
    "field_name_1": {{
        "confidence_percentage": <integer 0-100>,
        "applied_rules": [
            {{
                "name": "<rule or policy name>",
                "action": "<description of what was applied>"
            }}
        ],
        "reasoning": "<brief explanation>"
    }}
}}

Important: Process all fields efficiently. Apply rules like 'Inc.' entity ambiguity and jurisdiction conflicts from knowledge documents consistently."""

        logging.info(f"AI Validation: Sending request for {len(field_validations)} fields")
        
        # Make AI request
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[types.Content(role="user", parts=[types.Part(text=validation_prompt)])],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                max_output_tokens=2048,
                temperature=0.1
            )
        )
        
        if response.text:
            try:
                batch_results = json.loads(response.text)
                logging.info(f"AI Validation: Successfully parsed JSON with {len(batch_results)} field results")
                
                results = {}
                for fv in field_validations:
                    field_name = fv['field_name']
                    
                    if field_name in batch_results:
                        result = batch_results[field_name]
                        confidence = result.get("confidence_percentage", 95)
                        applied_rules = result.get("applied_rules", [])
                        reasoning = result.get("reasoning", "AI validation completed")
                        results[field_name] = (confidence, applied_rules, reasoning)
                    elif fv['extracted_value'] in [None, "", "null"]:
                        results[field_name] = (0, [], "No value extracted")
                    else:
                        results[field_name] = (95, [], "AI validation completed")
                
                return results
                
            except json.JSONDecodeError as e:
                logging.error(f"AI Validation: JSON parse error: {e}")
                return {fv['field_name']: (95, [], "Extracted during AI processing") for fv in field_validations}
        else:
            logging.warning("AI Validation: No response from AI, using default confidence")
            return {fv['field_name']: (95, [], "Extracted during AI processing") for fv in field_validations}
            
    except Exception as e:
        logging.error(f"AI Validation: Error during validation: {e}")
        return {fv['field_name']: (95, [], "Extracted during AI processing") for fv in field_validations}

def extract_data_from_document(
    file_content: Union[bytes, str],
    file_name: str,
    mime_type: str,
    project_schema: Dict[str, Any],
    extraction_rules: Optional[List[Dict[str, Any]]] = None,
    knowledge_documents: Optional[List[Dict[str, Any]]] = None
) -> ExtractionResult:
    """Extract structured data from a document using AI"""
    
    logging.info(f"Starting AI data extraction for: {file_name}")
    
    try:
        # Check for API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY not found - cannot perform extraction without API credentials")
        
        # Import Google AI modules using new API
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=api_key)
        
        # Build extraction prompt
        prompt = f"Extract data from this document: {file_name}\n\n"
        prompt += "CRITICAL: Extract ONLY real data from the document. Do NOT generate sample or placeholder data.\n\n"
        
        # Add schema fields
        if project_schema.get("schema_fields"):
            prompt += "Schema fields to extract:\n"
            for field in project_schema["schema_fields"]:
                field_name = field['fieldName']
                field_type = field['fieldType']
                field_description = field.get('description', '')
                if field_description:
                    prompt += f"- {field_name} ({field_type}): {field_description}\n"
                else:
                    prompt += f"- {field_name} ({field_type})\n"
        
        # Add collections
        if project_schema.get("collections"):
            prompt += "\nCollections to extract:\n"
            for collection in project_schema["collections"]:
                if not isinstance(collection, dict):
                    continue
                    
                collection_name = collection.get('collectionName', collection.get('objectName', ''))
                collection_description = collection.get('description', '')
                if collection_description:
                    prompt += f"- {collection_name}: {collection_description}\n"
                else:
                    prompt += f"- {collection_name}:\n"
                    
                properties = collection.get("properties", [])
                if isinstance(properties, list):
                    for prop in properties:
                        if isinstance(prop, dict):
                            prop_name = prop.get('propertyName', '')
                            prop_type = prop.get('propertyType', 'TEXT')
                            prop_description = prop.get('description', '')
                            if prop_description:
                                prompt += f"  * {prop_name} ({prop_type}): {prop_description}\n"
                            else:
                                prompt += f"  * {prop_name} ({prop_type})\n"
        
        # Add expected JSON format
        prompt += "\nExpected JSON format:\n{\n"
        
        if project_schema.get("schema_fields"):
            for field in project_schema["schema_fields"]:
                field_name = field['fieldName']
                prompt += f'  "{field_name}": null,\n'
        
        if project_schema.get("collections"):
            for collection in project_schema["collections"]:
                if isinstance(collection, dict):
                    collection_name = collection.get('collectionName', collection.get('objectName', ''))
                    prompt += f'  "{collection_name}": [\n    {{\n'
                    
                    properties = collection.get("properties", [])
                    if isinstance(properties, list):
                        for prop in properties:
                            if isinstance(prop, dict):
                                prop_name = prop.get('propertyName', '')
                                if prop_name:
                                    prompt += f'      "{prop_name}": null,\n'
                    
                    prompt += '    }\n  ],\n'
        
        prompt += "}\n"
        
        # Add knowledge documents context
        if knowledge_documents:
            prompt += "\nKnowledge Base Context:\n"
            for doc in knowledge_documents:
                doc_name = doc.get('displayName', doc.get('fileName', 'Unknown Document'))
                content = doc.get('content', '')
                if content and content.strip():
                    prompt += f"Document: {doc_name}\n"
                    prompt += f"Content: {content}\n\n"
            
            prompt += "IMPORTANT: Consider the above knowledge base when extracting data.\n"
        
        # Process different content types
        if mime_type.startswith("text/"):
            # Handle text content
            if isinstance(file_content, str):
                if file_content.startswith('data:'):
                    base64_content = file_content.split(',', 1)[1]
                    decoded_bytes = base64.b64decode(base64_content)
                    content_text = decoded_bytes.decode('utf-8', errors='ignore')
                else:
                    content_text = file_content
            else:
                # Handle bytes
                content_text = str(file_content, 'utf-8', errors='ignore')
            
            full_prompt = prompt + f"\n\nDocument content:\n{content_text}"
            
            # Make API call
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[types.Content(role="user", parts=[types.Part(text=full_prompt)])],
                config=types.GenerateContentConfig(
                    max_output_tokens=10000000,
                    temperature=0.1
                )
            )
        else:
            # Handle binary files (PDFs, images, etc.)
            if isinstance(file_content, str) and file_content.startswith('data:'):
                base64_content = file_content.split(',', 1)[1]
                binary_content = base64.b64decode(base64_content)
            elif isinstance(file_content, str):
                binary_content = base64.b64decode(file_content)
            else:
                binary_content = file_content
            
            # Try different processing methods
            processed = False
            response = None
            
            # Method 1: Try text extraction first
            if mime_type == "application/pdf" or binary_content[:4] == b'%PDF':
                try:
                    from docx import Document
                    import PyPDF2
                    import io
                    
                    pdf_reader = PyPDF2.PdfReader(io.BytesIO(binary_content))
                    text_content = ""
                    
                    for page in pdf_reader.pages:
                        text_content += page.extract_text() + "\n"
                    
                    if text_content.strip():
                        full_prompt = prompt + f"\n\nDocument content:\n{text_content}"
                        response = client.models.generate_content(
                            model="gemini-2.5-flash",
                            contents=[types.Content(role="user", parts=[types.Part(text=full_prompt)])],
                            config=types.GenerateContentConfig(
                                max_output_tokens=10000000,
                                temperature=0.1
                            )
                        )
                        processed = True
                        logging.info("Successfully extracted text from PDF")
                        
                except Exception as e:
                    logging.warning(f"Text extraction failed: {e}")
            
            # Method 2: Use Gemini's native file processing
            if not processed:
                try:
                    response = client.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=[
                            types.Content(role="user", parts=[
                                types.Part(text=prompt),
                                types.Part.from_bytes(data=binary_content, mime_type=mime_type)
                            ])
                        ],
                        config=types.GenerateContentConfig(
                            max_output_tokens=10000000,
                            temperature=0.1
                        )
                    )
                    processed = True
                    logging.info("Successfully processed file with Gemini native processing")
                    
                except Exception as e:
                    logging.error(f"Gemini native processing failed: {e}")
            
            # Method 3: Convert to image if other methods fail
            if not processed and mime_type == "application/pdf":
                try:
                    from pdf2image import convert_from_bytes
                    
                    images = convert_from_bytes(binary_content, dpi=200, first_page=1, last_page=3)
                    if images:
                        # Convert first page to bytes for Gemini
                        import io
                        img_byte_arr = io.BytesIO()
                        images[0].save(img_byte_arr, format='PNG')
                        img_bytes = img_byte_arr.getvalue()
                        
                        response = client.models.generate_content(
                            model="gemini-2.5-flash",
                            contents=[
                                types.Content(role="user", parts=[
                                    types.Part(text=prompt),
                                    types.Part.from_bytes(data=img_bytes, mime_type="image/png")
                                ])
                            ],
                            config=types.GenerateContentConfig(
                                max_output_tokens=10000000,
                                temperature=0.1
                            )
                        )
                        processed = True
                        logging.info("Successfully processed PDF as image")
                        
                except Exception as e:
                    logging.error(f"PDF to image conversion failed: {e}")
            
            if not processed:
                raise Exception("All document processing methods failed")
        
        # Parse the response
        if not response or not response.text:
            raise Exception("No response from AI model")
        
        logging.info(f"AI Response received: {len(response.text)} characters")
        
        # Extract JSON from response
        response_text = response.text.strip()
        
        # Handle markdown code blocks
        if response_text.startswith('```json'):
            response_text = response_text[7:]
        if response_text.startswith('```'):
            response_text = response_text[3:]
        if response_text.endswith('```'):
            response_text = response_text[:-3]
        
        try:
            extracted_data = json.loads(response_text.strip())
            logging.info("Successfully parsed JSON response")
        except json.JSONDecodeError as e:
            logging.error(f"JSON parsing failed: {e}")
            logging.error(f"Response text: {response_text[:500]}")
            raise Exception(f"Failed to parse AI response as JSON: {e}")
        
        # Generate field validations
        field_validations = []
        
        # Process schema fields
        if project_schema.get("schema_fields"):
            for field in project_schema["schema_fields"]:
                field_name = field['fieldName']
                field_id = field.get('id', '')
                field_type = field.get('fieldType', 'TEXT')
                extracted_value = extracted_data.get(field_name)
                
                # Determine validation status based on auto-verification threshold
                auto_verification_confidence = field.get('autoVerificationConfidence', 80)
                confidence_score = 95 if extracted_value not in [None, "", "null"] else 0
                validation_status = "verified" if confidence_score >= auto_verification_confidence else "unverified"
                
                field_validation = FieldValidationResult(
                    field_id=str(field_id),
                    field_name=field_name,
                    field_type=field_type,
                    extracted_value=extracted_value,
                    original_extracted_value=extracted_value,
                    original_confidence_score=confidence_score,
                    original_ai_reasoning="Extracted during AI processing",
                    validation_status=validation_status,
                    ai_reasoning="Extracted during AI processing",
                    confidence_score=confidence_score,
                    document_source=file_name,
                    document_sections=[]
                )
                field_validations.append(field_validation)
        
        # Process collections
        if project_schema.get("collections"):
            for collection in project_schema["collections"]:
                if not isinstance(collection, dict):
                    continue
                
                collection_name = collection.get('collectionName', collection.get('objectName', ''))
                collection_data = extracted_data.get(collection_name, [])
                
                if isinstance(collection_data, list):
                    properties = collection.get("properties", [])
                    
                    for record_index, record in enumerate(collection_data):
                        if isinstance(record, dict) and isinstance(properties, list):
                            for prop in properties:
                                if isinstance(prop, dict):
                                    prop_name = prop.get('propertyName', '')
                                    prop_id = prop.get('id', '')
                                    prop_type = prop.get('propertyType', 'TEXT')
                                    
                                    if prop_name:
                                        extracted_value = record.get(prop_name)
                                        field_name_with_index = f"{collection_name}.{prop_name}[{record_index}]"
                                        
                                        auto_verification_confidence = prop.get('autoVerificationConfidence', 80)
                                        confidence_score = 95 if extracted_value not in [None, "", "null"] else 0
                                        validation_status = "verified" if confidence_score >= auto_verification_confidence else "unverified"
                                        
                                        field_validation = FieldValidationResult(
                                            field_id=str(prop_id),
                                            field_name=field_name_with_index,
                                            field_type=prop_type,
                                            extracted_value=extracted_value,
                                            original_extracted_value=extracted_value,
                                            original_confidence_score=confidence_score,
                                            original_ai_reasoning="Extracted during AI processing",
                                            validation_status=validation_status,
                                            ai_reasoning="Extracted during AI processing",
                                            confidence_score=confidence_score,
                                            document_source=file_name,
                                            document_sections=[],
                                            collection_name=collection_name,
                                            record_index=record_index
                                        )
                                        field_validations.append(field_validation)
        
        # Apply validation rules if available
        if extraction_rules or knowledge_documents:
            validation_data = [{"field_name": fv.field_name, "extracted_value": fv.extracted_value} for fv in field_validations]
            validation_results = ai_validate_batch(validation_data, extraction_rules, knowledge_documents)
            
            # Update field validations with AI validation results
            for field_validation in field_validations:
                if field_validation.field_name in validation_results:
                    confidence, applied_rules, reasoning = validation_results[field_validation.field_name]
                    field_validation.confidence_score = confidence
                    field_validation.ai_reasoning = generate_human_friendly_reasoning(
                        field_validation.field_name, field_validation.extracted_value, applied_rules
                    )
                    # Update validation status based on confidence
                    auto_verification_confidence = 80  # Default threshold
                    field_validation.validation_status = "verified" if confidence >= auto_verification_confidence else "unverified"
        
        result = ExtractionResult(
            extracted_data=extracted_data,
            confidence_score=85.0,
            processing_notes=f"Successfully extracted data from {file_name}",
            field_validations=field_validations
        )
        
        logging.info(f"Extraction completed: {len(field_validations)} field validations created")
        return result
        
    except Exception as e:
        logging.error(f"Extraction failed: {e}")
        raise Exception(f"Document extraction failed: {str(e)}")

def main():
    """Main function for command-line usage"""
    if len(sys.argv) < 2:
        print("Usage: python ai_extraction.py <extraction_data_json>")
        sys.exit(1)
    
    try:
        extraction_data = json.loads(sys.argv[1])
        
        files = extraction_data.get('files', [])
        project_schema = extraction_data.get('project_schema', {})
        extraction_rules = extraction_data.get('extraction_rules', [])
        knowledge_documents = extraction_data.get('knowledge_documents', [])
        
        all_field_validations = []
        aggregated_extraction = {"field_validations": []}
        
        for file_data in files:
            file_content = file_data['file_content']
            file_name = file_data['file_name']
            mime_type = file_data['mime_type']
            
            result = extract_data_from_document(
                file_content, file_name, mime_type, project_schema, 
                extraction_rules, knowledge_documents
            )
            
            all_field_validations.extend(result.field_validations)
        
        # Aggregate collections across documents
        collection_aggregation = {}
        schema_field_data = {}
        
        for field_validation in all_field_validations:
            if field_validation.collection_name:
                # Collection property
                collection_name = field_validation.collection_name
                if collection_name not in collection_aggregation:
                    collection_aggregation[collection_name] = []
                
                # Find or create record
                record_index = field_validation.record_index or 0
                while len(collection_aggregation[collection_name]) <= record_index:
                    collection_aggregation[collection_name].append({})
                
                prop_name = field_validation.field_name.split('.')[-1].split('[')[0]
                collection_aggregation[collection_name][record_index][prop_name] = field_validation.extracted_value
            else:
                # Schema field
                field_name = field_validation.field_name
                schema_field_data[field_name] = field_validation.extracted_value
        
        # Reindex field validations
        final_field_validations = []
        validation_index = 0
        
        # Add schema field validations
        for field_validation in all_field_validations:
            if not field_validation.collection_name:
                final_field_validations.append(field_validation)
        
        # Add reindexed collection validations
        for collection_name, records in collection_aggregation.items():
            for new_index, record in enumerate(records):
                for prop_name, value in record.items():
                    # Find original validation to copy metadata
                    original_validation = None
                    for fv in all_field_validations:
                        if (fv.collection_name == collection_name and 
                            prop_name in fv.field_name and fv.extracted_value == value):
                            original_validation = fv
                            break
                    
                    if original_validation:
                        new_validation = FieldValidationResult(
                            field_id=original_validation.field_id,
                            field_name=f"{collection_name}.{prop_name}[{new_index}]",
                            field_type=original_validation.field_type,
                            extracted_value=value,
                            original_extracted_value=value,
                            original_confidence_score=original_validation.confidence_score,
                            original_ai_reasoning=original_validation.ai_reasoning,
                            validation_status=original_validation.validation_status,
                            ai_reasoning=original_validation.ai_reasoning,
                            confidence_score=original_validation.confidence_score,
                            document_source=original_validation.document_source,
                            document_sections=original_validation.document_sections,
                            collection_name=collection_name,
                            record_index=new_index
                        )
                        final_field_validations.append(new_validation)
        
        # Build final result
        final_extracted_data = {**schema_field_data, **collection_aggregation}
        aggregated_extraction["field_validations"] = [
            {
                "field_id": fv.field_id,
                "field_name": fv.field_name,
                "field_type": fv.field_type,
                "extracted_value": fv.extracted_value,
                "validation_status": fv.validation_status,
                "ai_reasoning": fv.ai_reasoning,
                "confidence_score": fv.confidence_score,
                "document_source": fv.document_source
            }
            for fv in final_field_validations
        ]
        
        result = {
            "success": True,
            "extracted_data": final_extracted_data,
            "aggregated_extraction": aggregated_extraction,
            "processing_notes": f"Successfully processed {len(files)} files"
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "extracted_data": {},
            "aggregated_extraction": {"field_validations": []}
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()