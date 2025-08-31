"""
AI Extraction Wizard - Document Content Analysis via Google Gemini

Provides AI-powered document analysis and data extraction using Google Gemini API.
Handles intelligent extraction from various document types with context-aware prompts
and knowledge base integration.

Key Features:
- Google Gemini API integration for document analysis
- Context-aware prompts with extraction rules and knowledge base
- Support for multiple document types (PDF, DOCX, Excel)
- Intelligent data extraction with reasoning and confidence scoring
- Integration with project-specific extraction rules
- Knowledge document context for improved accuracy

Architecture:
- Connects to PostgreSQL for document and rule retrieval
- Uses structured prompts for consistent AI responses
- Handles identifier reference context for multi-step extractions
- Returns standardized JSON with extracted values and metadata

Usage:
- Called by extraction_wizardry.py for AI-based extractions
- Processes documents through Gemini API with contextual information
- Returns structured results with validation status and reasoning
"""

import os
import psycopg2
import json
from google import genai
from all_prompts import AI_DOCUMENT_EXTRACTION

def ai_document_extraction(document_ids, session_id, target_fields_data, identifier_references=None):
    """Extract data from documents using AI analysis based on field descriptions"""
    try:
        # Get database connection from environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return {"error": "DATABASE_URL not found"}
        
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Get project ID from extraction_sessions
        session_query = "SELECT project_id FROM extraction_sessions WHERE id = %s"
        cursor.execute(session_query, (session_id,))
        session_result = cursor.fetchone()
        if not session_result:
            return {"error": "Session not found"}
        
        project_id = session_result[0]
        
        # Get extraction rules for the project
        rules_query = """
        SELECT rule_name, target_field, rule_content, is_active
        FROM extraction_rules 
        WHERE project_id = %s AND is_active = true
        """
        cursor.execute(rules_query, (project_id,))
        rules_results = cursor.fetchall()
        
        # Get knowledge documents for the project (fix column names)
        knowledge_query = """
        SELECT display_name, content, target_field
        FROM knowledge_documents
        WHERE project_id = %s
        """
        cursor.execute(knowledge_query, (project_id,))
        knowledge_results = cursor.fetchall()
        
        # Query session_documents for the given document IDs
        documents_query = """
        SELECT id, file_name, mime_type, extracted_content 
        FROM session_documents 
        WHERE id = ANY(%s::uuid[]) AND session_id = %s
        """
        cursor.execute(documents_query, (document_ids, session_id))
        documents_results = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Format documents for prompt
        documents_content = []
        for doc_id, file_name, mime_type, extracted_content in documents_results:
            documents_content.append({
                "id": str(doc_id),
                "file_name": file_name,
                "mime_type": mime_type,
                "content": extracted_content[:2000] + "..." if len(extracted_content) > 2000 else extracted_content
            })
        
        # Format extraction rules
        extraction_rules = {
            "targeted": [],
            "global": []
        }
        
        for rule_name, target_field, rule_content, is_active in rules_results:
            rule_obj = {
                "rule_name": rule_name,
                "target_field": target_field or "",
                "rule_content": rule_content,
                "is_active": is_active
            }
            
            if target_field:
                extraction_rules["targeted"].append(rule_obj)
            else:
                extraction_rules["global"].append(rule_obj)
        
        # Format knowledge documents (fix column names)
        knowledge_documents = []
        for title, content, target_field in knowledge_results:
            knowledge_documents.append({
                "title": title,
                "content": content[:1000] + "..." if len(content) > 1000 else content,
                "target_field": target_field or ""
            })
        
        # Generate AI extraction using Gemini
        return perform_ai_extraction(documents_content, target_fields_data, extraction_rules, knowledge_documents, identifier_references)
        
    except Exception as e:
        print(f"Error in ai_document_extraction: {e}")
        return {"error": str(e)}

def perform_ai_extraction(documents, target_fields_data, extraction_rules, knowledge_documents, identifier_references=None):
    """Use Gemini AI to extract data from documents"""
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            # Initialize Gemini client
            client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
            
            # Format data for prompt
            documents_json = json.dumps(documents, indent=2)
            target_fields_json = json.dumps(target_fields_data, indent=2)
            extraction_rules_json = json.dumps(extraction_rules, indent=2)
            knowledge_documents_json = json.dumps(knowledge_documents, indent=2)
            identifier_references_json = json.dumps(identifier_references or [], indent=2)
            
            # Generate the extraction using Gemini
            prompt = AI_DOCUMENT_EXTRACTION.format(
                documents=documents_json,
                target_fields=target_fields_json,
                extraction_rules=extraction_rules_json,
                knowledge_documents=knowledge_documents_json,
                identifier_references=identifier_references_json,
                extraction_number=0  # Default extraction number for AI extraction
            )
            
            print("\n" + "=" * 80, flush=True)
            print(f"PERFORMING AI DOCUMENT EXTRACTION (Attempt {attempt + 1}/{max_retries})", flush=True)
            print("=" * 80, flush=True)
            print(f"Documents: {len(documents)}", flush=True)
            print(f"Target fields: {len(target_fields_data)}", flush=True)
            print(f"Extraction rules: {len(extraction_rules['global']) + len(extraction_rules['targeted'])}", flush=True)
            print(f"Knowledge documents: {len(knowledge_documents)}", flush=True)
            
            # Log the complete AI extraction prompt
            print("\n" + "=" * 80, flush=True)
            print("AI EXTRACTION PROMPT (COMPLETE)", flush=True)
            print("=" * 80, flush=True)
            print(prompt, flush=True)
            print("=" * 80, flush=True)
            
            response = client.models.generate_content(
                model="gemini-2.5-pro",
                contents=prompt
            )
            
            extracted_data = response.text
            
            # Clean and validate the response
            if extracted_data:
                extracted_data = extracted_data.strip()
                # Remove markdown formatting if present
                if extracted_data.startswith('```json'):
                    extracted_data = extracted_data.replace('```json', '').strip()
                if extracted_data.startswith('```'):
                    extracted_data = extracted_data.replace('```', '').strip()
                if extracted_data.endswith('```'):
                    extracted_data = extracted_data.replace('```', '').strip()
            
            # Parse JSON response
            try:
                extraction_results = json.loads(extracted_data)
                if isinstance(extraction_results, list):
                    print(f"Successfully extracted {len(extraction_results)} records", flush=True)
                    print("AI EXTRACTION RESPONSE:", flush=True)
                    print(json.dumps(extraction_results[:2], indent=2), flush=True)  # Show first 2 records
                    print("=" * 80, flush=True)
                    return extraction_results
                else:
                    print(f"Invalid response format (attempt {attempt + 1}): Expected array, got {type(extraction_results)}", flush=True)
                    if attempt < max_retries - 1:
                        continue
                    else:
                        return {"error": "Invalid response format after all retries"}
                        
            except json.JSONDecodeError as json_error:
                print(f"JSON parsing error (attempt {attempt + 1}): {json_error}")
                print(f"Raw response: {extracted_data[:200]}...")
                if attempt < max_retries - 1:
                    continue
                else:
                    return {"error": f"JSON parsing failed: {json_error}"}
                    
        except Exception as e:
            print(f"Error in AI extraction (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                continue
            else:
                return {"error": f"AI extraction failed: {e}"}
    
    return {"error": "AI extraction failed after all retries"}