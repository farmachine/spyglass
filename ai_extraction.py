#!/usr/bin/env python3

import json
import sys
import os
import logging
import base64
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

@dataclass
class ValidationResult:
    field_id: str
    field_name: str
    field_type: str
    extracted_value: Any
    confidence_score: int
    ai_reasoning: str
    validation_status: str
    collection_name: Optional[str] = None
    record_index: Optional[int] = None

class AIExtractor:
    """Simplified AI extraction with single responsibility"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self._setup_ai_client()
    
    def _setup_ai_client(self):
        """Initialize AI client once"""
        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
            self.model_name = "gemini-2.5-flash"
        except ImportError as e:
            raise Exception(f"Google AI modules not available: {e}")
    
    def extract_from_document(
        self, 
        file_content: Any, 
        file_name: str, 
        mime_type: str,
        schema: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Extract data from a single document"""
        
        prompt = self._build_extraction_prompt(schema, file_name)
        
        try:
            if mime_type.startswith("text/"):
                content_text = self._process_text_content(file_content)
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt + f"\n\nDocument content:\n{content_text}"
                )
            elif "spreadsheet" in mime_type or mime_type.endswith(".xlsx") or mime_type.endswith(".xls"):
                # Handle Excel files
                content_text = self._process_excel_content(file_content, file_name)
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt + f"\n\nDocument content:\n{content_text}"
                )
            else:
                # Handle PDFs and other binary files
                content_text = self._process_pdf_content(file_content)
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt + f"\n\nDocument content:\n{content_text}"
                )
            
            return self._parse_ai_response(response.text)
            
        except Exception as e:
            logging.error(f"Extraction failed for {file_name}: {type(e).__name__}: {e}")
            import traceback
            logging.error(f"Full traceback: {traceback.format_exc()}")
            return {}
    
    def _build_extraction_prompt(self, schema: Dict[str, Any], file_name: str) -> str:
        """Build a focused extraction prompt"""
        prompt = f"""Extract data from document: {file_name}

CRITICAL: Extract ONLY real data. Return null for missing values.

SCHEMA FIELDS:"""
        
        # Add schema fields
        for field in schema.get("schema_fields", []):
            name = field.get('fieldName', '')
            field_type = field.get('fieldType', 'TEXT')
            description = field.get('description', '')
            prompt += f"\n- {name} ({field_type}): {description}"
        
        # Add collections
        for collection in schema.get("collections", []):
            collection_name = collection.get('collectionName', '')
            prompt += f"\n\nCOLLECTION: {collection_name}"
            
            for prop in collection.get("properties", []):
                prop_name = prop.get('propertyName', '')
                prop_type = prop.get('propertyType', 'TEXT')
                description = prop.get('description', '')
                prompt += f"\n  - {prop_name} ({prop_type}): {description}"
        
        prompt += "\n\nReturn JSON format matching the schema structure."
        return prompt
    
    def _process_text_content(self, file_content: Any) -> str:
        """Process text content from various formats"""
        if isinstance(file_content, str):
            if file_content.startswith('data:'):
                base64_content = file_content.split(',', 1)[1]
                return base64.b64decode(base64_content).decode('utf-8', errors='ignore')
            return file_content
        return file_content.decode('utf-8', errors='ignore')
    
    def _process_excel_content(self, file_content: Any, file_name: str) -> str:
        """Process Excel content using pandas"""
        try:
            # Decode base64 if needed
            if isinstance(file_content, str) and file_content.startswith('data:'):
                base64_content = file_content.split(',', 1)[1]
                binary_content = base64.b64decode(base64_content)
            elif isinstance(file_content, str):
                binary_content = base64.b64decode(file_content)
            else:
                binary_content = file_content
            
            import pandas as pd
            import io
            
            # Read Excel file
            excel_file = io.BytesIO(binary_content)
            
            # Get all sheet names
            excel_sheets = pd.read_excel(excel_file, sheet_name=None, engine='openpyxl')
            
            formatted_content = f"Excel File: {file_name}\n"
            formatted_content += "=" * 50 + "\n\n"
            
            # Process each sheet
            for sheet_name, df in excel_sheets.items():
                formatted_content += f"SHEET: {sheet_name}\n"
                formatted_content += "-" * 30 + "\n"
                
                # Convert DataFrame to string representation
                if not df.empty:
                    # Clean up the DataFrame display
                    formatted_content += df.to_string(index=False, na_rep='')
                    formatted_content += "\n\n"
                else:
                    formatted_content += "Sheet is empty\n\n"
            
            return formatted_content
            
        except Exception as e:
            logging.error(f"Excel processing error: {e}")
            return f"EXCEL_PROCESSING_ERROR: {str(e)}"
    
    def _process_pdf_content(self, file_content: Any) -> str:
        """Process PDF content - simplified approach"""
        try:
            # Decode base64 if needed
            if isinstance(file_content, str) and file_content.startswith('data:'):
                base64_content = file_content.split(',', 1)[1]
                binary_content = base64.b64decode(base64_content)
            elif isinstance(file_content, str):
                binary_content = base64.b64decode(file_content)
            else:
                binary_content = file_content
            
            # Try PyPDF2 first (fastest)
            try:
                import PyPDF2
                import io
                
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(binary_content))
                text_content = ""
                for page in pdf_reader.pages:
                    text_content += page.extract_text() + "\n"
                
                if text_content.strip():
                    return text_content
            except Exception as e:
                logging.warning(f"PyPDF2 failed: {e}")
            
            # Fallback: return error message for AI to handle
            return "PDF_PROCESSING_FAILED - Document format issues detected"
            
        except Exception as e:
            logging.error(f"PDF processing error: {e}")
            return "PDF_PROCESSING_ERROR"
    
    def _parse_ai_response(self, response_text: str) -> Dict[str, Any]:
        """Parse and clean AI response"""
        if not response_text:
            logging.error("Empty response from Gemini")
            return {}
        
        logging.info(f"Raw AI response (first 500 chars): {response_text[:500]}")
        
        # Clean markdown formatting
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        elif response_text.startswith("```"):
            response_text = response_text.replace("```", "").strip()
        
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse AI response: {e}")
            logging.error(f"Response text: {response_text}")
            return {}

