#!/usr/bin/env python3
"""
AI-Powered Task Classifier - Intelligently determines extraction method based on field analysis
"""

import json
import os
from google import genai

def classify_extraction_task_with_ai(target_fields, field_schemas, collection_schemas):
    """
    Use AI to classify extraction tasks based on field descriptions and requirements
    """
    
    # Get API key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY_MISSING - falling back to basic classification")
        return classify_extraction_task_basic(target_fields)
    
    try:
        client = genai.Client(api_key=api_key)
        
        # Build field analysis prompt
        field_analysis = []
        
        # Analyze schema fields
        for field_name in target_fields:
            if field_name in field_schemas:
                schema = field_schemas[field_name]
                field_analysis.append({
                    "field_name": field_name,
                    "field_type": "schema_field",
                    "description": schema.get("description", ""),
                    "field_type_detail": schema.get("fieldType", ""),
                    "validation_rules": schema.get("validationRules", [])
                })
        
        # Analyze collection fields
        for collection_name in target_fields:
            if collection_name in collection_schemas:
                collection = collection_schemas[collection_name]
                properties = collection.get("properties", [])
                field_analysis.append({
                    "field_name": collection_name,
                    "field_type": "collection",
                    "description": collection.get("description", ""),
                    "properties": [{"name": p.get("propertyName", ""), "description": p.get("description", "")} for p in properties]
                })
        
        classification_prompt = f"""Analyze these extraction fields and classify as SIMPLE or COMPLEX:

SIMPLE: Direct copying (column names, worksheet names, metadata)
COMPLEX: Requires reasoning, analysis, validation, or standardization

Fields to analyze:
{json.dumps(field_analysis, indent=2)}

Respond with only this JSON format:
{{"overall_classification": "simple", "field_classifications": {{"Column Name Mapping": "simple"}}, "reasoning": "Direct column extraction requires no analysis"}}"""

        response = client.models.generate_content(
            model="gemini-2.0-flash-exp",
            contents=[classification_prompt]
        )
        
        if response.text:
            try:
                result = json.loads(response.text.strip())
                print(f"AI CLASSIFICATION: {result['overall_classification']} - {result['reasoning']}")
                return result
            except json.JSONDecodeError:
                print("AI response invalid JSON, falling back to basic classification")
                return classify_extraction_task_basic(target_fields)
        else:
            print("AI response empty, falling back to basic classification")
            return classify_extraction_task_basic(target_fields)
            
    except Exception as e:
        print(f"AI classification error: {e}, falling back to basic classification")
        return classify_extraction_task_basic(target_fields)

def classify_extraction_task_basic(target_fields):
    """
    Basic fallback classification when AI is unavailable
    """
    simple_patterns = {
        "Column Name Mapping": "simple",
        "Missing Column Names": "simple", 
        "Additional Column Names": "simple",
        "Document Title": "simple",
        "File Name": "simple",
        "Upload Date": "simple"
    }
    
    field_classifications = {}
    simple_count = 0
    
    for field in target_fields:
        if any(pattern in field for pattern in simple_patterns.keys()):
            field_classifications[field] = "simple"
            simple_count += 1
        else:
            field_classifications[field] = "complex"
    
    overall = "simple" if simple_count == len(target_fields) else "complex"
    
    return {
        "overall_classification": overall,
        "field_classifications": field_classifications,
        "reasoning": f"Basic pattern matching: {simple_count}/{len(target_fields)} fields are simple"
    }

def get_simple_extraction_strategy(target_fields):
    """Get extraction strategy for simple tasks"""
    
    strategies = []
    
    for field in target_fields:
        if field == "Column Name Mapping":
            strategies.append({
                "field": field,
                "method": "direct_excel_column_extraction",
                "properties": ["Column Heading", "Worksheet Name"]
            })
        elif field == "Missing Column Names":
            strategies.append({
                "field": field, 
                "method": "column_comparison",
                "properties": ["Expected Column", "Missing From Sheet"]
            })
        elif field == "Additional Column Names":
            strategies.append({
                "field": field,
                "method": "column_comparison", 
                "properties": ["Unexpected Column", "Found In Sheet"]
            })
    
    return strategies

if __name__ == "__main__":
    # Test classification
    test_fields = ["Column Name Mapping"]
    result = classify_extraction_task(test_fields, {})
    print(f"Task classification: {result}")
    
    if result == "simple":
        strategies = get_simple_extraction_strategy(test_fields)
        print("Simple extraction strategies:", strategies)