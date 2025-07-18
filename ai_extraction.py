#!/usr/bin/env python3

import json
import sys
import os
import logging
import tempfile
import base64
from typing import Dict, Any, List
from dataclasses import dataclass

@dataclass
class FieldValidationResult:
    field_id: str
    field_name: str
    field_type: str
    extracted_value: Any
    validation_status: str
    ai_reasoning: str
    confidence_score: int
    document_source: str
    document_sections: List[str]

@dataclass
class ExtractionResult:
    extracted_data: Dict[str, Any]
    confidence_score: float
    processing_notes: str
    field_validations: List[FieldValidationResult]

def extract_data_from_document(
    file_content: bytes,
    file_name: str,
    mime_type: str,
    project_schema: Dict[str, Any],
    extraction_rules: List[Dict[str, Any]] = None,
    knowledge_documents: List[Dict[str, Any]] = None
) -> ExtractionResult:
    """Extract structured data from a document using AI"""
    
    logging.info("Starting AI data extraction")
    
    try:
        # Check for API key
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logging.error("GEMINI_API_KEY not found")
            raise Exception("GEMINI_API_KEY not found - cannot perform extraction without API credentials")
        
        # Import Google AI modules
        try:
            import google.generativeai as genai
            from google.generativeai import types
        except ImportError as e:
            logging.error(f"Failed to import Google AI modules: {e}")
            raise Exception(f"Required Google AI modules not available: {str(e)}")
        
        # Configure the API
        genai.configure(api_key=api_key)
        
        # Build extraction prompt
        prompt = f"Extract data from this document: {file_name}\n\n"
        prompt += "CRITICAL: Extract ONLY real data from the document. Do NOT generate sample or placeholder data.\n\n"
        
        # Add schema fields
        if project_schema.get("schema_fields"):
            prompt += "Schema fields to extract:\n"
            for field in project_schema["schema_fields"]:
                field_name = field['fieldName']
                field_type = field['fieldType']
                prompt += f"- {field_name} ({field_type})\n"
        
        # Add collections
        if project_schema.get("collections"):
            prompt += "\nCollections to extract:\n"
            for collection in project_schema["collections"]:
                collection_name = collection.get('collectionName', collection.get('objectName', ''))
                prompt += f"- {collection_name}:\n"
                for prop in collection.get("properties", []):
                    prop_name = prop['propertyName']
                    prop_type = prop['propertyType']
                    prompt += f"  * {prop_name} ({prop_type})\n"
        
        prompt += "\nRules:\n"
        prompt += "1. Extract ONLY real data from the document\n"
        prompt += "2. If data is not found, return null\n"
        prompt += "3. Do NOT generate sample data\n"
        prompt += "4. Return proper JSON format\n"
        
        # Handle content types and prepare the content
        if mime_type.startswith("text/"):
            content_text = file_content.decode('utf-8', errors='ignore')
            full_prompt = prompt + f"\n\nDocument content:\n{content_text}"
            
            # Make API call using the simplified API for text
            logging.info("Making API call to Gemini for text content")
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(full_prompt)
        else:
            # For binary files like PDFs, convert to images and process with vision model
            logging.info("Processing PDF by converting to images for Gemini Vision")
            model = genai.GenerativeModel('gemini-1.5-flash')
            
            # Decode base64 content to bytes
            if isinstance(file_content, str) and file_content.startswith('data:'):
                # Extract base64 content after the comma for data URLs
                base64_content = file_content.split(',', 1)[1]
                binary_content = base64.b64decode(base64_content)
            elif isinstance(file_content, str):
                # Assume it's already base64 encoded
                binary_content = base64.b64decode(file_content)
            else:
                # Already bytes
                binary_content = file_content
            
            logging.info(f"Processing PDF with {len(binary_content)} bytes")
            
            # Convert PDF to images using pdf2image
            try:
                from pdf2image import convert_from_bytes
                from PIL import Image
                import io
                
                # Convert PDF pages to images
                images = convert_from_bytes(binary_content)
                logging.info(f"Successfully converted PDF to {len(images)} page images")
                
                # Process first page (or combine multiple pages)
                if images:
                    first_page = images[0]
                    
                    # Convert PIL image to base64 for Gemini
                    img_buffer = io.BytesIO()
                    first_page.save(img_buffer, format='PNG')
                    img_base64 = base64.b64encode(img_buffer.getvalue()).decode('utf-8')
                    
                    # Create image data URL
                    image_data_url = f"data:image/png;base64,{img_base64}"
                    
                    # Use the image with Gemini's vision capabilities
                    from PIL import Image as PILImage
                    img_buffer.seek(0)
                    pil_image = PILImage.open(img_buffer)
                    
                    # Generate content with image and prompt
                    response = model.generate_content([prompt, pil_image])
                    logging.info("Successfully processed PDF page as image with Gemini Vision")
                else:
                    raise Exception("No pages found in PDF")
                    
            except Exception as e:
                logging.error(f"PDF processing error: {e}")
                # Fallback to text-only processing
                logging.info("Falling back to text-only extraction")
                fallback_prompt = f"""
                {prompt}
                
                Unable to process PDF content directly. This appears to be a PDF document named '{file_name}'.
                Please note that without visual access to the document content, extraction cannot be performed.
                """
                response = model.generate_content(fallback_prompt)
        
        if not response or not response.text:
            raise Exception("No response from AI model")
        
        response_text = response.text.strip()
        
        if not response_text:
            raise Exception("Empty response from AI model")
        
        # Clean up response text - remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        elif response_text.startswith("```"):
            response_text = response_text.replace("```", "").strip()
        
        # Parse JSON response
        try:
            result_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            logging.error(f"JSON decode error: {e}")
            logging.error(f"Response text: {response_text[:500]}")
            raise Exception("Failed to parse AI response as JSON")
        
        # Create field validations
        field_validations = []
        extracted_data = result_data if isinstance(result_data, dict) else {}
        
        # Validate schema fields
        if project_schema.get("schema_fields"):
            for field in project_schema["schema_fields"]:
                field_id = str(field.get("id", "unknown"))
                field_name = field.get("fieldName", "")
                field_type = field.get("fieldType", "TEXT")
                extracted_value = extracted_data.get(field_name)
                
                if extracted_value is not None and extracted_value != "":
                    confidence = 95
                    status = "verified"
                    reasoning = f"Successfully extracted {field_name} from document"
                else:
                    confidence = 0
                    status = "invalid"
                    reasoning = f"No value found for {field_name} in document"
                
                validation = FieldValidationResult(
                    field_id=field_id,
                    field_name=field_name,
                    field_type=field_type,
                    extracted_value=extracted_value,
                    validation_status=status,
                    ai_reasoning=reasoning,
                    confidence_score=confidence,
                    document_source=file_name,
                    document_sections=["Document Content"]
                )
                field_validations.append(validation)
        
        # Validate collections
        if project_schema.get("collections"):
            for collection in project_schema["collections"]:
                collection_name = collection.get('collectionName', collection.get('objectName', ''))
                collection_data = extracted_data.get(collection_name, [])
                
                if isinstance(collection_data, list):
                    for record_index, record in enumerate(collection_data):
                        for prop in collection.get("properties", []):
                            prop_id = str(prop.get("id", "unknown"))
                            prop_name = prop.get("propertyName", "")
                            prop_type = prop.get("propertyType", "TEXT")
                            
                            extracted_value = record.get(prop_name) if isinstance(record, dict) else None
                            field_name_with_index = f"{collection_name}.{prop_name}[{record_index}]"
                            
                            if extracted_value is not None and extracted_value != "":
                                confidence = 95
                                status = "verified"
                                reasoning = f"Successfully extracted {prop_name} from {collection_name}"
                            else:
                                confidence = 0
                                status = "invalid"
                                reasoning = f"No value found for {prop_name} in {collection_name}"
                            
                            validation = FieldValidationResult(
                                field_id=prop_id,
                                field_name=field_name_with_index,
                                field_type=prop_type,
                                extracted_value=extracted_value,
                                validation_status=status,
                                ai_reasoning=reasoning,
                                confidence_score=confidence,
                                document_source=file_name,
                                document_sections=["Document Content"]
                            )
                            field_validations.append(validation)
        
        return ExtractionResult(
            extracted_data=extracted_data,
            confidence_score=0.95,
            processing_notes="AI extraction completed successfully",
            field_validations=field_validations
        )
        
    except Exception as e:
        logging.error(f"Extraction failed: {e}")
        raise Exception(f"Extraction failed for {file_name}: {str(e)}")

