#!/usr/bin/env python3
"""
CONSOLIDATED AI EXTRACTION - NEW APPROACH
Uses consolidated validation structure directly in field/collection records.
No separate validation table, eliminates index [0] corruption issues entirely.
"""

import sys
import json
import logging
import os
from typing import Dict, List, Any, Optional, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO)

def create_field_validation_records(session_data: Dict[str, Any], extraction_results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Create validation records by copying field definitions and adding extracted data.
    This eliminates the separate validation table and index [0] corruption issues.
    
    Args:
        session_data: Session information including project schema
        extraction_results: AI extraction results with extracted values
    
    Returns:
        List of field/collection records with validation data populated
    """
    session_id = session_data.get("session_id")
    project_schema = session_data.get("project_schema", {})
    
    validation_records = []
    
    # Extract data from AI results
    extracted_data = extraction_results.get("extracted_data", {})
    
    logging.info(f"🚀 CONSOLIDATED_EXTRACTION: Creating validation records for session {session_id}")
    logging.info(f"📊 Extracted data keys: {list(extracted_data.keys())}")
    
    # 1. Process Schema Fields (now stored directly with validation data)
    schema_fields = project_schema.get("fields", [])
    for field in schema_fields:
        field_name = field.get("fieldName", "")
        field_value = extracted_data.get(field_name)
        
        # Create validation record by copying field definition + adding validation data
        validation_record = {
            # Copy original field definition
            "id": field.get("id"),
            "projectId": field.get("projectId"),
            "fieldName": field_name,
            "fieldType": field.get("fieldType"),
            "description": field.get("description"),
            "autoVerificationConfidence": field.get("autoVerificationConfidence", 80),
            "orderIndex": field.get("orderIndex", 0),
            
            # Add validation data
            "sessionId": session_id,
            "extractedValue": field_value,
            "originalExtractedValue": field_value,
            "confidenceScore": 95 if field_value is not None and field_value != "" else 20,
            "originalConfidenceScore": 95 if field_value is not None and field_value != "" else 20,
            "validationStatus": "verified" if (field_value is not None and field_value != "") else "unverified",
            "aiReasoning": "Extracted during AI processing" if field_value else "Field requires manual input",
            "originalAiReasoning": "Extracted during AI processing" if field_value else "Field requires manual input",
            "manuallyVerified": False,
            "record_type": "schema_field"
        }
        
        validation_records.append(validation_record)
        logging.info(f"✅ Schema field: {field_name} = {field_value} ({validation_record['confidenceScore']}%)")
    
    # 2. Process Collection Properties (create instances for each extracted item)
    collections = project_schema.get("collections", [])
    for collection in collections:
        collection_name = collection.get("collectionName", "")
        properties = collection.get("properties", [])
        
        # Get extracted items for this collection
        collection_items = extracted_data.get(collection_name, [])
        if not isinstance(collection_items, list):
            collection_items = []
        
        logging.info(f"📋 Collection {collection_name}: {len(collection_items)} items extracted")
        
        # Create validation records for each property of each collection item
        for item_index, item_data in enumerate(collection_items):
            for property_def in properties:
                property_name = property_def.get("propertyName", "")
                property_value = item_data.get(property_name) if isinstance(item_data, dict) else None
                
                # Create validation record by copying property definition + adding validation data
                validation_record = {
                    # Copy original property definition
                    "id": property_def.get("id"),
                    "collectionId": property_def.get("collectionId"),
                    "propertyName": property_name,
                    "propertyType": property_def.get("propertyType"),
                    "description": property_def.get("description"),
                    "autoVerificationConfidence": property_def.get("autoVerificationConfidence", 80),
                    "orderIndex": property_def.get("orderIndex", 0),
                    
                    # Add validation data  
                    "recordIndex": item_index,  # Which collection item (0, 1, 2, etc.)
                    "sessionId": session_id,
                    "extractedValue": property_value,
                    "originalExtractedValue": property_value,
                    "confidenceScore": 95 if property_value is not None and property_value != "" else 20,
                    "originalConfidenceScore": 95 if property_value is not None and property_value != "" else 20,
                    "validationStatus": "verified" if (property_value is not None and property_value != "") else "unverified",
                    "aiReasoning": "Extracted during AI processing" if property_value else "Property requires manual input",
                    "originalAiReasoning": "Extracted during AI processing" if property_value else "Property requires manual input",
                    "manuallyVerified": False,
                    "record_type": "collection_property",
                    "collection_name": collection_name
                }
                
                validation_records.append(validation_record)
                logging.info(f"✅ {collection_name}[{item_index}].{property_name} = {property_value} ({validation_record['confidenceScore']}%)")
    
    logging.info(f"🎯 CONSOLIDATED_EXTRACTION: Created {len(validation_records)} validation records")
    
    return validation_records

def main():
    """
    Main function for consolidated AI extraction approach.
    Reads session data, creates validation records with extracted data.
    """
    try:
        # Read session data from stdin
        session_data = json.loads(sys.stdin.read())
        session_id = session_data.get("session_id")
        
        logging.info(f"🚀 CONSOLIDATED_EXTRACTION: Processing session {session_id}")
        
        # For now, simulate extraction results
        # In real implementation, this would call the AI extraction service
        mock_extraction_results = {
            "extracted_data": {
                "Number of Parties": "33",
                "Parties": [
                    {"Name": "3M Company", "Address": None, "Country": None},
                    {"Name": "Cogent, Inc.", "Address": None, "Country": "Delaware"},
                    {"Name": "AeroGrow International, Inc.", "Address": "900 28th Street, Suite 201, Boulder, CO 80303", "Country": "USA"}
                ]
            }
        }
        
        # Create validation records using consolidated approach
        validation_records = create_field_validation_records(session_data, mock_extraction_results)
        
        # Return results
        result = {
            "success": True,
            "session_id": session_id,
            "validation_records": validation_records,
            "total_records": len(validation_records),
            "message": "Consolidated validation records created successfully"
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        logging.error(f"CONSOLIDATED_EXTRACTION failed: {e}")
        result = {
            "success": False,
            "error": str(e),
            "message": "Consolidated extraction failed"
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == "__main__":
    main()