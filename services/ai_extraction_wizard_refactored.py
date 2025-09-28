"""
AI Extraction Wizard - Refactored with improved structure
Document Content Analysis via Google Gemini
"""

import os
import json
import sys
sys.path.append('..')  # Add parent directory to path

from google import genai
from typing import Dict, List, Any, Optional, Tuple
from prompts.all_prompts import AI_DOCUMENT_EXTRACTION
from utils.database import DatabaseConnection
from utils.logger import setup_logger, log_error, log_extraction_start, log_extraction_complete
from utils.constants import (
    MAX_CONTENT_LENGTH,
    DEFAULT_AI_MODEL,
    MAX_RETRIES,
    DEFAULT_CONFIDENCE_SCORE
)
from utils.config import get_api_key, get_ai_model

# Set up logger
logger = setup_logger(__name__)


class DocumentFetcher:
    """
    Handles fetching documents from the database
    """
    
    def __init__(self, db: DatabaseConnection):
        """
        Initialize document fetcher
        
        Parameters:
            db: Database connection instance
        """
        self.db = db
        self.logger = setup_logger(f"{__name__}.DocumentFetcher")
    
    def fetch_session_documents(self, document_ids: List[str], session_id: str) -> List[Dict[str, Any]]:
        """
        Fetch session documents by IDs
        
        Parameters:
            document_ids: List of document UUIDs
            session_id: Session UUID
            
        Returns:
            List of document dictionaries
        """
        query = """
            SELECT id, file_name, mime_type, extracted_content 
            FROM session_documents 
            WHERE id = ANY(%s::uuid[]) AND session_id = %s
        """
        
        results = self.db.fetch_all(query, (document_ids, session_id))
        
        documents = []
        for doc in results:
            content = doc.get('extracted_content', '')
            
            # For Excel files, don't truncate content to preserve all column data
            file_name = doc.get('file_name', '').lower()
            mime_type = doc.get('mime_type', '')
            is_excel = (mime_type in ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] or 
                       file_name.endswith(('.xlsx', '.xls')))
            
            # Only truncate non-Excel content if too long
            if not is_excel and len(content) > MAX_CONTENT_LENGTH:
                content = content[:MAX_CONTENT_LENGTH] + "..."
            
            documents.append({
                "id": str(doc['id']),
                "file_name": doc['file_name'],
                "mime_type": doc['mime_type'],
                "content": content
            })
        
        self.logger.info(f"Fetched {len(documents)} documents for session {session_id}")
        return documents


class RulesFetcher:
    """
    Handles fetching extraction rules and knowledge documents
    """
    
    def __init__(self, db: DatabaseConnection):
        """
        Initialize rules fetcher
        
        Parameters:
            db: Database connection instance
        """
        self.db = db
        self.logger = setup_logger(f"{__name__}.RulesFetcher")
    
    def fetch_extraction_rules(self, project_id: str) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch extraction rules for a project
        
        Parameters:
            project_id: Project UUID
            
        Returns:
            Dictionary with 'targeted' and 'global' rules
        """
        query = """
            SELECT rule_name, target_field, rule_content, is_active
            FROM extraction_rules 
            WHERE project_id = %s AND is_active = true
        """
        
        results = self.db.fetch_all(query, (project_id,))
        
        extraction_rules = {
            "targeted": [],
            "global": []
        }
        
        for rule in results:
            rule_obj = {
                "rule_name": rule['rule_name'],
                "target_field": rule.get('target_field', ''),
                "rule_content": rule['rule_content'],
                "is_active": rule['is_active']
            }
            
            if rule.get('target_field'):
                extraction_rules["targeted"].append(rule_obj)
            else:
                extraction_rules["global"].append(rule_obj)
        
        total_rules = len(extraction_rules['targeted']) + len(extraction_rules['global'])
        self.logger.info(f"Fetched {total_rules} extraction rules for project {project_id}")
        
        return extraction_rules
    
    def fetch_knowledge_documents(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Fetch knowledge documents for a project
        
        Parameters:
            project_id: Project UUID
            
        Returns:
            List of knowledge document dictionaries
        """
        query = """
            SELECT display_name, content, target_field
            FROM knowledge_documents
            WHERE project_id = %s
        """
        
        results = self.db.fetch_all(query, (project_id,))
        
        knowledge_documents = []
        for doc in results:
            content = doc.get('content', '')
            # Truncate content if too long
            if len(content) > 1000:
                content = content[:1000] + "..."
            
            knowledge_documents.append({
                "title": doc['display_name'],
                "content": content,
                "target_field": doc.get('target_field', '')
            })
        
        self.logger.info(f"Fetched {len(knowledge_documents)} knowledge documents for project {project_id}")
        return knowledge_documents