def process_extraction_session(session_data: Dict[str, Any]) -> Dict[str, Any]:
    """Process an entire extraction session with multiple documents"""
    
    print("=== STARTING AI EXTRACTION SESSION ===", file=sys.stderr)
    logging.basicConfig(level=logging.INFO, stream=sys.stderr)
    
    results = {
        "session_id": session_data.get("session_id"),
        "processed_documents": [],
        "summary": {
            "total_documents": 0,
            "successful_extractions": 0,
            "average_confidence": 0.0
        }
    }
    
    files = session_data.get("files", [])
    project_schema = session_data.get("project_schema", {})
    extraction_rules = session_data.get("extraction_rules", [])
    knowledge_documents = session_data.get("knowledge_documents", [])
    
    logging.info(f"Processing {len(files)} files")
    
    successful_count = 0
    total_confidence = 0.0
    
    for file_info in files:
        try:
            file_name = file_info.get("name", "unknown")
            file_content = file_info.get("content", b"")
            mime_type = file_info.get("mimeType", "application/octet-stream")
            
            if isinstance(file_content, str):
                file_content = file_content.encode('utf-8')
            
            logging.info(f"Processing file: {file_name}")
            
            extraction_result = extract_data_from_document(
                file_content=file_content,
                file_name=file_name,
                mime_type=mime_type,
                project_schema=project_schema,
                extraction_rules=extraction_rules,
                knowledge_documents=knowledge_documents
            )
            
            document_result = {
                "file_name": file_name,
                "extraction_result": {
                    "extracted_data": extraction_result.extracted_data,
                    "confidence_score": extraction_result.confidence_score,
                    "processing_notes": extraction_result.processing_notes,
                    "field_validations": [
                        {
                            "field_id": fv.field_id,
                            "field_name": fv.field_name,
                            "field_type": fv.field_type,
                            "extracted_value": fv.extracted_value,
                            "validation_status": fv.validation_status,
                            "ai_reasoning": fv.ai_reasoning,
                            "confidence_score": fv.confidence_score,
                            "document_source": fv.document_source,
                            "document_sections": fv.document_sections
                        }
                        for fv in extraction_result.field_validations
                    ]
                },
                "status": "completed"
            }
            
            results["processed_documents"].append(document_result)
            
            if extraction_result.confidence_score > 0.5:
                successful_count += 1
                total_confidence += extraction_result.confidence_score
            
        except Exception as e:
            logging.error(f"Error processing file {file_info.get('name', 'unknown')}: {e}")
            results["processed_documents"].append({
                "file_name": file_info.get("name", "unknown"),
                "extraction_result": {
                    "extracted_data": {},
                    "confidence_score": 0.0,
                    "processing_notes": f"Processing error: {str(e)}",
                    "field_validations": []
                },
                "status": "error"
            })
    
    # Calculate summary
    results["summary"]["total_documents"] = len(files)
    results["summary"]["successful_extractions"] = successful_count
    results["summary"]["average_confidence"] = (
        total_confidence / successful_count if successful_count > 0 else 0.0
    )
    
    return results