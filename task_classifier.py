#!/usr/bin/env python3
"""
Task Classifier - Determines whether to use simple extraction or complex AI reasoning
"""

def classify_extraction_task(target_fields, field_schema):
    """
    Classify extraction task as simple or complex
    
    Simple tasks:
    - Column Name Mapping (just extract column names and worksheet names)
    - Basic field extraction without reasoning
    
    Complex tasks:
    - Fields requiring analysis, mapping, or validation
    - Fields requiring cross-referencing with knowledge base
    - Fields requiring AI reasoning
    """
    
    simple_collections = {
        "Column Name Mapping",
        "Missing Column Names", 
        "Additional Column Names"
    }
    
    simple_fields = {
        "Document Title",
        "File Name", 
        "Upload Date"
    }
    
    # Check if all target fields are simple
    for field in target_fields:
        if field in simple_collections:
            continue
        elif field in simple_fields:
            continue
        else:
            # Complex field requiring AI reasoning
            return "complex"
    
    return "simple"

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