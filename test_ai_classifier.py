#!/usr/bin/env python3
"""
Test the AI-powered task classifier with real field schemas
"""

from task_classifier import classify_extraction_task_with_ai

def test_classifier():
    # Test with Column Name Mapping (should be simple)
    target_fields = ["Column Name Mapping"]
    
    field_schemas = {}
    
    collection_schemas = {
        "Column Name Mapping": {
            "description": "An analysis of all the columns in the workbook.",
            "properties": [
                {"propertyName": "Column Heading", "description": "The name of the column as it appears in the workbook"},
                {"propertyName": "Worksheet Name", "description": "The name of the worksheet where this column is found"},
                {"propertyName": "Standardised Column Name", "description": "The standardized name for this column based on our mapping rules"},
                {"propertyName": "Reasoning", "description": "Explanation of why this column was mapped to the standardized name"}
            ]
        }
    }
    
    result = classify_extraction_task_with_ai(target_fields, field_schemas, collection_schemas)
    print("Column Name Mapping Classification:")
    print(f"Overall: {result['overall_classification']}")
    print(f"Reasoning: {result['reasoning']}")
    print()
    
    # Test with more complex field (should be complex)
    target_fields = ["Risk Assessment Analysis"]
    
    collection_schemas = {
        "Risk Assessment Analysis": {
            "description": "Comprehensive risk evaluation requiring analysis of multiple data points and cross-referencing with regulatory requirements.",
            "properties": [
                {"propertyName": "Risk Level", "description": "Calculated risk level based on multiple factors and business rules"},
                {"propertyName": "Compliance Status", "description": "Assessment of regulatory compliance requiring knowledge base lookup"},
                {"propertyName": "Recommendation", "description": "AI-generated recommendation based on risk analysis"}
            ]
        }
    }
    
    result = classify_extraction_task_with_ai(target_fields, field_schemas, collection_schemas)
    print("Risk Assessment Classification:")
    print(f"Overall: {result['overall_classification']}")
    print(f"Reasoning: {result['reasoning']}")

if __name__ == "__main__":
    test_classifier()