class AIExtractor:
    """
    Handles AI extraction using Gemini API
    """
    
    def __init__(self):
        """Initialize AI extractor with Gemini client"""
        self.logger = setup_logger(f"{__name__}.AIExtractor")
        api_key = get_api_key('gemini') or get_api_key('google')
        
        if not api_key:
            raise ValueError("No API key found for Gemini/Google AI")
        
        self.client = genai.Client(api_key=api_key)
        self.model = get_ai_model('extraction')
    
    def extract(self, 
                documents: List[Dict], 
                target_fields: List[Dict],
                extraction_rules: Dict[str, List],
                knowledge_documents: List[Dict],
                identifier_references: Optional[List] = None) -> Dict[str, Any]:
        """
        Perform AI extraction using Gemini
        
        Parameters:
            documents: List of document content
            target_fields: Fields to extract
            extraction_rules: Extraction rules
            knowledge_documents: Knowledge base documents
            identifier_references: Reference identifiers
            
        Returns:
            Extraction results dictionary
        """
        max_retries = MAX_RETRIES
        
        for attempt in range(max_retries):
            try:
                self.logger.info(f"AI extraction attempt {attempt + 1}/{max_retries}")
                
                # Format data for prompt
                prompt = self._build_prompt(
                    documents,
                    target_fields,
                    extraction_rules,
                    knowledge_documents,
                    identifier_references
                )
                
                # Call Gemini API
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=prompt
                )
                
                # Parse response
                result = self._parse_response(response)
                
                if result:
                    self.logger.info("AI extraction completed successfully")
                    return result
                    
            except Exception as e:
                self.logger.warning(f"AI extraction attempt {attempt + 1} failed: {e}")
                
                if attempt == max_retries - 1:
                    log_error(self.logger, e, "Final AI extraction attempt failed")
                    raise
        
        return {"error": "Failed to extract after all retries"}
    
    def _build_prompt(self, documents, target_fields, extraction_rules, 
                     knowledge_documents, identifier_references):
        """Build the extraction prompt"""
        return AI_DOCUMENT_EXTRACTION.format(
            documents=json.dumps(documents, indent=2),
            target_fields=json.dumps(target_fields, indent=2),
            extraction_rules=json.dumps(extraction_rules, indent=2),
            knowledge_documents=json.dumps(knowledge_documents, indent=2),
            identifier_references=json.dumps(identifier_references or [], indent=2),
            extraction_number=0
        )
    
    def _parse_response(self, response) -> Optional[Dict]:
        """Parse AI response"""
        try:
            response_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            # Parse JSON
            result = json.loads(response_text.strip())
            
            # Validate response structure
            if not isinstance(result, dict):
                self.logger.error(f"Invalid response structure: expected dict, got {type(result)}")
                return None
            
            if 'extraction_results' not in result:
                self.logger.error("Missing 'extraction_results' in response")
                return None
            
            return result
            
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse AI response as JSON: {e}")
            return None
        except Exception as e:
            log_error(self.logger, e, "Unexpected error parsing AI response")
            return None


def get_project_id_from_session(session_id: str, db: DatabaseConnection) -> Optional[str]:
    """
    Get project ID from session
    
    Parameters:
        session_id: Session UUID
        db: Database connection
        
    Returns:
        Project ID or None
    """
    query = "SELECT project_id FROM extraction_sessions WHERE id = %s"
    result = db.fetch_one(query, (session_id,))
    return result['project_id'] if result else None


def ai_document_extraction(document_ids: List[str], 
                          session_id: str, 
                          target_fields_data: List[Dict],
                          identifier_references: Optional[List] = None) -> Dict[str, Any]:
    """
    Main entry point for AI document extraction
    
    Parameters:
        document_ids: List of document UUIDs
        session_id: Session UUID
        target_fields_data: Fields to extract
        identifier_references: Reference identifiers
        
    Returns:
        Extraction results or error dictionary
    """
    logger.info(f"Starting AI extraction for session {session_id}")
    log_extraction_start(logger, "AI Document", 
                        document_count=len(document_ids), 
                        field_count=len(target_fields_data))
    
    try:
        # Initialize database connection
        db = DatabaseConnection()
        
        # Get project ID
        project_id = get_project_id_from_session(session_id, db)
        if not project_id:
            logger.error(f"Session {session_id} not found")
            return {"error": "Session not found"}
        
        # Initialize fetchers
        doc_fetcher = DocumentFetcher(db)
        rules_fetcher = RulesFetcher(db)
        
        # Fetch required data
        documents = doc_fetcher.fetch_session_documents(document_ids, session_id)
        extraction_rules = rules_fetcher.fetch_extraction_rules(project_id)
        knowledge_documents = rules_fetcher.fetch_knowledge_documents(project_id)
        
        # Perform AI extraction
        ai_extractor = AIExtractor()
        result = ai_extractor.extract(
            documents,
            target_fields_data,
            extraction_rules,
            knowledge_documents,
            identifier_references
        )
        
        # Log completion
        if 'error' not in result:
            success_count = len(result.get('extraction_results', []))
            log_extraction_complete(logger, "AI Document", success_count)
        
        return result
        
    except Exception as e:
        log_error(logger, e, "AI document extraction failed")
        return {"error": str(e)}


# Entry point for backward compatibility
if __name__ == "__main__":
    # This maintains compatibility with existing server calls
    import sys
    
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Insufficient arguments"}))
        sys.exit(1)
    
    try:
        input_data = json.loads(sys.stdin.read())
        result = ai_document_extraction(
            input_data.get('document_ids', []),
            input_data.get('session_id'),
            input_data.get('target_fields_data', []),
            input_data.get('identifier_references')
        )
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)