import os
import json
import psycopg2
from google import genai
from all_prompts import DOCUMENT_FORMAT_ANALYSIS
from excel_wizard import excel_column_extraction
from ai_extraction_wizard import ai_document_extraction

def ai_conductor(document_ids, session_id, target_fields_data):
    """Orchestrate multiple extraction steps based on AI analysis"""
    try:
        print("\n" + "=" * 80)
        print("AI CONDUCTOR: ANALYZING EXTRACTION REQUIREMENTS")
        print("=" * 80)
        
        # Get documents from database for analysis
        documents = get_documents_for_analysis(document_ids, session_id)
        if not documents:
            return {"error": "No documents found for analysis"}
        
        print(f"Documents loaded: {len(documents)}")
        print(f"Target fields: {len(target_fields_data)}")
        
        # Analyze documents and get extraction sequence
        extraction_plan = analyze_extraction_requirements(documents, target_fields_data)
        if 'error' in extraction_plan:
            return extraction_plan
        
        # Execute the extraction sequence
        final_results = execute_extraction_sequence(extraction_plan, document_ids, session_id, target_fields_data)
        
        return final_results
        
    except Exception as e:
        print(f"Error in AI conductor: {e}")
        return {"error": str(e)}

def get_documents_for_analysis(document_ids, session_id):
    """Get document metadata for analysis"""
    try:
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            return None
        
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        documents_query = """
        SELECT id, file_name, mime_type, extracted_content 
        FROM session_documents 
        WHERE id = ANY(%s::uuid[]) AND session_id = %s
        """
        cursor.execute(documents_query, (document_ids, session_id))
        results = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        documents = []
        for doc_id, file_name, mime_type, content in results:
            documents.append({
                "id": str(doc_id),
                "file_name": file_name,
                "mime_type": mime_type,
                "content": content[:500] + "..." if len(content) > 500 else content  # Truncate for analysis
            })
        
        return documents
        
    except Exception as e:
        print(f"Error getting documents for analysis: {e}")
        return None

def analyze_extraction_requirements(documents, target_fields_data):
    """Use Gemini to analyze documents and create extraction plan"""
    try:
        print("\n" + "=" * 80)
        print("AI CONDUCTOR: CREATING EXTRACTION PLAN")
        print("=" * 80)
        
        # Initialize Gemini client
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))
        
        # Format data for prompt
        documents_json = json.dumps(documents, indent=2)
        target_fields_json = json.dumps(target_fields_data, indent=2)
        
        # Generate extraction plan using Gemini
        prompt = DOCUMENT_FORMAT_ANALYSIS.format(
            documents=documents_json,
            target_fields=target_fields_json
        )
        
        # Log the analysis prompt
        print("ANALYSIS PROMPT:")
        print(prompt[:800] + "..." if len(prompt) > 800 else prompt)
        print("=" * 80)
        
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=prompt
        )
        
        analysis_result = response.text
        
        print("\nAI CONDUCTOR ANALYSIS:")
        print("=" * 80)
        print(analysis_result)
        print("=" * 80)
        
        # Parse the analysis result
        extraction_plan = parse_extraction_plan(analysis_result)
        
        return extraction_plan
        
    except Exception as e:
        print(f"Error in extraction requirements analysis: {e}")
        return {"error": str(e)}

def parse_extraction_plan(analysis_result):
    """Parse the Gemini analysis into executable steps"""
    try:
        lines = analysis_result.strip().split('\n')
        document_format = None
        extraction_steps = []
        
        for line in lines:
            line = line.strip()
            if line.startswith('DOCUMENT_FORMAT:'):
                document_format = line.split(':', 1)[1].strip()
            elif line.startswith(('1.', '2.', '3.')):
                # Parse step: "1. Excel Extraction: Description"
                parts = line.split(':', 1)
                if len(parts) == 2:
                    step_info = parts[0].strip()  # "1. Excel Extraction"
                    description = parts[1].strip()  # "Description"
                    
                    # Extract method from step_info
                    method_part = step_info.split('.', 1)[1].strip()  # "Excel Extraction"
                    
                    extraction_steps.append({
                        "method": method_part,
                        "description": description
                    })
        
        return {
            "document_format": document_format,
            "extraction_steps": extraction_steps
        }
        
    except Exception as e:
        print(f"Error parsing extraction plan: {e}")
        return {"error": f"Failed to parse extraction plan: {e}"}

def execute_extraction_sequence(extraction_plan, document_ids, session_id, target_fields_data):
    """Execute the planned extraction sequence"""
    try:
        print("\n" + "=" * 80)
        print("AI CONDUCTOR: EXECUTING EXTRACTION SEQUENCE")
        print("=" * 80)
        
        document_format = extraction_plan.get('document_format', 'Unknown')
        steps = extraction_plan.get('extraction_steps', [])
        
        print(f"Document Format: {document_format}")
        print(f"Extraction Steps: {len(steps)}")
        
        current_data = None
        all_results = []
        
        for i, step in enumerate(steps, 1):
            method = step.get('method', '')
            description = step.get('description', '')
            
            print(f"\nStep {i}: {method}")
            print(f"Description: {description}")
            print("-" * 80)
            
            if "Excel Extraction" in method:
                print("EXECUTING: Excel Column Extraction")
                step_results = excel_column_extraction(document_ids, session_id, target_fields_data)
                
            elif "AI Extraction" in method:
                print("EXECUTING: AI Document Extraction")
                step_results = ai_document_extraction(document_ids, session_id, target_fields_data)
                
            else:
                print(f"UNKNOWN METHOD: {method}")
                continue
            
            # Handle step results
            if isinstance(step_results, dict) and 'error' in step_results:
                print(f"Step {i} failed: {step_results['error']}")
                continue
            elif isinstance(step_results, list):
                print(f"Step {i} completed: {len(step_results)} results")
                all_results.extend(step_results)
            else:
                print(f"Step {i} returned unexpected format: {type(step_results)}")
        
        print("\n" + "=" * 80)
        print("AI CONDUCTOR: SEQUENCE COMPLETED")
        print("=" * 80)
        print(f"Total results: {len(all_results)}")
        
        return all_results
        
    except Exception as e:
        print(f"Error executing extraction sequence: {e}")
        return {"error": str(e)}