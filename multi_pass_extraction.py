#!/usr/bin/env python3
"""
MULTI-PASS EXTRACTION SYSTEM
Handles scenarios where initial extraction is truncated and additional AI calls are needed
to fetch remaining fields using different strategies.
"""
import logging
import json
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from ai_extraction_simplified import step1_extract_from_documents, ExtractionResult

logging.basicConfig(level=logging.INFO)

@dataclass
class MultiPassResult:
    success: bool
    total_extracted_fields: int
    total_expected_fields: int
    completion_percentage: float
    passes_completed: int
    merged_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    pass_results: List[ExtractionResult] = None

class MultiPassExtractor:
    """
    Handles multi-pass extraction when initial AI call is truncated.
    Offers several strategies for fetching remaining fields.
    """
    
    def __init__(self):
        self.strategies = {
            "remaining_fields": self._extract_remaining_fields,
            "schema_chunking": self._extract_by_schema_chunks,
            "collection_focused": self._extract_by_collections,
            "priority_based": self._extract_by_priority
        }
    
    def extract_with_multi_pass(
        self,
        documents: List[Dict[str, Any]],
        project_schema: Dict[str, Any],
        extraction_rules: List[Dict[str, Any]] = None,
        knowledge_documents: List[Dict[str, Any]] = None,
        session_name: str = "contract",
        strategy: str = "remaining_fields",
        max_passes: int = 3
    ) -> MultiPassResult:
        """
        Main multi-pass extraction orchestrator.
        
        Args:
            documents: Documents to extract from
            project_schema: Complete schema definition
            strategy: Which multi-pass strategy to use
            max_passes: Maximum number of AI calls to make
        """
        
        logging.info(f"Starting multi-pass extraction with strategy: {strategy}")
        
        # Calculate expected field count
        expected_fields = self._count_expected_fields(project_schema)
        logging.info(f"Expected total fields: {expected_fields}")
        
        # Pass 1: Initial full extraction
        logging.info("=== PASS 1: Initial Full Extraction ===")
        pass1_result = step1_extract_from_documents(
            documents=documents,
            project_schema=project_schema,
            extraction_rules=extraction_rules,
            knowledge_documents=knowledge_documents,
            session_name=session_name
        )
        
        pass_results = [pass1_result]
        
        if not pass1_result.success:
            return MultiPassResult(
                success=False,
                total_extracted_fields=0,
                total_expected_fields=expected_fields,
                completion_percentage=0.0,
                passes_completed=1,
                error_message=pass1_result.error_message,
                pass_results=pass_results
            )
        
        # Analyze first pass results
        extracted_field_ids = self._get_extracted_field_ids(pass1_result.extracted_data)
        extracted_count = len(extracted_field_ids)
        completion_rate = extracted_count / expected_fields if expected_fields > 0 else 0
        
        logging.info(f"Pass 1 results: {extracted_count}/{expected_fields} fields ({completion_rate*100:.1f}%)")
        
        # If we got everything or we're at single pass mode, return
        if completion_rate >= 0.95 or max_passes == 1:
            return MultiPassResult(
                success=True,
                total_extracted_fields=extracted_count,
                total_expected_fields=expected_fields,
                completion_percentage=completion_rate * 100,
                passes_completed=1,
                merged_data=pass1_result.extracted_data,
                pass_results=pass_results
            )
        
        # Multi-pass extraction needed
        logging.info(f"Multi-pass extraction needed. Missing {expected_fields - extracted_count} fields.")
        
        # Use selected strategy for additional passes
        strategy_func = self.strategies.get(strategy, self._extract_remaining_fields)
        
        merged_data = pass1_result.extracted_data
        current_extracted_ids = extracted_field_ids.copy()
        
        for pass_num in range(2, max_passes + 1):
            logging.info(f"=== PASS {pass_num}: {strategy.title()} Strategy ===")
            
            # Calculate remaining fields needed
            remaining_fields = expected_fields - len(current_extracted_ids)
            if remaining_fields <= 0:
                break
                
            # Execute strategy-specific extraction
            pass_result = strategy_func(
                documents=documents,
                project_schema=project_schema,
                already_extracted_ids=current_extracted_ids,
                extraction_rules=extraction_rules,
                knowledge_documents=knowledge_documents,
                session_name=session_name,
                pass_number=pass_num
            )
            
            pass_results.append(pass_result)
            
            if pass_result.success and pass_result.extracted_data:
                # Merge new fields with existing data
                new_field_ids = self._get_extracted_field_ids(pass_result.extracted_data)
                truly_new_fields = [fid for fid in new_field_ids if fid not in current_extracted_ids]
                
                logging.info(f"Pass {pass_num} extracted {len(truly_new_fields)} new fields")
                
                if truly_new_fields:
                    merged_data = self._merge_extraction_results(merged_data, pass_result.extracted_data)
                    current_extracted_ids.extend(truly_new_fields)
                else:
                    logging.warning(f"Pass {pass_num} didn't extract any new fields, stopping")
                    break
            else:
                logging.warning(f"Pass {pass_num} failed: {pass_result.error_message}")
                break
        
        # Final results
        final_extracted_count = len(current_extracted_ids)
        final_completion_rate = final_extracted_count / expected_fields if expected_fields > 0 else 0
        
        logging.info(f"Multi-pass extraction complete: {final_extracted_count}/{expected_fields} fields ({final_completion_rate*100:.1f}%)")
        
        return MultiPassResult(
            success=True,
            total_extracted_fields=final_extracted_count,
            total_expected_fields=expected_fields,
            completion_percentage=final_completion_rate * 100,
            passes_completed=len(pass_results),
            merged_data=merged_data,
            pass_results=pass_results
        )
    
    def _extract_remaining_fields(
        self,
        documents: List[Dict[str, Any]],
        project_schema: Dict[str, Any],
        already_extracted_ids: List[str],
        extraction_rules: List[Dict[str, Any]] = None,
        knowledge_documents: List[Dict[str, Any]] = None,
        session_name: str = "contract",
        pass_number: int = 2
    ) -> ExtractionResult:
        """
        Strategy 1: Extract only the remaining fields that weren't captured in previous passes.
        This is the most efficient approach.
        """
        
        # Create a filtered schema with only missing fields
        filtered_schema = self._create_filtered_schema(project_schema, already_extracted_ids)
        
        if not filtered_schema.get("schema_fields") and not filtered_schema.get("collections"):
            logging.info("No remaining fields to extract")
            return ExtractionResult(success=True, extracted_data={"field_validations": []})
        
        logging.info(f"Extracting {self._count_expected_fields(filtered_schema)} remaining fields")
        
        return step1_extract_from_documents(
            documents=documents,
            project_schema=filtered_schema,
            extraction_rules=extraction_rules,
            knowledge_documents=knowledge_documents,
            session_name=session_name
        )
    
    def _extract_by_schema_chunks(
        self,
        documents: List[Dict[str, Any]],
        project_schema: Dict[str, Any],
        already_extracted_ids: List[str],
        extraction_rules: List[Dict[str, Any]] = None,
        knowledge_documents: List[Dict[str, Any]] = None,
        session_name: str = "contract",
        pass_number: int = 2
    ) -> ExtractionResult:
        """
        Strategy 2: Extract by chunks of schema (e.g., first half of fields, then second half).
        Good when you want to ensure balanced coverage.
        """
        
        # Split remaining fields into chunks
        remaining_schema = self._create_filtered_schema(project_schema, already_extracted_ids)
        
        # For pass 2, take first half of remaining fields
        # For pass 3, take second half, etc.
        chunk_size = max(1, self._count_expected_fields(remaining_schema) // (4 - pass_number + 1))
        chunked_schema = self._create_chunked_schema(remaining_schema, pass_number - 2, chunk_size)
        
        logging.info(f"Extracting schema chunk {pass_number-1} with {self._count_expected_fields(chunked_schema)} fields")
        
        return step1_extract_from_documents(
            documents=documents,
            project_schema=chunked_schema,
            extraction_rules=extraction_rules,
            knowledge_documents=knowledge_documents,
            session_name=session_name
        )
    
    def _extract_by_collections(
        self,
        documents: List[Dict[str, Any]],
        project_schema: Dict[str, Any],
        already_extracted_ids: List[str],
        extraction_rules: List[Dict[str, Any]] = None,
        knowledge_documents: List[Dict[str, Any]] = None,
        session_name: str = "contract",
        pass_number: int = 2
    ) -> ExtractionResult:
        """
        Strategy 3: Focus each pass on a specific collection.
        Good for documents with multiple distinct sections.
        """
        
        # Get collections that still have missing fields
        remaining_collections = self._get_collections_with_missing_fields(project_schema, already_extracted_ids)
        
        if not remaining_collections:
            return ExtractionResult(success=True, extracted_data={"field_validations": []})
        
        # Focus on one collection per pass
        collection_index = (pass_number - 2) % len(remaining_collections)
        target_collection = remaining_collections[collection_index]
        
        # Create schema with just this collection and any missing schema fields
        focused_schema = {
            "schema_fields": [f for f in project_schema.get("schema_fields", []) 
                            if f['id'] not in already_extracted_ids],
            "collections": [target_collection]
        }
        
        logging.info(f"Focusing on collection: {target_collection.get('collectionName', 'Unknown')}")
        
        return step1_extract_from_documents(
            documents=documents,
            project_schema=focused_schema,
            extraction_rules=extraction_rules,
            knowledge_documents=knowledge_documents,
            session_name=session_name
        )
    
    def _extract_by_priority(
        self,
        documents: List[Dict[str, Any]],
        project_schema: Dict[str, Any],
        already_extracted_ids: List[str],
        extraction_rules: List[Dict[str, Any]] = None,
        knowledge_documents: List[Dict[str, Any]] = None,
        session_name: str = "contract",
        pass_number: int = 2
    ) -> ExtractionResult:
        """
        Strategy 4: Extract fields by priority (most important first).
        Good when you want to ensure critical fields are captured.
        """
        
        # Define priority keywords (customize based on your use case)
        high_priority_keywords = [
            'title', 'name', 'date', 'amount', 'value', 'price', 'cost',
            'party', 'company', 'organization', 'effective', 'term'
        ]
        
        remaining_schema = self._create_filtered_schema(project_schema, already_extracted_ids)
        priority_schema = self._create_priority_schema(remaining_schema, high_priority_keywords, pass_number)
        
        logging.info(f"Extracting priority fields with {self._count_expected_fields(priority_schema)} fields")
        
        return step1_extract_from_documents(
            documents=documents,
            project_schema=priority_schema,
            extraction_rules=extraction_rules,
            knowledge_documents=knowledge_documents,
            session_name=session_name
        )
    
    # Helper methods
    def _count_expected_fields(self, schema: Dict[str, Any]) -> int:
        """Count total expected fields in a schema"""
        count = len(schema.get("schema_fields", []))
        
        for collection in schema.get("collections", []):
            properties = collection.get("properties", [])
            # Estimate 5 records per collection (can be made configurable)
            count += len(properties) * 5
            
        return count
    
    def _get_extracted_field_ids(self, extracted_data: Dict[str, Any]) -> List[str]:
        """Get list of field IDs that were successfully extracted"""
        if not extracted_data or "field_validations" not in extracted_data:
            return []
        
        field_ids = []
        for validation in extracted_data["field_validations"]:
            if validation.get("field_id") and validation.get("extracted_value"):
                field_ids.append(validation["field_id"])
        
        return field_ids
    
    def _create_filtered_schema(self, original_schema: Dict[str, Any], exclude_field_ids: List[str]) -> Dict[str, Any]:
        """Create a schema excluding already extracted fields"""
        filtered_schema = {"schema_fields": [], "collections": []}
        
        # Filter schema fields
        for field in original_schema.get("schema_fields", []):
            if field['id'] not in exclude_field_ids:
                filtered_schema["schema_fields"].append(field)
        
        # Filter collection fields (keep all collections but they'll be filtered during extraction)
        filtered_schema["collections"] = original_schema.get("collections", [])
        
        return filtered_schema
    
    def _merge_extraction_results(self, existing_data: Dict[str, Any], new_data: Dict[str, Any]) -> Dict[str, Any]:
        """Merge field validations from multiple extraction passes"""
        if not existing_data:
            return new_data
        
        if not new_data or "field_validations" not in new_data:
            return existing_data
        
        # Combine field validations, avoiding duplicates
        existing_validations = existing_data.get("field_validations", [])
        new_validations = new_data.get("field_validations", [])
        
        existing_field_ids = {v.get("field_id") for v in existing_validations}
        
        for validation in new_validations:
            if validation.get("field_id") not in existing_field_ids:
                existing_validations.append(validation)
        
        return {"field_validations": existing_validations}
    
    def _create_chunked_schema(self, schema: Dict[str, Any], chunk_index: int, chunk_size: int) -> Dict[str, Any]:
        """Create a schema with only a specific chunk of fields"""
        chunked_schema = {"schema_fields": [], "collections": []}
        
        # Chunk schema fields
        schema_fields = schema.get("schema_fields", [])
        start_idx = chunk_index * chunk_size
        end_idx = min(start_idx + chunk_size, len(schema_fields))
        chunked_schema["schema_fields"] = schema_fields[start_idx:end_idx]
        
        # For collections, include them if we're in the right chunk range
        collections = schema.get("collections", [])
        if chunk_index == 0 or len(schema_fields) <= chunk_size:
            chunked_schema["collections"] = collections
        
        return chunked_schema
    
    def _get_collections_with_missing_fields(self, schema: Dict[str, Any], extracted_field_ids: List[str]) -> List[Dict[str, Any]]:
        """Get collections that still have unextracted properties"""
        collections_with_missing = []
        
        for collection in schema.get("collections", []):
            properties = collection.get("properties", [])
            has_missing = any(prop['id'] not in extracted_field_ids for prop in properties)
            if has_missing:
                collections_with_missing.append(collection)
        
        return collections_with_missing
    
    def _create_priority_schema(self, schema: Dict[str, Any], priority_keywords: List[str], pass_number: int) -> Dict[str, Any]:
        """Create schema focusing on high-priority fields first"""
        priority_schema = {"schema_fields": [], "collections": []}
        
        # Sort fields by priority
        schema_fields = schema.get("schema_fields", [])
        
        def field_priority(field):
            field_name = field.get('fieldName', '').lower()
            return any(keyword in field_name for keyword in priority_keywords)
        
        sorted_fields = sorted(schema_fields, key=field_priority, reverse=True)
        
        # Take a chunk based on pass number
        chunk_size = max(1, len(sorted_fields) // 3)
        start_idx = (pass_number - 2) * chunk_size
        end_idx = min(start_idx + chunk_size, len(sorted_fields))
        
        priority_schema["schema_fields"] = sorted_fields[start_idx:end_idx]
        priority_schema["collections"] = schema.get("collections", [])
        
        return priority_schema

# Example usage and testing
if __name__ == "__main__":
    print("🔄 MULTI-PASS EXTRACTION SYSTEM")
    print("=" * 40)
    print("Available strategies:")
    print("1. remaining_fields - Extract only missing fields (most efficient)")
    print("2. schema_chunking - Extract in balanced chunks")
    print("3. collection_focused - Focus on one collection per pass")
    print("4. priority_based - Extract high-priority fields first")
    print("\nThis system automatically handles truncated responses by making")
    print("additional targeted AI calls to fetch remaining data.")