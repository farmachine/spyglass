#!/usr/bin/env python3
"""
Integration script to add continuation functionality to the main extraction routes.
This will modify the extraction route to automatically handle continuation when truncation is detected.
"""

def create_enhanced_extraction_route():
    """
    Returns the enhanced extraction route code that includes continuation functionality
    """
    
    enhanced_route_code = '''
@app.route('/api/sessions/<session_id>/extract', methods=['POST'])
def extract_session_data(session_id):
    """
    Enhanced extraction endpoint with automatic continuation support for truncated responses
    """
    try:
        # Import continuation system
        from ai_continuation_system import (
            analyze_truncation_point,
            perform_continuation_extraction,
            merge_extraction_results
        )
        from ai_extraction_simplified import step1_extract_from_documents, repair_truncated_json
        
        # Get session and project data
        session = storage.get_session(session_id)
        if not session:
            return jsonify({"success": False, "error": "Session not found"}), 404
            
        project = storage.get_project(session["project_id"])
        if not project:
            return jsonify({"success": False, "error": "Project not found"}), 404
        
        # Get schema, collections, and knowledge base
        schema_fields = storage.get_project_schema(session["project_id"])
        collections = storage.get_project_collections(session["project_id"])
        knowledge_base = storage.get_project_knowledge(session["project_id"])
        extraction_rules = storage.get_project_rules(session["project_id"])
        
        # Get documents for extraction
        documents = session.get("documents", [])
        if not documents:
            return jsonify({"success": False, "error": "No documents found for extraction"}), 400
        
        # Prepare project schema
        project_schema = {
            "schema_fields": schema_fields,
            "collections": collections
        }
        
        logging.info(f"🚀 Starting enhanced extraction for session {session_id}")
        logging.info(f"📊 Schema: {len(schema_fields)} fields, {len(collections)} collections")
        
        # Perform initial extraction
        extraction_result = step1_extract_from_documents(
            documents=documents,
            project_schema=project_schema,
            extraction_rules=extraction_rules,
            knowledge_documents=knowledge_base
        )
        
        if not extraction_result.success:
            logging.error(f"❌ Initial extraction failed: {extraction_result.error_message}")
            return jsonify({
                "success": False, 
                "error": f"Extraction failed: {extraction_result.error_message}"
            }), 500
        
        extracted_data = extraction_result.extracted_data
        original_response = extraction_result.ai_response
        
        # Check if we have field validations
        if not extracted_data or not extracted_data.get('field_validations'):
            logging.warning("⚠️ No field validations extracted - checking for truncation")
            
            # Attempt truncation repair
            if original_response:
                repaired_json = repair_truncated_json(original_response)
                if repaired_json:
                    try:
                        extracted_data = json.loads(repaired_json)
                        logging.info("✅ Truncation repair successful")
                    except json.JSONDecodeError:
                        logging.error("❌ Truncation repair failed")
                        extracted_data = {"field_validations": []}
                else:
                    extracted_data = {"field_validations": []}
        
        field_validations = extracted_data.get('field_validations', [])
        
        # Check if we need continuation (truncation detected and repaired data available)
        needs_continuation = False
        continuation_info = None
        
        if original_response and field_validations:
            # Analyze if the response was truncated
            try:
                # Simple check: if response doesn't end with proper closing, it was likely truncated
                response_stripped = original_response.strip()
                if not (response_stripped.endswith(']}') or response_stripped.endswith(']\n}')):
                    logging.info("🔍 Truncation detected - analyzing continuation point")
                    continuation_info = analyze_truncation_point(original_response, extracted_data)
                    
                    if continuation_info:
                        needs_continuation = True
                        logging.info(f"🔄 Continuation needed - recovered {continuation_info['total_recovered']} validations")
                    
            except Exception as e:
                logging.warning(f"⚠️ Could not analyze truncation: {e}")
        
        # Perform continuation if needed
        final_extracted_data = extracted_data
        if needs_continuation and continuation_info:
            logging.info("🚀 Starting continuation extraction...")
            
            # Extract the original document text for continuation
            extracted_text = ""
            for doc in documents:
                if isinstance(doc.get('file_content'), str) and not doc['file_content'].startswith('data:'):
                    extracted_text += f"\\n\\n=== DOCUMENT: {doc.get('file_name', 'Unknown')} ===\\n{doc['file_content']}"
            
            # Perform continuation extraction
            continuation_result = perform_continuation_extraction(
                session_id=session_id,
                project_id=session["project_id"],
                extracted_text=extracted_text,
                schema_fields=schema_fields,
                collections=collections,
                knowledge_base=knowledge_base,
                extraction_rules=extraction_rules,
                previous_response=original_response,
                repaired_data=extracted_data
            )
            
            if continuation_result and continuation_result.get('success'):
                # Merge the results
                continuation_data = continuation_result['continuation_data']
                final_extracted_data = merge_extraction_results(extracted_data, continuation_data)
                
                logging.info(f"✅ Continuation successful - total validations: {len(final_extracted_data.get('field_validations', []))}")
            else:
                logging.warning("⚠️ Continuation failed - using repaired data only")
        
        # Update session with extraction results
        session["extracted_data"] = final_extracted_data
        session["status"] = 9  # Extraction completed
        storage.update_session(session_id, session)
        
        # Save field validations
        field_validations = final_extracted_data.get('field_validations', [])
        if field_validations:
            storage.save_field_validations(session_id, field_validations)
            logging.info(f"💾 Saved {len(field_validations)} field validations")
        
        response_data = {
            "success": True,
            "extracted_data": final_extracted_data,
            "field_count": len(field_validations),
            "input_tokens": extraction_result.input_token_count,
            "output_tokens": extraction_result.output_token_count
        }
        
        # Add continuation metadata if used
        if needs_continuation:
            response_data["continuation_used"] = True
            response_data["original_count"] = continuation_info.get('total_recovered', 0)
            
        logging.info(f"🎉 Enhanced extraction completed for session {session_id}")
        return jsonify(response_data)
        
    except Exception as e:
        logging.error(f"❌ Enhanced extraction error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
'''
    
    return enhanced_route_code

def show_integration_instructions():
    """Show instructions for integrating the continuation system"""
    
    print("🔧 AI Continuation System Integration")
    print("=" * 50)
    print()
    print("To integrate the continuation system into your main extraction route:")
    print()
    print("1. Replace the existing '/api/sessions/<session_id>/extract' route")
    print("   in your server/routes.ts file with the enhanced version above.")
    print()
    print("2. The enhanced route will automatically:")
    print("   ✓ Detect when AI responses are truncated")
    print("   ✓ Repair partial JSON using the repair_truncated_json function")
    print("   ✓ Analyze where truncation occurred")
    print("   ✓ Continue extraction from the truncation point")
    print("   ✓ Merge results from original and continuation extractions")
    print()
    print("3. No changes needed to the frontend - the API response")
    print("   format remains the same.")
    print()
    print("4. The system will log detailed information about:")
    print("   - Truncation detection")
    print("   - Repair attempts")
    print("   - Continuation progress")
    print("   - Final merged results")
    print()
    print("🎯 Benefits:")
    print("• Handles large datasets that exceed token limits")
    print("• Preserves all successfully extracted data")
    print("• Automatically resumes from truncation points")
    print("• No user intervention required")
    print("• Maintains data integrity throughout the process")

if __name__ == "__main__":
    show_integration_instructions()