class ValidationEngine:
    """Simplified validation with AI-only approach"""
    
    def __init__(self, extractor: AIExtractor):
        self.extractor = extractor
    
    def validate_extracted_data(
        self, 
        extracted_data: Dict[str, Any], 
        schema: Dict[str, Any],
        extraction_rules: Optional[List[Dict]] = None,
        knowledge_docs: Optional[List[Dict]] = None
    ) -> List[ValidationResult]:
        """Validate all extracted data in one batch"""
        
        # Collect all fields to validate
        fields_to_validate = []
        
        # Schema fields
        for field in schema.get("schema_fields", []):
            field_name = field.get('fieldName', '')
            if field_name in extracted_data:
                fields_to_validate.append({
                    'field_id': str(field.get('id', '')),
                    'field_name': field_name,
                    'field_type': field.get('fieldType', 'TEXT'),
                    'extracted_value': extracted_data[field_name],
                    'collection_name': None,
                    'record_index': None
                })
        
        # Collection fields
        for collection in schema.get("collections", []):
            collection_name = collection.get('collectionName', '')
            collection_data = extracted_data.get(collection_name, [])
            
            if isinstance(collection_data, list):
                for record_index, record in enumerate(collection_data):
                    if isinstance(record, dict):
                        for prop in collection.get("properties", []):
                            prop_name = prop.get('propertyName', '')
                            if prop_name in record:
                                fields_to_validate.append({
                                    'field_id': str(prop.get('id', '')),
                                    'field_name': f"{collection_name}.{prop_name}[{record_index}]",
                                    'field_type': prop.get('propertyType', 'TEXT'),
                                    'extracted_value': record[prop_name],
                                    'collection_name': collection_name,
                                    'record_index': record_index
                                })
        
        # Run batch validation
        return self._batch_validate(fields_to_validate, extraction_rules, knowledge_docs)
    
    def _batch_validate(
        self, 
        fields: List[Dict], 
        extraction_rules: Optional[List[Dict]] = None,
        knowledge_docs: Optional[List[Dict]] = None
    ) -> List[ValidationResult]:
        """Run AI validation on all fields at once"""
        
        if not fields:
            return []
        
        # Build validation prompt
        prompt = """Validate these extracted field values using AI judgment only.

FIELDS TO VALIDATE:"""
        
        for field in fields:
            prompt += f"\n- {field['field_name']}: '{field['extracted_value']}'"
        
        # Add context
        if extraction_rules:
            prompt += "\n\nEXTRACTION RULES:"
            for rule in extraction_rules:
                if rule.get("isActive", True):
                    prompt += f"\n- {rule.get('ruleName', '')}: {rule.get('ruleContent', '')}"
        
        if knowledge_docs:
            prompt += "\n\nKNOWLEDGE DOCUMENTS:"
            for doc in knowledge_docs:
                content = doc.get('content', '')[:500]  # First 500 chars
                prompt += f"\n- {doc.get('displayName', '')}: {content}..."
        
        prompt += """

For each field, return confidence (0-100) and reasoning.
Return JSON format:
{
    "field_name_1": {
        "confidence": 95,
        "reasoning": "Clear extraction from document"
    }
}"""
        
        try:
            response = self.extractor.client.models.generate_content(
                model=self.extractor.model_name,
                contents=prompt
            )
            validation_data = self.extractor._parse_ai_response(response.text)
            
            # Convert to ValidationResult objects
            results = []
            for field in fields:
                field_name = field['field_name']
                field_validation = validation_data.get(field_name, {})
                
                confidence = field_validation.get('confidence', 0)
                reasoning = field_validation.get('reasoning', 'No validation data')
                
                # Determine status based on confidence
                if field['extracted_value'] is None or field['extracted_value'] == "":
                    status = "invalid"
                    confidence = 0
                elif confidence >= 80:
                    status = "verified"
                else:
                    status = "unverified"
                
                results.append(ValidationResult(
                    field_id=field['field_id'],
                    field_name=field_name,
                    field_type=field['field_type'],
                    extracted_value=field['extracted_value'],
                    confidence_score=confidence,
                    ai_reasoning=reasoning,
                    validation_status=status,
                    collection_name=field['collection_name'],
                    record_index=field['record_index']
                ))
            
            return results
            
        except Exception as e:
            logging.error(f"Batch validation failed: {e}")
            # Return default validations
            return [
                ValidationResult(
                    field_id=field['field_id'],
                    field_name=field['field_name'],
                    field_type=field['field_type'],
                    extracted_value=field['extracted_value'],
                    confidence_score=0,
                    ai_reasoning="Validation failed",
                    validation_status="unverified",
                    collection_name=field['collection_name'],
                    record_index=field['record_index']
                )
                for field in fields
            ]

