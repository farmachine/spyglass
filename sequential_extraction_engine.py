#!/usr/bin/env python3
"""
Sequential Extraction Engine
Processes extraction fields in order: identifier first, then subsequent fields using identifier references
"""

import json
import sys
import os
import time
import psycopg2
from google import genai
from all_prompts import DOCUMENT_FORMAT_ANALYSIS, EXCEL_FUNCTION_GENERATOR
# Import correct wizardry functions based on available modules
try:
    from excel_wizard import excel_column_extraction
except ImportError:
    print("Warning: excel_wizard module not found, using extraction_wizardry", file=sys.stderr)
    excel_column_extraction = None

try:
    from ai_extraction_wizard import ai_document_extraction
except ImportError:
    print("Warning: ai_extraction_wizard module not found, will use alternative", file=sys.stderr)
    ai_document_extraction = None

class SequentialExtractionEngine:
    """Engine that processes extraction fields sequentially"""
    
    def __init__(self):
        self.validation_results = []
        self.identifier_references = []
        self.processed_fields = []
        
    def sort_fields_by_extraction_order(self, target_fields_data):
        """Sort fields for extraction: identifier first, then by order_index"""
        if not target_fields_data:
            return []
            
        # Separate identifier and non-identifier fields
        identifier_fields = []
        other_fields = []
        
        for field in target_fields_data:
            if field.get('is_identifier', False):
                identifier_fields.append(field)
            else:
                other_fields.append(field)
        
        # Sort identifier fields by order_index (should typically be just one)
        identifier_fields.sort(key=lambda x: x.get('order_index', 0))
        
        # Sort other fields by order_index
        other_fields.sort(key=lambda x: x.get('order_index', 0))
        
        # Return identifier first, then others
        return identifier_fields + other_fields
    
    def create_identifier_references_from_validation(self, validation_results, identifier_field):
        """Create identifier references from the validation results of the identifier field"""
        identifier_references = []
        
        if not validation_results:
            print("WARNING: No validation results for identifier field")
            return identifier_references
            
        for i, result in enumerate(validation_results):
            if isinstance(result, dict):
                # Extract the identifier value
                identifier_value = result.get('extracted_value', '')
                
                identifier_ref = {
                    'record_index': i,
                    'identifier_field': identifier_field.get('property_name', identifier_field.get('name', '')),
                    'identifier_value': identifier_value,
                    'field_id': identifier_field.get('id', ''),
                    'collection_id': identifier_field.get('collection_id', ''),
                    'collection_name': identifier_field.get('collection_name', '')
                }
                
                identifier_references.append(identifier_ref)
        
        print(f"Created {len(identifier_references)} identifier references")
        return identifier_references
    
    def create_field_context_with_identifiers(self, current_field, identifier_references):
        """Create context for field extraction that includes identifier references"""
        if not identifier_references:
            return current_field
            
        # Clone the field data
        field_with_context = current_field.copy()
        
        # Add identifier context
        field_with_context['identifier_references'] = identifier_references
        field_with_context['extraction_context'] = {
            'total_records': len(identifier_references),
            'identifier_field': identifier_references[0].get('identifier_field', '') if identifier_references else '',
            'record_identifiers': [ref.get('identifier_value', '') for ref in identifier_references]
        }
        
        return field_with_context
    
    def determine_extraction_method(self, documents, field_data):
        """Determine whether to use Excel wizardry or AI extraction for this field"""
        # Check if any document is Excel-based
        has_excel = any(
            doc.get('type', '').startswith('application/vnd.openxmlformats-officedocument.spreadsheetml') or
            doc.get('type', '').startswith('application/vnd.ms-excel') or
            doc.get('name', '').lower().endswith(('.xlsx', '.xls'))
            for doc in documents
        )
        
        # For Excel documents, prefer Excel wizardry for structured data
        if has_excel:
            field_type = field_data.get('property_type', '').lower()
            # Use Excel wizardry for structured fields that are likely to be in columns
            if field_type in ['text', 'number', 'date', 'boolean']:
                return 'excel_wizardry'
        
        # Default to AI extraction for complex or unstructured fields
        return 'ai_extraction'
    
    def extract_single_field(self, documents, field_data, identifier_references=None):
        """Extract a single field using the appropriate method"""
        try:
            print(f"\n{'='*60}")
            print(f"EXTRACTING FIELD: {field_data.get('property_name', field_data.get('name', 'Unknown'))}")
            print(f"Field Type: {field_data.get('property_type', 'Unknown')}")
            print(f"Is Identifier: {field_data.get('is_identifier', False)}")
            print(f"Order Index: {field_data.get('order_index', 0)}")
            if identifier_references:
                print(f"Processing {len(identifier_references)} identifier references")
            print(f"{'='*60}")
            
            # Determine extraction method
            extraction_method = self.determine_extraction_method(documents, field_data)
            print(f"Using extraction method: {extraction_method}")
            
            # Prepare field context with identifiers if available
            if identifier_references:
                field_with_context = self.create_field_context_with_identifiers(field_data, identifier_references)
            else:
                field_with_context = field_data
            
            # Execute extraction based on method
            if extraction_method == 'excel_wizardry':
                return self.extract_with_excel_wizardry(documents, field_with_context)
            else:
                return self.extract_with_ai_extraction(documents, field_with_context)
                
        except Exception as e:
            print(f"ERROR in extract_single_field: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'validation_results': []
            }
    
    def extract_with_excel_wizardry(self, documents, field_data):
        """Extract using Excel wizardry functions - direct implementation"""
        try:
            print("Using Excel Wizardry extraction...")
            
            # Direct Excel extraction implementation for sequential processing
            validation_results = []
            
            for doc in documents:
                if not self.is_excel_document(doc):
                    continue
                    
                # Parse Excel content from document
                content = doc.get('contentPreview', '')
                if not content:
                    continue
                
                # For identifier fields, extract all values
                if field_data.get('is_identifier', False):
                    extracted_values = self.extract_excel_column_values(content, field_data)
                    
                    for i, value in enumerate(extracted_values):
                        validation_results.append({
                            'validation_type': 'excel_extracted',
                            'data_type': field_data.get('property_type', 'text'),
                            'field_name': field_data.get('property_name', field_data.get('name', '')),
                            'collection_name': field_data.get('collection_name', ''),
                            'extracted_value': value,
                            'confidence_score': 0.9 if value else 0.1,
                            'validation_status': 'unverified',
                            'ai_reasoning': f'Excel extraction for identifier field',
                            'record_index': i,
                            'field_id': field_data.get('id', '')
                        })
                        
                # For regular fields with identifier references
                elif 'identifier_references' in field_data and field_data['identifier_references']:
                    identifier_refs = field_data['identifier_references']
                    extracted_values = self.extract_excel_column_values(content, field_data)
                    
                    # Match extracted values to identifier references by record index
                    for i, identifier_ref in enumerate(identifier_refs):
                        record_index = identifier_ref.get('record_index', i)
                        extracted_value = extracted_values[record_index] if record_index < len(extracted_values) else None
                        
                        validation_results.append({
                            'validation_type': 'excel_extracted',
                            'data_type': field_data.get('property_type', 'text'),
                            'field_name': field_data.get('property_name', field_data.get('name', '')),
                            'collection_name': identifier_ref.get('collection_name', ''),
                            'extracted_value': extracted_value,
                            'confidence_score': 0.9 if extracted_value else 0.1,
                            'validation_status': 'unverified',
                            'ai_reasoning': f'Excel extraction for field linked to identifier: {identifier_ref.get("identifier_value", "")}',
                            'record_index': record_index,
                            'field_id': field_data.get('id', ''),
                            'identifier_reference': identifier_ref
                        })
                
                else:
                    # Regular field without identifier references
                    extracted_values = self.extract_excel_column_values(content, field_data)
                    
                    for i, value in enumerate(extracted_values):
                        validation_results.append({
                            'validation_type': 'excel_extracted',
                            'data_type': field_data.get('property_type', 'text'),
                            'field_name': field_data.get('property_name', field_data.get('name', '')),
                            'collection_name': field_data.get('collection_name', ''),
                            'extracted_value': value,
                            'confidence_score': 0.9 if value else 0.1,
                            'validation_status': 'unverified',
                            'ai_reasoning': f'Excel extraction for regular field',
                            'record_index': i,
                            'field_id': field_data.get('id', '')
                        })
            
            return {
                'success': True,
                'validation_results': validation_results,
                'extraction_method': 'excel_wizardry'
            }
                
        except Exception as e:
            print(f"Excel wizardry extraction error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'validation_results': []
            }
    
    def is_excel_document(self, doc):
        """Check if document is an Excel file"""
        doc_type = doc.get('type', '').lower()
        doc_name = doc.get('name', '').lower()
        
        return (doc_type.startswith('application/vnd.openxmlformats-officedocument.spreadsheetml') or
                doc_type.startswith('application/vnd.ms-excel') or
                doc_name.endswith('.xlsx') or doc_name.endswith('.xls'))
    
    def extract_excel_column_values(self, content, field_data):
        """Extract column values from Excel content based on field data"""
        try:
            field_name = field_data.get('property_name', field_data.get('name', ''))
            
            # Parse Excel content (assuming it's in tab-separated format with sheet names)
            lines = content.strip().split('\n')
            if not lines:
                return []
            
            values = []
            current_sheet_data = []
            
            for line in lines:
                # Skip sheet headers (lines starting with "Sheet:")
                if line.startswith('Sheet:'):
                    continue
                    
                # Split line by tabs
                columns = line.split('\t')
                current_sheet_data.append(columns)
            
            if not current_sheet_data:
                return []
            
            # Assume first row contains headers
            if len(current_sheet_data) > 1:
                headers = [col.strip() for col in current_sheet_data[0]]
                
                # Find column index for field name (try different matching strategies)
                column_index = -1
                
                # Exact match
                for i, header in enumerate(headers):
                    if header.lower() == field_name.lower():
                        column_index = i
                        break
                
                # Partial match
                if column_index == -1:
                    for i, header in enumerate(headers):
                        if field_name.lower() in header.lower() or header.lower() in field_name.lower():
                            column_index = i
                            break
                
                # If still not found, use first column as fallback for identifier fields
                if column_index == -1 and field_data.get('is_identifier', False):
                    column_index = 0
                
                # Extract values from the identified column
                if column_index >= 0:
                    for row in current_sheet_data[1:]:  # Skip header row
                        if column_index < len(row):
                            value = row[column_index].strip()
                            values.append(value if value else None)
                        else:
                            values.append(None)
            
            print(f"Extracted {len(values)} values for field '{field_name}' from Excel content")
            return values
            
        except Exception as e:
            print(f"Error extracting Excel column values: {str(e)}")
            return []
    
    def extract_with_ai_extraction(self, documents, field_data):
        """Extract using AI document extraction"""
        try:
            print("Using AI extraction...")
            
            # Call ai_document_extraction with single field
            target_fields = [field_data]
            result = ai_document_extraction(target_fields, documents)
            
            if isinstance(result, dict) and result.get('success', False):
                validation_results = result.get('validation_results', [])
                
                # If we have identifier references, ensure we create validations for each identifier
                if 'identifier_references' in field_data and field_data['identifier_references']:
                    validation_results = self.ensure_validations_for_identifiers(
                        validation_results, field_data
                    )
                
                return {
                    'success': True,
                    'validation_results': validation_results,
                    'extraction_method': 'ai_extraction'
                }
            else:
                return {
                    'success': False,
                    'error': result.get('error', 'AI extraction failed'),
                    'validation_results': []
                }
                
        except Exception as e:
            print(f"AI extraction error: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'validation_results': []
            }
    
    def ensure_validations_for_identifiers(self, validation_results, field_data):
        """Ensure we have validation results for each identifier reference"""
        identifier_references = field_data.get('identifier_references', [])
        if not identifier_references:
            return validation_results
            
        print(f"Ensuring validations for {len(identifier_references)} identifier references")
        
        # Create a map of existing validations by record_index
        existing_validations = {}
        for validation in validation_results:
            if isinstance(validation, dict):
                record_index = validation.get('record_index', 0)
                existing_validations[record_index] = validation
        
        # Ensure we have a validation for each identifier reference
        complete_validations = []
        for i, identifier_ref in enumerate(identifier_references):
            record_index = identifier_ref.get('record_index', i)
            
            if record_index in existing_validations:
                # Use existing validation
                complete_validations.append(existing_validations[record_index])
            else:
                # Create null validation for missing identifier
                null_validation = {
                    'validation_type': 'ai_extracted',
                    'data_type': field_data.get('property_type', 'text'),
                    'field_name': field_data.get('property_name', field_data.get('name', '')),
                    'collection_name': identifier_ref.get('collection_name', ''),
                    'extracted_value': None,
                    'confidence_score': 0.0,
                    'validation_status': 'needs_review',
                    'ai_reasoning': f"No value found for identifier: {identifier_ref.get('identifier_value', '')}",
                    'record_index': record_index,
                    'identifier_reference': identifier_ref
                }
                complete_validations.append(null_validation)
                print(f"Created null validation for record_index {record_index}")
        
        return complete_validations
    
    def run_sequential_extraction(self, documents, target_fields_data, session_id):
        """Run the full sequential extraction process"""
        try:
            print(f"\n{'='*80}")
            print("STARTING SEQUENTIAL EXTRACTION ENGINE")
            print(f"{'='*80}")
            print(f"Documents: {len(documents)}")
            print(f"Target Fields: {len(target_fields_data)}")
            print(f"Session ID: {session_id}")
            
            # Reset state
            self.validation_results = []
            self.identifier_references = []
            self.processed_fields = []
            
            # Sort fields for extraction order
            sorted_fields = self.sort_fields_by_extraction_order(target_fields_data)
            print(f"Field extraction order:")
            for i, field in enumerate(sorted_fields):
                field_name = field.get('property_name', field.get('name', 'Unknown'))
                is_identifier = field.get('is_identifier', False)
                order_index = field.get('order_index', 0)
                print(f"  {i+1}. {field_name} (order: {order_index}) {'[IDENTIFIER]' if is_identifier else ''}")
            
            # Process each field sequentially
            for field_index, field_data in enumerate(sorted_fields):
                field_name = field_data.get('property_name', field_data.get('name', 'Unknown'))
                is_identifier = field_data.get('is_identifier', False)
                
                print(f"\n{'='*60}")
                print(f"PROCESSING FIELD {field_index + 1}/{len(sorted_fields)}: {field_name}")
                print(f"{'='*60}")
                
                # For identifier field, don't pass identifier references (it creates them)
                if is_identifier:
                    print("Processing identifier field (will create identifier references)")
                    extraction_result = self.extract_single_field(documents, field_data)
                else:
                    print(f"Processing regular field with {len(self.identifier_references)} identifier references")
                    extraction_result = self.extract_single_field(documents, field_data, self.identifier_references)
                
                # Process extraction result
                if extraction_result.get('success', False):
                    field_validations = extraction_result.get('validation_results', [])
                    
                    # Add field validations to overall results
                    self.validation_results.extend(field_validations)
                    
                    # If this was the identifier field, create identifier references
                    if is_identifier:
                        self.identifier_references = self.create_identifier_references_from_validation(
                            field_validations, field_data
                        )
                        print(f"Created {len(self.identifier_references)} identifier references")
                    
                    # Track processed field
                    self.processed_fields.append({
                        'field_name': field_name,
                        'extraction_method': extraction_result.get('extraction_method', 'unknown'),
                        'validations_count': len(field_validations),
                        'success': True
                    })
                    
                    print(f"✅ Successfully processed {field_name}: {len(field_validations)} validations")
                    
                else:
                    error_msg = extraction_result.get('error', 'Unknown error')
                    print(f"❌ Failed to process {field_name}: {error_msg}")
                    
                    # Track failed field
                    self.processed_fields.append({
                        'field_name': field_name,
                        'extraction_method': 'failed',
                        'validations_count': 0,
                        'success': False,
                        'error': error_msg
                    })
            
            # Calculate summary statistics
            total_validations = len(self.validation_results)
            successful_fields = len([f for f in self.processed_fields if f['success']])
            failed_fields = len([f for f in self.processed_fields if not f['success']])
            
            print(f"\n{'='*80}")
            print("SEQUENTIAL EXTRACTION COMPLETED")
            print(f"{'='*80}")
            print(f"Fields processed: {len(self.processed_fields)}")
            print(f"Successful: {successful_fields}")
            print(f"Failed: {failed_fields}")
            print(f"Total validations created: {total_validations}")
            print(f"Identifier references: {len(self.identifier_references)}")
            
            # Expected validations calculation
            if self.identifier_references:
                expected_validations = len(self.identifier_references) * len(sorted_fields)
                print(f"Expected validations: {expected_validations} ({len(self.identifier_references)} records × {len(sorted_fields)} fields)")
                print(f"Coverage: {(total_validations/expected_validations*100):.1f}%" if expected_validations > 0 else "Coverage: N/A")
            
            return {
                'success': True,
                'message': 'Sequential extraction completed',
                'validation_results': self.validation_results,
                'identifier_references': self.identifier_references,
                'processed_fields': self.processed_fields,
                'summary': {
                    'total_fields': len(sorted_fields),
                    'successful_fields': successful_fields,
                    'failed_fields': failed_fields,
                    'total_validations': total_validations,
                    'identifier_count': len(self.identifier_references)
                }
            }
            
        except Exception as e:
            print(f"ERROR in run_sequential_extraction: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'validation_results': self.validation_results,
                'identifier_references': self.identifier_references,
                'processed_fields': self.processed_fields
            }

def main():
    """Main function for sequential extraction"""
    try:
        # Read input JSON
        if len(sys.argv) > 1:
            input_data = json.loads(sys.argv[1])
        else:
            input_data = json.loads(sys.stdin.read())
        
        documents = input_data.get('documents', [])
        target_fields_data = input_data.get('target_fields_data', [])
        session_id = input_data.get('session_id', '')
        
        # Create and run sequential extraction engine
        engine = SequentialExtractionEngine()
        result = engine.run_sequential_extraction(documents, target_fields_data, session_id)
        
        # Output result
        print(json.dumps(result, indent=2))
        
    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'error': f'JSON decode error: {str(e)}'
        }))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Sequential extraction failed: {str(e)}'
        }))

if __name__ == "__main__":
    main()