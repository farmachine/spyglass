#!/usr/bin/env python3
"""
VALIDATION-ONLY AI SYSTEM
Single-step process: Validate extracted data only (add confidence scores, reasoning, and validation status)
"""
import os
import json
import logging
import sys
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)

@dataclass
class ValidationOnlyResult:
    success: bool
    validated_fields: Optional[List[Dict[str, Any]]] = None
    error_message: Optional[str] = None
    input_token_count: Optional[int] = None
    output_token_count: Optional[int] = None

def run_validation_only(
    field_validations: List[Dict[str, Any]],
    extraction_rules: List[Dict[str, Any]],
    knowledge_documents: List[Dict[str, Any]],
    extracted_texts: List[Dict[str, Any]],
    session_id: str
) -> ValidationOnlyResult:
    """
    Run validation-only process using Google Gemini API.
    Takes extracted data and adds confidence scores, reasoning, and validation status.
    """
    try:
        import google.generativeai as genai
        
        # Get API key
        api_key = os.environ.get('GOOGLE_API_KEY')
        if not api_key:
            raise ValueError("GOOGLE_API_KEY environment variable not set")
        
        # Configure Gemini
        genai.configure(api_key=api_key)
        
        # Use Gemini 2.0 Flash for validation
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Build validation prompt
        validation_prompt = """You are an expert data validation specialist. Review the extracted field data and provide validation assessments.

## CRITICAL INSTRUCTIONS:
1. VALIDATE EXTRACTED DATA: Review each field's extracted value for accuracy and completeness
2. ASSIGN CONFIDENCE SCORES: Rate each field from 0.0 to 1.0 based on extraction quality
3. PROVIDE REASONING: Explain why each field was validated or flagged
4. DETERMINE STATUS: Set validation_status as 'verified' (confident) or 'unverified' (needs review)
5. USE KNOWLEDGE DOCUMENTS: Reference knowledge documents when validating field meanings
6. APPLY EXTRACTION RULES: Consider extraction rules when determining validation criteria

## VALIDATION CRITERIA:
- **High Confidence (0.8-1.0)**: Clear, unambiguous data directly found in documents
- **Medium Confidence (0.5-0.79)**: Data found but may need interpretation or context
- **Low Confidence (0.0-0.49)**: Data unclear, missing, or potentially incorrect

## VALIDATION STATUS:
- **verified**: Confidence >= 0.8 and data appears accurate
- **unverified**: Confidence < 0.8 or data needs human review

## REQUIRED OUTPUT FORMAT:
```json
{
  "validated_fields": [
    {
      "validation_id": "field-validation-id",
      "confidence_score": 0.0-1.0,
      "validation_status": "verified|unverified",
      "ai_reasoning": "Detailed explanation of validation assessment"
    }
  ]
}
```

## VALIDATION DATA TO PROCESS:
"""
        
        # Add session context
        prompt_parts = [validation_prompt]
        prompt_parts.append(f"\n\n## SESSION CONTEXT:")
        prompt_parts.append(f"Session ID: {session_id}")
        prompt_parts.append(f"Fields to validate: {len(field_validations)}")
        
        # Add field validation records
        if field_validations:
            prompt_parts.append(f"\n\n## FIELD VALIDATIONS TO ASSESS:")
            prompt_parts.append("```json")
            prompt_parts.append(json.dumps({"field_validations": field_validations}, indent=2))
            prompt_parts.append("```")
        
        # Add extraction rules
        if extraction_rules:
            prompt_parts.append(f"\n\n## EXTRACTION RULES:")
            for rule in extraction_rules:
                rule_text = f"**{rule.get('ruleName', 'Unknown Rule')}**: {rule.get('ruleContent', 'No content specified')}"
                prompt_parts.append(rule_text)
        
        # Add knowledge documents
        if knowledge_documents:
            prompt_parts.append(f"\n\n## KNOWLEDGE DOCUMENTS:")
            for kb_doc in knowledge_documents:
                kb_name = kb_doc.get('displayName', 'Unknown Document')
                kb_content = kb_doc.get('content', 'No content')
                prompt_parts.append(f"\n### Knowledge Document: {kb_name}")
                prompt_parts.append(kb_content[:2000])  # Limit knowledge doc content
        
        # Add extracted text context
        if extracted_texts:
            prompt_parts.append(f"\n\n## DOCUMENT CONTEXT (for reference):")
            for i, text in enumerate(extracted_texts[:3]):  # Limit to first 3 documents
                doc_name = text.get('document_name', f'Document {i+1}')
                doc_content = text.get('content', '')[:1000]  # Limit content length
                prompt_parts.append(f"\n### {doc_name}:")
                prompt_parts.append(doc_content)
        
        prompt_parts.append("\n\nReturn only the JSON validation results - no explanations or markdown.")
        
        final_prompt = '\n'.join(prompt_parts)
        
        # Call Gemini API
        logging.info(f"Calling Gemini API for validation-only processing...")
        
        response = model.generate_content(
            final_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                top_p=0.8,
                top_k=40,
                max_output_tokens=4096,
                response_mime_type="application/json"
            )
        )
        
        response_text = response.text
        
        # Get token counts
        input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0) if hasattr(response, 'usage_metadata') else 0
        output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0) if hasattr(response, 'usage_metadata') else 0
        
        logging.info(f"Gemini validation response received. Input tokens: {input_tokens}, Output tokens: {output_tokens}")
        
        # Try to parse the response
        try:
            parsed_response = json.loads(response_text)
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse JSON response: {str(e)}")
            return ValidationOnlyResult(
                success=False,
                error_message=f"JSON parsing failed: {str(e)}",
                input_token_count=input_tokens,
                output_token_count=output_tokens
            )
        
        # Validate the response structure
        if not isinstance(parsed_response, dict) or 'validated_fields' not in parsed_response:
            return ValidationOnlyResult(
                success=False,
                error_message="Response missing 'validated_fields' key",
                input_token_count=input_tokens,
                output_token_count=output_tokens
            )
        
        validated_fields = parsed_response['validated_fields']
        if not isinstance(validated_fields, list):
            return ValidationOnlyResult(
                success=False,
                error_message="'validated_fields' is not a list",
                input_token_count=input_tokens,
                output_token_count=output_tokens
            )
        
        logging.info(f"Validation completed successfully. Validated {len(validated_fields)} fields")
        
        return ValidationOnlyResult(
            success=True,
            validated_fields=validated_fields,
            input_token_count=input_tokens,
            output_token_count=output_tokens
        )
        
    except Exception as e:
        logging.error(f"Error during validation: {str(e)}")
        return ValidationOnlyResult(
            success=False,
            error_message=str(e)
        )

if __name__ == "__main__":
    try:
        # Read input from stdin (sent from Node.js)
        input_data = sys.stdin.read()
        data = json.loads(input_data)
        
        # Extract the input parameters from the Node.js request
        field_validations = data.get('field_validations', [])
        extraction_rules = data.get('extraction_rules', [])
        knowledge_documents = data.get('knowledge_documents', [])
        extracted_texts = data.get('extracted_texts', [])
        session_id = data.get('session_id', 'unknown-session')
        
        logging.info(f"Processing validation for {len(field_validations)} fields in session {session_id}")
        
        # Run the validation-only process
        result = run_validation_only(
            field_validations=field_validations,
            extraction_rules=extraction_rules,
            knowledge_documents=knowledge_documents,
            extracted_texts=extracted_texts,
            session_id=session_id
        )
        
        # Output the result as JSON
        output = {
            'success': result.success,
            'validated_fields': result.validated_fields,
            'error_message': result.error_message,
            'input_token_count': result.input_token_count,
            'output_token_count': result.output_token_count
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        # Output error as JSON
        error_output = {
            'success': False,
            'error_message': str(e),
            'validated_fields': None
        }
        print(json.dumps(error_output))