class DocumentProcessor:
    """Main processor - coordinates extraction and validation"""
    
    def __init__(self, api_key: str):
        self.extractor = AIExtractor(api_key)
        self.validator = ValidationEngine(self.extractor)
    
    def process_session(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process entire session with simplified flow"""
        
        logging.info("Starting simplified document processing")
        
        files = session_data.get("files", [])
        logging.info(f"Processing session {session_data.get('session_id')} with {len(files)} files")
        schema = session_data.get("project_schema", {})
        extraction_rules = session_data.get("extraction_rules", [])
        knowledge_docs = session_data.get("knowledge_documents", [])
        
        # Step 1: Extract from all documents
        all_extractions = []
        for file_info in files:
            try:
                extracted_data = self.extractor.extract_from_document(
                    file_content=file_info.get("content", ""),
                    file_name=file_info.get("name", "unknown"),
                    mime_type=file_info.get("mimeType", "text/plain"),
                    schema=schema
                )
                
                all_extractions.append({
                    "file_name": file_info.get("name"),
                    "extracted_data": extracted_data,
                    "success": bool(extracted_data)
                })
                logging.info(f"Extracted data from {file_info.get('name')}")
                
            except Exception as e:
                logging.error(f"Failed to extract from {file_info.get('name')}: {e}")
                all_extractions.append({
                    "file_name": file_info.get("name"),
                    "extracted_data": {},
                    "success": False,
                    "error": str(e)
                })
        
        # Step 2: Aggregate all extractions
        aggregated_data = self._aggregate_extractions(all_extractions, schema)
        
        # Step 3: Validate aggregated data
        validation_results = self.validator.validate_extracted_data(
            extracted_data=aggregated_data,
            schema=schema,
            extraction_rules=extraction_rules,
            knowledge_docs=knowledge_docs
        )
        
        # Step 4: Return results
        return {
            "session_id": session_data.get("session_id"),
            "extracted_data": aggregated_data,
            "validations": [
                {
                    "field_id": v.field_id,
                    "field_name": v.field_name,
                    "field_type": v.field_type,
                    "extracted_value": v.extracted_value,
                    "confidence_score": v.confidence_score,
                    "ai_reasoning": v.ai_reasoning,
                    "validation_status": v.validation_status,
                    "collection_name": v.collection_name,
                    "record_index": v.record_index
                }
                for v in validation_results
            ],
            "processing_summary": {
                "total_files": len(files),
                "successful_extractions": len([e for e in all_extractions if e["success"]]),
                "total_validations": len(validation_results),
                "verified_fields": len([v for v in validation_results if v.validation_status == "verified"])
            }
        }
    
    def _aggregate_extractions(self, extractions: List[Dict], schema: Dict) -> Dict[str, Any]:
        """Simple aggregation strategy"""
        aggregated = {}
        collection_names = [c.get('collectionName') for c in schema.get('collections', [])]
        
        # For schema fields: use the last successful extraction (most complete)
        for extraction in reversed(extractions):
            if extraction["success"]:
                for field_name, value in extraction["extracted_data"].items():
                    if field_name not in collection_names and field_name not in aggregated:
                        if value is not None and value != "":
                            aggregated[field_name] = value
        
        # For collections: combine all items from all documents
        for collection_name in collection_names:
            combined_items = []
            for extraction in extractions:
                if extraction["success"]:
                    items = extraction["extracted_data"].get(collection_name, [])
                    if isinstance(items, list):
                        combined_items.extend(items)
            
            if combined_items:
                aggregated[collection_name] = combined_items
        
        return aggregated

# Main entry point
def main():
    """Simplified main function"""
    try:
        # Get input data
        if len(sys.argv) > 1:
            session_data = json.loads(sys.argv[1])
        else:
            session_data = json.loads(sys.stdin.read())
        
        # Check for API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY not found")
        
        # Process session
        processor = DocumentProcessor(api_key)
        results = processor.process_session(session_data)
        
        # Output results
        print(json.dumps(results, indent=2))
        
    except Exception as e:
        logging.error(f"Processing failed: {e}")
        import traceback
        logging.error(f"Full traceback: {traceback.format_exc()}")
        error_result = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc(),
            "extracted_data": {},
            "validations": []
        }
        print(json.dumps(error_result, indent=2))

# Legacy API compatibility function
def run_post_extraction_batch_validation(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Legacy function for API compatibility - delegates to new simplified processor"""
    try:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise Exception("GEMINI_API_KEY not found")
        
        processor = DocumentProcessor(api_key)
        
        # Get existing validations from session data
        existing_validations = session_data.get("existing_validations", [])
        
        # For post-extraction validation, we just need to re-validate existing data
        # Extract the data that was already processed
        extracted_data = {}
        for validation in existing_validations:
            field_name = validation.get("field_name", "")
            if "." in field_name and "[" in field_name:
                # Collection property - extract collection and property info
                parts = field_name.split(".")
                if len(parts) >= 2:
                    collection_name = parts[0]
                    prop_part = parts[1]
                    if "[" in prop_part:
                        prop_name = prop_part.split("[")[0]
                        
                        if collection_name not in extracted_data:
                            extracted_data[collection_name] = []
                        
                        # Ensure we have enough items in the collection
                        record_index = validation.get("record_index", 0)
                        while len(extracted_data[collection_name]) <= record_index:
                            extracted_data[collection_name].append({})
                        
                        extracted_data[collection_name][record_index][prop_name] = validation.get("extracted_value")
            else:
                # Schema field
                extracted_data[field_name] = validation.get("extracted_value")
        
        # Re-validate using the new validation engine
        validation_results = processor.validator.validate_extracted_data(
            extracted_data=extracted_data,
            schema=session_data.get("project_schema", {}),
            extraction_rules=session_data.get("extraction_rules", []),
            knowledge_docs=session_data.get("knowledge_documents", [])
        )
        
        # Convert results to legacy format expected by API
        updated_validations = []
        for existing in existing_validations:
            field_name = existing.get("field_name", "")
            
            # Find matching validation result
            matching_result = None
            for result in validation_results:
                if result.field_name == field_name:
                    matching_result = result
                    break
            
            if matching_result:
                # Update with new validation results
                updated_validation = existing.copy()
                updated_validation["confidence_score"] = matching_result.confidence_score
                updated_validation["ai_reasoning"] = matching_result.ai_reasoning
                updated_validation["validation_status"] = matching_result.validation_status
                updated_validations.append(updated_validation)
            else:
                # Keep original if no matching result found
                updated_validations.append(existing)
        
        return {
            "success": True,
            "updated_validations": updated_validations,
            "validation_summary": {
                "total_processed": len(updated_validations),
                "verified_count": len([v for v in updated_validations if v.get("validation_status") == "verified"]),
                "unverified_count": len([v for v in updated_validations if v.get("validation_status") == "unverified"])
            }
        }
        
    except Exception as e:
        logging.error(f"Post-extraction batch validation failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "updated_validations": session_data.get("existing_validations", [])
        }

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    main()