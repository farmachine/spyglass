#!/usr/bin/env python3
"""
Script to recalculate validation scores for existing sessions
"""

import sys
import json
import subprocess
sys.path.append('.')

from ai_extraction import calculate_knowledge_based_confidence

def recalculate_session_validations(session_id):
    """Recalculate validation scores for a specific session"""
    
    # Get session data
    print(f"Fetching session data for {session_id}...")
    cmd = f'curl -s "http://localhost:5000/api/sessions/{session_id}/validations"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error fetching validations: {result.stderr}")
        return
    
    try:
        validations = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(f"Error parsing validations JSON: {e}")
        print(f"Response: {result.stdout[:200]}...")
        return
    
    print(f"Found {len(validations)} validations")
    
    # Get project data
    if not validations:
        print("No validations found")
        return
        
    # Get project ID from first validation (assuming all belong to same project)
    session_result = subprocess.run(f'curl -s "http://localhost:5000/api/sessions/{session_id}"', shell=True, capture_output=True, text=True)
    session_data = json.loads(session_result.stdout)
    project_id = session_data['projectId']
    
    # Get extraction rules
    rules_result = subprocess.run(f'curl -s "http://localhost:5000/api/projects/{project_id}/rules"', shell=True, capture_output=True, text=True)
    extraction_rules = json.loads(rules_result.stdout)
    print(f"Found {len(extraction_rules)} extraction rules")
    
    # Get knowledge documents
    knowledge_result = subprocess.run(f'curl -s "http://localhost:5000/api/projects/{project_id}/knowledge"', shell=True, capture_output=True, text=True)
    knowledge_documents = json.loads(knowledge_result.stdout)
    print(f"Found {len(knowledge_documents)} knowledge documents")
    
    updates_needed = []
    
    # Process each validation
    for validation in validations:
        field_name = validation['fieldName']
        extracted_value = validation['extractedValue']
        current_confidence = validation['confidenceScore']
        
        if extracted_value is not None and extracted_value != "":
            confidence, applied_rules = calculate_knowledge_based_confidence(
                field_name, extracted_value, 95, extraction_rules, knowledge_documents
            )
            
            if confidence != current_confidence:
                updates_needed.append({
                    'id': validation['id'],
                    'fieldName': field_name,
                    'extractedValue': extracted_value,
                    'oldConfidence': current_confidence,
                    'newConfidence': confidence,
                    'appliedRules': applied_rules
                })
                print(f"  {field_name}: {extracted_value} | {current_confidence}% → {confidence}%")
    
    print(f"\nFound {len(updates_needed)} validations needing updates")
    
    # Apply updates
    for update in updates_needed:
        update_cmd = f'''curl -X PUT "http://localhost:5000/api/validations/{update['id']}" \\
  -H "Content-Type: application/json" \\
  -d '{{"confidenceScore": {update['newConfidence']}}}'
'''
        
        print(f"Updating {update['fieldName']}...")
        update_result = subprocess.run(update_cmd, shell=True, capture_output=True, text=True)
        
        if update_result.returncode == 0:
            print(f"  ✓ Updated confidence: {update['oldConfidence']}% → {update['newConfidence']}%")
        else:
            print(f"  ✗ Failed to update: {update_result.stderr}")
    
    print(f"\nRecalculation complete! Updated {len(updates_needed)} validation scores.")

if __name__ == "__main__":
    session_id = "94b92bb4-c0fb-4833-afa1-b47f0a7032e6"
    recalculate_session_validations(session_id)