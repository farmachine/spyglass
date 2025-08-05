#!/usr/bin/env python3
"""
Enhanced Batch Validation System with Incremental JSON Building

This system implements sophisticated batch processing that handles large datasets
by breaking them into manageable chunks and using explicit bookmarking to track progress.
"""

import json
import logging
import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from ai_extraction_simplified import step1_extract_from_documents, repair_truncated_json
try:
    import google.generativeai as genai
except ImportError:
    genai = None
import os

# Configure logging
logging.basicConfig(level=logging.INFO)

@dataclass
class BatchProgress:
    """Track batch processing progress with explicit bookmarking"""
    session_id: str
    current_batch: int
    total_batches: int
    processed_validations: int
    last_processed_field_id: Optional[str] = None
    last_processed_collection: Optional[str] = None
    last_processed_record_index: int = 0
    completion_percentage: float = 0.0
    processing_status: str = "in_progress"
    next_start_marker: Optional[str] = None
    batch_results: Optional[List[Dict]] = None
    
    def __post_init__(self):
        if self.batch_results is None:
            self.batch_results = []

@dataclass
class BatchResult:
    """Result of a batch processing operation"""
    success: bool
    batch_progress: Optional[BatchProgress] = None
    field_validations: Optional[List[Dict]] = None
    error_message: Optional[str] = None
    needs_continuation: bool = False
    continuation_marker: Optional[str] = None
    input_token_count: int = 0
    output_token_count: int = 0
    
    def __post_init__(self):
        if self.field_validations is None:
            self.field_validations = []

