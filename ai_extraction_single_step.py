#!/usr/bin/env python3
"""
SIMPLIFIED AI EXTRACTION SYSTEM - Single-step process
Extract documents → Generate field records with confidence, status, and reasoning
Adapted for current API structure with percentage format
"""

import os
import json
import logging
import base64
import re
import uuid
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ExtractionResult:
    """Result of the complete extraction and field creation process"""
    success: bool
    field_validations: Optional[List[Dict[str, Any]]] = None
    aggregated_extraction: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    documents_processed: int = 0

class SingleStepExtractor:
    """Handles complete document extraction and field validation creation in one step"""
    
    def __init__(self):
        self.logger = logger
    
    def extract_and_validate_all(
        self,
        documents: List[Dict[str, Any]],
        project_schema: Dict[str, Any],
        extraction_rules: List[Dict[str, Any]] = None,
        knowledge_documents: List[Dict[str, Any]] = None,
        session_id: str = None
    ) -> ExtractionResult:
        """
        Complete single-step extraction process:
        1. Extract all document content
        2. Generate field validations with confidence/status/reasoning
        3. Return ready-to-save validation records
        """
        try:
            # Validate inputs
            if not documents:
                return ExtractionResult(success=False, error_message="No documents provided")
            
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                return ExtractionResult(success=False, error_message="GEMINI_API_KEY not found")
            
            # Import Gemini with proper configuration
            from google import genai
            client = genai.Client(api_key=api_key)
            model = client.models
            
            self.logger.info(f"Starting single-step extraction for {len(documents)} documents")
            
            # Step 1: Extract all document content using Gemini
            document_content = self._extract_all_document_content(documents, model)
            
            # Step 2: Build comprehensive extraction prompt
            extraction_prompt = self._build_single_step_prompt(
                document_content, project_schema, extraction_rules, knowledge_documents, session_id
            )
            
            # Step 3: Get AI extraction with field validations
            self.logger.info("Sending comprehensive extraction request to AI...")
            response = model.generate_content(
                model="gemini-2.5-flash",
                contents=extraction_prompt,
                config=genai.types.GenerateContentConfig(
                    max_output_tokens=8192,  # Increased for larger responses
                    temperature=0.1
                )
            )
            
            if not response or not response.text:
                return ExtractionResult(success=False, error_message="No response from AI")
            
            # Step 4: Parse field validations and aggregated data from AI response
            parsed_result = self._parse_extraction_result(response.text, session_id)
            
            if parsed_result is None:
                return ExtractionResult(success=False, error_message="Failed to parse AI response")
            
            field_validations, aggregated_extraction = parsed_result
            
            self.logger.info(f"Successfully created {len(field_validations)} field validation records")
            return ExtractionResult(
                success=True,
                field_validations=field_validations,
                aggregated_extraction=aggregated_extraction,
                documents_processed=len(documents)
            )
            
        except Exception as e:
            self.logger.error(f"Single-step extraction failed: {e}")
            return ExtractionResult(success=False, error_message=str(e))
    
    def _extract_all_document_content(self, documents: List[Dict[str, Any]], model) -> str:
        """Extract all document content into single text using Gemini"""
        all_content = []
        
        for doc in documents:
            file_content = doc.get('file_content', doc.get('content', ''))
            file_name = doc.get('file_name', doc.get('name', 'unknown'))
            mime_type = doc.get('mime_type', doc.get('type', 'application/pdf'))
            
            self.logger.info(f"Extracting content from: {file_name} ({mime_type})")
            
            try:
                if mime_type.startswith("text/"):
                    # Handle text files directly
                    content_text = self._extract_text_content(file_content)
                    all_content.append(f"=== DOCUMENT: {file_name} ===\n{content_text}")
                    
                else:
                    # Use Gemini to extract content from binary files (PDFs, images, etc.)
                    if isinstance(file_content, str) and file_content.startswith('data:'):
                        mime_part, base64_content = file_content.split(',', 1)
                        binary_content = base64.b64decode(base64_content)
                        
                        # Create file part for Gemini
                        file_part = {
                            "mime_type": mime_type,
                            "data": binary_content
                        }
                        
                        # Extract text using Gemini
                        extract_prompt = f"Extract all text content from this document. Return only the extracted text, no explanations."
                        
                        # Create file part for new Gemini API
                        from google.genai import types
                        file_part = types.Part.from_bytes(
                            data=binary_content,
                            mime_type=mime_type
                        )
                        
                        response = model.generate_content(
                            model="gemini-2.5-flash",
                            contents=[extract_prompt, file_part]
                        )
                        
                        if response and response.text:
                            extracted_text = response.text.strip()
                            all_content.append(f"=== DOCUMENT: {file_name} ===\n{extracted_text}")
                        else:
                            all_content.append(f"=== DOCUMENT: {file_name} ===\n[Could not extract content]")
                            
            except Exception as e:
                self.logger.error(f"Failed to extract content from {file_name}: {e}")
                all_content.append(f"=== DOCUMENT: {file_name} ===\n[Extraction failed: {str(e)}]")
        
        combined_content = "\n\n".join(all_content)
        self.logger.info(f"Combined document content length: {len(combined_content)} characters from {len(documents)} documents")
        return combined_content
    
    def _extract_text_content(self, content: Any) -> str:
        """Extract text from various content formats"""
        if isinstance(content, str):
            if content.startswith('data:'):
                try:
                    base64_content = content.split(',', 1)[1]
                    decoded_bytes = base64.b64decode(base64_content)
                    return decoded_bytes.decode('utf-8', errors='ignore')
                except Exception:
                    return content
            return content
        elif isinstance(content, bytes):
            return content.decode('utf-8', errors='ignore')
        else:
            return str(content)
    
    def _build_single_step_prompt(
        self,
        document_content: str,
        project_schema: Dict[str, Any],
        extraction_rules: List[Dict[str, Any]],
        knowledge_documents: List[Dict[str, Any]],
        session_id: str
    ) -> str:
        """Build comprehensive single-step extraction prompt"""
        
        prompt = f"""You are an expert data extraction specialist. Extract data from {len(document_content.split('=== DOCUMENT:')) - 1} documents and create field validation records with confidence ratings, status, and reasoning.

CRITICAL INSTRUCTIONS:
1. PROCESS ALL DOCUMENTS: Scan every document completely to count ALL instances
2. FOLLOW SCHEMA DESCRIPTIONS: Field descriptions are your extraction instructions
3. APPLY EXTRACTION RULES: Rules modify confidence and formatting
4. CHECK KNOWLEDGE BASE: Flag conflicts with knowledge documents
5. COUNT COMPREHENSIVELY: For counting fields, find EVERY instance across ALL documents
6. Generate confidence rating as PERCENTAGE (1-100%) based on extraction certainty
7. Create validation records ready for database insertion
8. Return both field validations AND aggregated extraction data

DOCUMENT CONTENT TO ANALYZE ({len(document_content)} characters):
{document_content[:8000]}... [Content truncated for efficiency]

EXTRACTION SCHEMA WITH AI GUIDANCE:"""
        
        # Build schema guidance with rules
        schema_guidance = self._build_schema_guidance(project_schema, extraction_rules or [])
        prompt += schema_guidance
        
        # Add extraction rules context
        if extraction_rules:
            prompt += "\n\nEXTRACTION RULES TO APPLY:"
            for rule in extraction_rules:
                if rule.get('isActive', True):
                    rule_name = rule.get('ruleName', 'Rule')
                    rule_content = rule.get('ruleContent', '')
                    target_field = rule.get('targetField', '')
                    prompt += f"\n- **{rule_name}**: {rule_content} (applies to: {target_field})"
                    
                    # Extract confidence percentage
                    confidence_match = re.search(r'(\d{1,2})%', rule_content)
                    if confidence_match:
                        prompt += f" [SET CONFIDENCE: {confidence_match.group(1)}%]"
        
        # Add knowledge documents for conflict checking
        if knowledge_documents:
            prompt += "\n\nKNOWLEDGE BASE FOR CONFLICT DETECTION:"
            for doc in knowledge_documents:
                doc_name = doc.get('displayName', doc.get('fileName', 'Document'))
                content = doc.get('content', '')[:1000]  # Limit length
                if content:
                    prompt += f"\n- {doc_name}: {content}..."
        
        # Generate example output format
        example_output = self._generate_output_example(project_schema, session_id)
        
        prompt += f"""

REQUIRED OUTPUT FORMAT (field validations + aggregated extraction):
{example_output}

CONFIDENCE RATING GUIDELINES (as percentages):
- 95-100%: Perfect extraction, clear value, no conflicts
- 80-94%: Good extraction, minor uncertainties
- 60-79%: Acceptable extraction, some ambiguity
- 30-59%: Weak extraction, significant uncertainty  
- 10-29%: Very uncertain extraction
- 1-9%: Minimal confidence extraction

VALIDATION STATUS GUIDELINES:
- "valid": Value successfully found and extracted
- "unverified": Value found but needs manual review
- "invalid": Value conflicts with knowledge base or rules

REASONING GUIDELINES:
- Explain extraction confidence level
- Reference specific document sections
- Mention applicable extraction rules
- Note any knowledge base conflicts
- Be specific and actionable

RETURN ONLY VALID JSON - NO EXPLANATIONS OR MARKDOWN"""
        
        return prompt
    
    def _build_schema_guidance(self, project_schema: Dict[str, Any], extraction_rules: List[Dict[str, Any]]) -> str:
        """Build schema guidance with rule applications"""
        guidance = ""
        
        # Project schema fields
        schema_fields = project_schema.get("schema_fields", [])
        if schema_fields:
            guidance += "\n\nPROJECT FIELDS TO EXTRACT:"
            for field in schema_fields:
                field_guidance = self._build_field_guidance(field, extraction_rules)
                guidance += f"\n- {field_guidance}"
        
        # Collections
        collections = project_schema.get("collections", [])
        if collections:
            guidance += "\n\nCOLLECTIONS TO EXTRACT (extract ALL instances):"
            for collection in collections:
                collection_guidance = self._build_collection_guidance(collection, extraction_rules)
                guidance += f"\n{collection_guidance}"
        
        return guidance
    
    def _build_field_guidance(self, field: Dict[str, Any], extraction_rules: List[Dict[str, Any]]) -> str:
        """Build guidance for individual field with applicable rules"""
        field_name = field.get('fieldName', '')
        field_type = field.get('fieldType', 'TEXT')
        description = field.get('description', 'Extract this field')
        
        # Find applicable rules
        applicable_rules = self._find_applicable_rules(field_name, extraction_rules)
        
        guidance = f"**{field_name}** ({field_type}): {description}"
        
        if applicable_rules:
            rule_guidance = []
            for rule in applicable_rules:
                rule_content = rule.get('ruleContent', '')
                rule_guidance.append(f"RULE: {rule_content}")
            guidance += " | " + " | ".join(rule_guidance)
        
        return guidance
    
    def _build_collection_guidance(self, collection: Dict[str, Any], extraction_rules: List[Dict[str, Any]]) -> str:
        """Build guidance for collection with properties"""
        collection_name = collection.get('collectionName', collection.get('objectName', ''))
        description = collection.get('description', 'Extract array of objects')
        
        guidance = f"- **{collection_name}**: {description}"
        
        # Add properties
        properties = collection.get("properties", [])
        if properties:
            guidance += f"\n  Properties for {collection_name}:"
            for prop in properties:
                prop_guidance = self._build_property_guidance(prop, collection_name, extraction_rules)
                guidance += f"\n  * {prop_guidance}"
        
        return guidance
    
    def _build_property_guidance(self, prop: Dict[str, Any], collection_name: str, extraction_rules: List[Dict[str, Any]]) -> str:
        """Build guidance for collection property with arrow notation support"""
        prop_name = prop.get('propertyName', '')
        prop_type = prop.get('propertyType', 'TEXT')
        description = prop.get('description', 'Extract this property')
        
        # Find applicable rules for property (including arrow notation)
        arrow_notation = f"{collection_name} --> {prop_name}"
        full_prop_name = f"{collection_name}.{prop_name}"
        
        applicable_rules = []
        for rule in extraction_rules:
            if not rule.get('isActive', True):
                continue
                
            rule_target = rule.get('targetField', [])
            if self._rule_applies_to_target(rule_target, [arrow_notation, full_prop_name, prop_name]):
                applicable_rules.append(rule)
        
        guidance = f"**{prop_name}** ({prop_type}): {description}"
        
        if applicable_rules:
            rule_guidance = []
            for rule in applicable_rules:
                rule_content = rule.get('ruleContent', '')
                rule_guidance.append(f"RULE: {rule_content}")
            guidance += " | " + " | ".join(rule_guidance)
        
        return guidance
    
    def _find_applicable_rules(self, field_name: str, extraction_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find rules applicable to a field"""
        applicable_rules = []
        for rule in extraction_rules:
            if not rule.get('isActive', True):
                continue
                
            rule_target = rule.get('targetField', [])
            if self._rule_applies_to_target(rule_target, [field_name]):
                applicable_rules.append(rule)
        
        return applicable_rules
    
    def _rule_applies_to_target(self, rule_target: Any, target_names: List[str]) -> bool:
        """Check if rule applies to any of the target names"""
        if isinstance(rule_target, list):
            return any(target in rule_target for target in target_names) or 'All Fields' in rule_target
        else:
            return rule_target in target_names or rule_target == 'All Fields'
    
    def _generate_output_example(self, project_schema: Dict[str, Any], session_id: str) -> str:
        """Generate example output format"""
        example_validations = []
        example_extracted_data = {}
        
        # Project fields example
        schema_fields = project_schema.get("schema_fields", [])
        for field in schema_fields[:2]:  # Show first 2 as example
            field_name = field.get('fieldName', 'fieldName')
            field_type = field.get('fieldType', 'TEXT')
            
            validation_record = {
                "uuid": str(uuid.uuid4()),
                "session_id": session_id or "session_uuid",
                "field_name": field_name,
                "field_type": field_type,
                "extracted_value": "extracted_value",
                "validation_status": "valid",
                "validation_confidence": 95,
                "ai_reasoning": "High confidence extraction from document analysis"
            }
            example_validations.append(validation_record)
            example_extracted_data[field_name] = "extracted_value"
        
        # Collection example
        collections = project_schema.get("collections", [])
        if collections:
            collection = collections[0]
            collection_name = collection.get('collectionName', collection.get('objectName', 'Collection'))
            properties = collection.get("properties", [])
            
            collection_data = []
            for i in range(2):  # Show 2 collection items
                item_data = {}
                for prop in properties[:2]:  # First 2 properties
                    prop_name = prop.get('propertyName', 'propName')
                    prop_type = prop.get('propertyType', 'TEXT')
                    
                    validation_record = {
                        "uuid": str(uuid.uuid4()),
                        "session_id": session_id or "session_uuid", 
                        "field_name": f"{collection_name}.{prop_name}[{i}]",
                        "field_type": prop_type,
                        "extracted_value": f"value_{i}",
                        "validation_status": "valid",
                        "validation_confidence": 85,
                        "ai_reasoning": f"Extracted from {collection_name} item {i+1}"
                    }
                    example_validations.append(validation_record)
                    item_data[prop_name] = f"value_{i}"
                
                collection_data.append(item_data)
            
            example_extracted_data[collection_name] = collection_data
        
        example_output = {
            "fieldValidations": example_validations,
            "aggregatedExtraction": {
                "extracted_data": example_extracted_data,
                "field_validations": {
                    "field_count": len(example_validations),
                    "validation_summary": "Successfully processed extraction"
                }
            }
        }
        
        return json.dumps(example_output, indent=2)
    
    def _parse_extraction_result(self, response_text: str, session_id: str) -> Optional[tuple]:
        """Parse field validations and aggregated extraction from AI response"""
        try:
            # Clean response
            cleaned_text = response_text.strip()
            
            # Remove markdown code blocks
            if cleaned_text.startswith("```json"):
                cleaned_text = cleaned_text[7:]
            if cleaned_text.startswith("```"):
                cleaned_text = cleaned_text[3:]
            if cleaned_text.endswith("```"):
                cleaned_text = cleaned_text[:-3]
            
            cleaned_text = cleaned_text.strip()
            
            if not cleaned_text:
                return [], {}
            
            # Parse JSON
            response_data = json.loads(cleaned_text)
            
            # Extract field validations
            field_validations = response_data.get('fieldValidations', [])
            
            # Validate and process field validations
            processed_validations = []
            for validation in field_validations:
                if self._validate_field_validation(validation):
                    # Ensure session_id is set
                    validation['session_id'] = session_id
                    # Ensure uuid is set
                    if 'uuid' not in validation:
                        validation['uuid'] = str(uuid.uuid4())
                    processed_validations.append(validation)
                else:
                    self.logger.warning(f"Invalid field validation: {validation}")
            
            # Extract aggregated extraction data
            aggregated_extraction = response_data.get('aggregatedExtraction', {})
            
            return processed_validations, aggregated_extraction
            
        except json.JSONDecodeError as e:
            self.logger.error(f"JSON parsing failed: {e}")
            self.logger.error(f"Response text length: {len(cleaned_text)} characters")
            self.logger.error(f"Response start: {cleaned_text[:200]}...")
            self.logger.error(f"Response end: {cleaned_text[-200:]}")
            return None
        except Exception as e:
            self.logger.error(f"Extraction result parsing failed: {e}")
            return None
    
    def _validate_field_validation(self, validation: Dict[str, Any]) -> bool:
        """Validate field validation structure"""
        required_fields = ['field_name', 'field_type', 'validation_status', 'validation_confidence', 'ai_reasoning']
        
        for field in required_fields:
            if field not in validation:
                return False
        
        # Validate confidence score (should be percentage 1-100)
        confidence = validation.get('validation_confidence', 0)
        if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 100:
            return False
        
        # Validate status
        valid_statuses = ['valid', 'unverified', 'invalid']
        if validation.get('validation_status') not in valid_statuses:
            return False
        
        return True

# Main function for API integration
def extract_and_create_validations(
    documents: List[Dict[str, Any]],
    project_schema: Dict[str, Any],
    extraction_rules: List[Dict[str, Any]] = None,
    knowledge_documents: List[Dict[str, Any]] = None,
    session_id: str = None
) -> ExtractionResult:
    """
    Main function for complete single-step extraction and validation creation
    
    Args:
        documents: List of document objects with file_content, file_name, mime_type
        project_schema: Schema with schema_fields and collections
        extraction_rules: Rules for extraction guidance and confidence adjustment
        knowledge_documents: Knowledge base for conflict detection
        session_id: Session identifier for field validations
    
    Returns:
        ExtractionResult with field validations and aggregated extraction ready for database
    """
    extractor = SingleStepExtractor()
    return extractor.extract_and_validate_all(
        documents, project_schema, extraction_rules, knowledge_documents, session_id
    )

# CLI interface
if __name__ == "__main__":
    import sys
    
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        result = extract_and_create_validations(
            documents=input_data.get("documents", []),
            project_schema=input_data.get("project_schema", {}),
            extraction_rules=input_data.get("extraction_rules", []),
            knowledge_documents=input_data.get("knowledge_documents", []),
            session_id=input_data.get("session_id")
        )
        
        if result.success:
            output = {
                "success": True,
                "fieldValidations": result.field_validations,
                "aggregatedExtraction": result.aggregated_extraction,
                "documentsProcessed": result.documents_processed
            }
            print(json.dumps(output))
        else:
            print(json.dumps({"error": result.error_message}), file=sys.stderr)
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"CLI execution failed: {e}")
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)