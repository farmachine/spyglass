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
    Basic binary classification: Excel Column Extraction vs Current AI Extraction
    """
    # EXCEL COLUMN EXTRACTION - Direct data copying from Excel files
    excel_column_tasks = {
        "Column Name Mapping",  # Extract column names and worksheet names
        "Missing Column Names", # Compare expected vs actual columns
        "Additional Column Names"  # Find unexpected columns
    }
    
    # CURRENT AI EXTRACTION - Complex reasoning and analysis
    # Everything else that requires AI understanding, validation, or reasoning
    
    field_classifications = {}
    excel_task_count = 0
    
    for field in target_fields:
        if field in excel_column_tasks:
            field_classifications[field] = "excel_column_extraction"
            excel_task_count += 1
        else:
            field_classifications[field] = "current_ai_extraction"
    
    # Decision: Use Excel extraction only if ALL fields are simple column tasks
    if excel_task_count == len(target_fields) and excel_task_count > 0:
        extraction_method = "excel_column_extraction"
        reasoning = f"All {len(target_fields)} fields are Excel column tasks - using direct extraction"
    else:
        extraction_method = "current_ai_extraction" 
        reasoning = f"Contains {len(target_fields) - excel_task_count} complex fields - using AI extraction"
    
    return {
        "extraction_method": extraction_method,
        "field_classifications": field_classifications,
        "reasoning": reasoning,
        "excel_tasks": excel_task_count,
        "ai_tasks": len(target_fields) - excel_task_count
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