def analyze_dataset_complexity(documents: List[Dict], schema_fields: List[Dict], collections: List[Dict]) -> Dict:
    """
    Analyze the complexity of the dataset to determine optimal batch processing strategy.
    
    Returns:
        Dict with analysis results and batch recommendations
    """
    try:
        # Calculate document complexity
        total_content_length = sum(len(str(doc.get('file_content', ''))) for doc in documents)
        document_count = len(documents)
        
        # Calculate schema complexity
        total_fields = len(schema_fields)
        collection_count = len(collections)
        collection_properties = sum(len(col.get('properties', [])) for col in collections)
        total_extraction_points = total_fields + collection_properties
        
        # Estimate potential validations based on content patterns
        estimated_validations = total_extraction_points * document_count
        
        # Complex document patterns that might create many validations
        complexity_multiplier = 1.0
        for doc in documents:
            content = str(doc.get('file_content', ''))
            # Look for patterns that suggest tabular or repetitive data
            if content.count('\n') > 100:  # Many lines
                complexity_multiplier += 0.5
            if re.search(r'\btable\b|\brow\b|\bcolumn\b', content.lower()):
                complexity_multiplier += 0.3
            if re.search(r'\d+\.\s|\d+\)\s|^\s*-\s*', content, re.MULTILINE):  # Lists
                complexity_multiplier += 0.4
        
        estimated_validations = int(estimated_validations * complexity_multiplier)
        
        # Determine batch strategy
        if estimated_validations < 50:
            batch_strategy = "single_batch"
            recommended_batches = 1
        elif estimated_validations < 200:
            batch_strategy = "small_batches"
            recommended_batches = 3
        elif estimated_validations < 500:
            batch_strategy = "medium_batches"
            recommended_batches = 5
        else:
            batch_strategy = "large_batches"
            recommended_batches = min(10, max(5, estimated_validations // 100))
        
        analysis = {
            'total_content_length': total_content_length,
            'document_count': document_count,
            'total_fields': total_fields,
            'collection_count': collection_count,
            'collection_properties': collection_properties,
            'total_extraction_points': total_extraction_points,
            'estimated_validations': estimated_validations,
            'complexity_multiplier': complexity_multiplier,
            'batch_strategy': batch_strategy,
            'recommended_batches': recommended_batches
        }
        
        logging.info(f"📊 Dataset Analysis: {estimated_validations} estimated validations, strategy: {batch_strategy}")
        return analysis
        
    except Exception as e:
        logging.error(f"❌ Error analyzing dataset complexity: {e}")
        return {
            'estimated_validations': 100,
            'batch_strategy': 'medium_batches',
            'recommended_batches': 3
        }

def create_incremental_prompt(
    documents: List[Dict],
    schema_fields: List[Dict],
    collections: List[Dict],
    knowledge_base: List[Dict],
    extraction_rules: List[Dict],
    previous_results: Optional[Dict] = None,
    batch_progress: Optional[BatchProgress] = None
) -> str:
    """
    Create an incremental extraction prompt with explicit continuation instructions.
    """
    
    base_prompt = f"""
ENHANCED BATCH EXTRACTION WITH INCREMENTAL JSON BUILDING

You are processing documents in batches to handle large datasets efficiently.
Extract data from the provided documents and validate against the schema.

SCHEMA FIELDS: {json.dumps(schema_fields, indent=2)}

COLLECTIONS: {json.dumps(collections, indent=2)}

KNOWLEDGE BASE: {json.dumps(knowledge_base, indent=2)}

EXTRACTION RULES: {json.dumps(extraction_rules, indent=2)}

CRITICAL REQUIREMENTS:
1. Use EXACT field_id values from schema (UUID format)
2. Include collection_name for collection properties
3. Extract ALL relevant data - do not sample or limit
4. If truncated, return processing status with clear markers

REQUIRED OUTPUT FORMAT:
{{
  "field_validations": [
    // Array of validation objects
  ],
  "processing_status": {{
    "completion_status": "complete|truncated|partial", 
    "last_processed_field_id": "uuid-of-last-field",
    "last_processed_collection": "collection-name",
    "last_processed_record_index": 0,
    "next_start_marker": "Clear description of where to continue",
    "processed_count": 123,
    "estimated_remaining": 45
  }}
}}
"""

    # Add continuation instructions if this is a batch continuation
    if previous_results and batch_progress:
        continuation_section = f"""
BATCH CONTINUATION INSTRUCTIONS:
This is batch {batch_progress.current_batch} of {batch_progress.total_batches}.

PREVIOUS BATCH RESULTS SUMMARY:
- Processed validations: {batch_progress.processed_validations}
- Last processed field: {batch_progress.last_processed_field_id}
- Last collection: {batch_progress.last_processed_collection}
- Last record index: {batch_progress.last_processed_record_index}

CONTINUATION POINT: {batch_progress.next_start_marker}

CRITICAL: Start extraction from the continuation point above. 
DO NOT re-extract data that was already processed in previous batches.
Continue seamlessly from where the previous batch left off.

PREVIOUS RESULTS TO BUILD UPON:
{json.dumps(previous_results, indent=2)[:1000]}...
"""
        base_prompt = continuation_section + "\n\n" + base_prompt

    # Add document content
    base_prompt += f"""

DOCUMENTS TO PROCESS:
"""
    
    for i, doc in enumerate(documents):
        content = doc.get('file_content', '')
        if content.startswith('data:'):
            base_prompt += f"\nDOCUMENT {i+1}: {doc.get('file_name', 'Unknown')} (Binary content - process as uploaded file)\n"
        else:
            # Limit content length to prevent token overflow
            content_preview = content[:5000] + ("..." if len(content) > 5000 else "")
            base_prompt += f"\nDOCUMENT {i+1}: {doc.get('file_name', 'Unknown')}\n{content_preview}\n"

    base_prompt += f"""

EXTRACTION GUIDELINES:
- Extract data from ALL documents comprehensively
- Use exact field IDs from schema definitions  
- For collections, extract all instances found
- Provide clear reasoning for each extraction
- Include confidence scores (0-100)
- If response becomes too long, use processing_status to indicate truncation point

RETURN ONLY THE JSON - NO EXPLANATIONS OR MARKDOWN
"""

    return base_prompt

def perform_batch_extraction(
    session_id: str,
    documents: List[Dict],
    schema_fields: List[Dict],
    collections: List[Dict],
    knowledge_base: List[Dict],
    extraction_rules: List[Dict],
    previous_results: Optional[Dict] = None,
    batch_progress: Optional[BatchProgress] = None
) -> BatchResult:
    """
    Perform batch extraction with incremental JSON building and explicit bookmarking.
    """
    try:
        # Initialize Gemini AI with the same configuration as the working system
        api_key = os.getenv('GEMINI_API_KEY')  # Use GEMINI_API_KEY like the working system
        if not api_key:
            return BatchResult(
                success=False,
                error_message="GEMINI_API_KEY not configured"
            )
        
        if genai is None:
            return BatchResult(
                success=False,
                error_message="Google Generative AI library not available"
            )
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash-exp')  # Use the same model as the working system
        
        # Create incremental prompt
        prompt = create_incremental_prompt(
            documents=documents,
            schema_fields=schema_fields,
            collections=collections,
            knowledge_base=knowledge_base,
            extraction_rules=extraction_rules,
            previous_results=previous_results,
            batch_progress=batch_progress
        )
        
        batch_num = batch_progress.current_batch if batch_progress else 1
        logging.info(f"🚀 Starting batch {batch_num} extraction for session {session_id}")
        
        # Make API call to Gemini
        response = model.generate_content(prompt)
        ai_response = response.text
        
        # Parse response
        extracted_data = None
        try:
            # Clean the response
            clean_response = ai_response.strip()
            if clean_response.startswith('```json'):
                clean_response = clean_response[7:]
            if clean_response.endswith('```'):
                clean_response = clean_response[:-3]
            clean_response = clean_response.strip()
            
            extracted_data = json.loads(clean_response)
            
        except json.JSONDecodeError:
            logging.warning("⚠️ JSON decode failed, attempting repair...")
            
            # Try to repair truncated JSON
            repaired_json = repair_truncated_json(ai_response)
            if repaired_json:
                try:
                    extracted_data = json.loads(repaired_json)
                    logging.info("✅ JSON repair successful")
                except json.JSONDecodeError:
                    logging.error("❌ JSON repair failed")
                    return BatchResult(
                        success=False,
                        error_message="Failed to parse AI response as JSON"
                    )
            else:
                return BatchResult(
                    success=False,
                    error_message="Failed to parse and repair AI response"
                )
        
        # Extract field validations and processing status
        field_validations = extracted_data.get('field_validations', [])
        processing_status = extracted_data.get('processing_status', {})
        
        # Determine if continuation is needed
        completion_status = processing_status.get('completion_status', 'complete')
        needs_continuation = completion_status in ['truncated', 'partial']
        
        # Update batch progress
        if batch_progress:
            batch_progress.processed_validations += len(field_validations)
            batch_progress.last_processed_field_id = processing_status.get('last_processed_field_id')
            batch_progress.last_processed_collection = processing_status.get('last_processed_collection')
            batch_progress.last_processed_record_index = processing_status.get('last_processed_record_index', 0)
            batch_progress.next_start_marker = processing_status.get('next_start_marker')
            
            # Calculate completion percentage
            estimated_remaining = processing_status.get('estimated_remaining', 0)
            if estimated_remaining > 0:
                total_estimated = batch_progress.processed_validations + estimated_remaining
                batch_progress.completion_percentage = (batch_progress.processed_validations / total_estimated) * 100
            
            batch_progress.processing_status = completion_status
            
            # Add current batch results
            batch_progress.batch_results.append({
                'batch_number': batch_progress.current_batch,
                'validations_count': len(field_validations),
                'completion_status': completion_status
            })
        
        # Get token counts if available
        input_tokens = 0
        output_tokens = 0
        if hasattr(response, 'usage_metadata'):
            input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
            output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
        
        logging.info(f"✅ Batch {batch_num} completed: {len(field_validations)} validations, continuation needed: {needs_continuation}")
        
        return BatchResult(
            success=True,
            batch_progress=batch_progress,
            field_validations=field_validations,
            needs_continuation=needs_continuation,
            continuation_marker=processing_status.get('next_start_marker'),
            input_token_count=input_tokens,
            output_token_count=output_tokens
        )
        
    except Exception as e:
        logging.error(f"❌ Batch extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return BatchResult(
            success=False,
            error_message=str(e)
        )

def merge_batch_results(batch_results: List[BatchResult]) -> Dict:
    """
    Merge results from multiple batches into a single comprehensive result.
    """
    try:
        all_validations = []
        total_input_tokens = 0
        total_output_tokens = 0
        
        for batch_result in batch_results:
            if batch_result.success and batch_result.field_validations:
                all_validations.extend(batch_result.field_validations)
                total_input_tokens += batch_result.input_token_count
                total_output_tokens += batch_result.output_token_count
        
        # Remove duplicates based on field_id and record_index
        seen_validations = set()
        unique_validations = []
        
        for validation in all_validations:
            field_id = validation.get('field_id', '')
            record_index = validation.get('record_index', 0)
            collection_name = validation.get('collection_name', '')
            
            # Create unique key
            unique_key = f"{field_id}_{collection_name}_{record_index}"
            
            if unique_key not in seen_validations:
                seen_validations.add(unique_key)
                unique_validations.append(validation)
        
        logging.info(f"🔀 Merged {len(batch_results)} batches: {len(unique_validations)} unique validations")
        
        return {
            'success': True,
            'field_validations': unique_validations,
            'total_batches': len(batch_results),
            'total_validations': len(unique_validations),
            'input_token_count': total_input_tokens,
            'output_token_count': total_output_tokens,
            'batch_processing_used': True
        }
        
    except Exception as e:
        logging.error(f"❌ Error merging batch results: {e}")
        return {
            'success': False,
            'error': str(e)
        }

def run_enhanced_batch_validation(
    session_id: str,
    project_id: str,
    documents: List[Dict],
    schema_fields: List[Dict],
    collections: List[Dict],
    knowledge_base: List[Dict],
    extraction_rules: List[Dict],
    max_batches: int = 10
) -> Dict:
    """
    Main entry point for enhanced batch validation with incremental JSON building.
    """
    try:
        logging.info(f"🚀 Starting enhanced batch validation for session {session_id}")
        
        # Analyze dataset complexity
        analysis = analyze_dataset_complexity(documents, schema_fields, collections)
        recommended_batches = analysis.get('recommended_batches', 3)
        
        # Initialize batch tracking
        batch_progress = BatchProgress(
            session_id=session_id,
            current_batch=1,
            total_batches=min(recommended_batches, max_batches),
            processed_validations=0
        )
        
        batch_results = []
        previous_results = None
        
        # Process batches
        for batch_num in range(1, batch_progress.total_batches + 1):
            batch_progress.current_batch = batch_num
            
            # Perform batch extraction
            batch_result = perform_batch_extraction(
                session_id=session_id,
                documents=documents,
                schema_fields=schema_fields,
                collections=collections,
                knowledge_base=knowledge_base,
                extraction_rules=extraction_rules,
                previous_results=previous_results,
                batch_progress=batch_progress
            )
            
            if not batch_result.success:
                logging.error(f"❌ Batch {batch_num} failed: {batch_result.error_message}")
                break
            
            batch_results.append(batch_result)
            
            # Update previous results for next batch
            if previous_results is None:
                previous_results = {'field_validations': []}
            previous_results['field_validations'].extend(batch_result.field_validations or [])
            
            # Check if we need continuation
            if not batch_result.needs_continuation:
                logging.info(f"✅ Batch processing completed at batch {batch_num}")
                break
            
            logging.info(f"🔄 Batch {batch_num} needs continuation, proceeding to next batch...")
        
        # Merge all batch results
        if batch_results:
            final_result = merge_batch_results(batch_results)
            final_result['batch_analysis'] = analysis
            final_result['batch_progress'] = asdict(batch_progress) if batch_progress else None
            return final_result
        else:
            return {
                'success': False,
                'error': 'No successful batches processed'
            }
            
    except Exception as e:
        logging.error(f"❌ Enhanced batch validation failed: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    # This script can be called directly for testing
    import sys
    
    if len(sys.argv) > 1:
        # Read input from stdin for integration with Node.js
        input_data = json.loads(sys.stdin.read())
        
        result = run_enhanced_batch_validation(
            session_id=input_data['session_id'],
            project_id=input_data['project_id'],
            documents=input_data['documents'],
            schema_fields=input_data['schema_fields'],
            collections=input_data['collections'],
            knowledge_base=input_data.get('knowledge_base', []),
            extraction_rules=input_data.get('extraction_rules', [])
        )
        
        print(json.dumps(result))
    else:
        print("Enhanced Batch Validation System - Ready for integration")