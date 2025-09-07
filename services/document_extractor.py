#!/usr/bin/env python3
"""
Document Text Extraction Script
Handles PDF, Excel, and Word document text extraction for the Extractly platform.
"""

import sys
import json
import base64
import io
import tempfile
import os
from typing import List, Dict, Any

# Document processing libraries
try:
    import PyPDF2
    import pandas as pd
    from docx import Document
    import xlrd
    from openpyxl import load_workbook
except ImportError as e:
    print(f"Error: Missing required library: {e}", file=sys.stderr)
    sys.exit(1)

def extract_pdf_text(file_content: bytes) -> str:
    """Extract text from PDF file."""
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"PDF extraction failed: {str(e)}")

def extract_docx_text(file_content: bytes) -> str:
    """Extract text from DOCX file."""
    try:
        doc = Document(io.BytesIO(file_content))
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        
        # Also extract from tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    text += cell.text + "\t"
                text += "\n"
        
        return text.strip()
    except Exception as e:
        raise Exception(f"DOCX extraction failed: {str(e)}")

def extract_excel_text(file_content: bytes, file_name: str) -> str:
    """Extract text from Excel file (both .xls and .xlsx) - extracts ALL rows."""
    text_parts = []
    
    # Try modern Excel format first (.xlsx)
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
            tmp_file.write(file_content)
            tmp_file.flush()
            
            workbook = load_workbook(tmp_file.name, data_only=True)
            
            for sheet_name in workbook.sheetnames:
                worksheet = workbook[sheet_name]
                text_parts.append(f"=== Sheet: {sheet_name} ===")
                
                # Extract ALL rows, not just a sample
                for row in worksheet.iter_rows(values_only=True):
                    row_text = []
                    for cell in row:
                        if cell is not None:
                            row_text.append(str(cell))
                    if row_text:  # Only add non-empty rows
                        text_parts.append("\t".join(row_text))
            
            os.unlink(tmp_file.name)
            return "\n".join(text_parts)
            
    except Exception:
        # Fall back to older Excel format (.xls)
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix='.xls') as tmp_file:
                tmp_file.write(file_content)
                tmp_file.flush()
                
                workbook = xlrd.open_workbook(tmp_file.name)
                
                for sheet_index in range(workbook.nsheets):
                    sheet = workbook.sheet_by_index(sheet_index)
                    text_parts.append(f"=== Sheet: {sheet.name} ===")
                    
                    # Extract ALL rows, not just a sample
                    for row_index in range(sheet.nrows):
                        row_values = sheet.row_values(row_index)
                        row_text = [str(val) for val in row_values if val]
                        if row_text:
                            text_parts.append("\t".join(row_text))
                
                os.unlink(tmp_file.name)
                return "\n".join(text_parts)
                
        except Exception as xls_error:
            # Final fallback using pandas
            try:
                excel_data = pd.read_excel(io.BytesIO(file_content), sheet_name=None)
                
                for sheet_name, df in excel_data.items():
                    text_parts.append(f"=== Sheet: {sheet_name} ===")
                    
                    # Include headers
                    headers = df.columns.tolist()
                    text_parts.append("\t".join(str(h) for h in headers))
                    
                    # Include ALL data rows, not just a sample
                    for _, row in df.iterrows():
                        row_text = [str(val) for val in row.values if pd.notna(val)]
                        if row_text:
                            text_parts.append("\t".join(row_text))
                
                return "\n".join(text_parts)
                
            except Exception as pandas_error:
                raise Exception(f"Excel extraction failed with all methods. XLS error: {str(xls_error)}, Pandas error: {str(pandas_error)}")

def extract_text_from_document(file_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract text from a single document."""
    file_name = file_data.get('file_name', '')
    file_content_b64 = file_data.get('file_content', '')
    mime_type = file_data.get('mime_type', '')
    
    # Handle data URL format (data:mime/type;base64,content)
    if file_content_b64.startswith('data:'):
        # Split off the data URL prefix
        _, file_content_b64 = file_content_b64.split(',', 1)
    
    try:
        file_content = base64.b64decode(file_content_b64)
    except Exception as e:
        return {
            'file_name': file_name,
            'text_content': '',
            'error': f'Base64 decode failed: {str(e)}',
            'file_size': 0,
            'word_count': 0,
            'extraction_method': 'failed'
        }
    
    file_size = len(file_content)
    
    try:
        # Determine extraction method based on MIME type and file extension
        file_ext = os.path.splitext(file_name.lower())[1]
        
        if mime_type == 'application/pdf' or file_ext == '.pdf':
            extracted_text = extract_pdf_text(file_content)
        elif mime_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'] or file_ext in ['.docx', '.doc']:
            extracted_text = extract_docx_text(file_content)
        elif mime_type in ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'] or file_ext in ['.xlsx', '.xls']:
            extracted_text = extract_excel_text(file_content, file_name)
        else:
            return {
                'file_name': file_name,
                'text_content': '',
                'error': f'Unsupported file type: {mime_type} ({file_ext})',
                'file_size': file_size,
                'word_count': 0,
                'extraction_method': 'unsupported'
            }
        
        return {
            'file_name': file_name,
            'text_content': extracted_text,
            'file_size': file_size,
            'mime_type': mime_type,
            'word_count': len(extracted_text.split()) if extracted_text else 0,
            'extraction_method': 'direct'
        }
        
    except Exception as e:
        return {
            'file_name': file_name,
            'text_content': '',
            'error': str(e),
            'file_size': file_size,
            'mime_type': mime_type,
            'word_count': 0,
            'extraction_method': 'failed'
        }

def main():
    """Main function to process extraction requests."""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        request = json.loads(input_data)
        
        step = request.get('step', '')
        documents = request.get('documents', [])
        
        if step != 'extract_text_only':
            print(json.dumps({
                'success': False,
                'error': f'Unsupported step: {step}. Only "extract_text_only" is supported.'
            }))
            return
        
        # Process each document
        extracted_texts = []
        for doc in documents:
            result = extract_text_from_document(doc)
            extracted_texts.append(result)
        
        # Return results
        output = {
            'success': True,
            'extracted_texts': extracted_texts
        }
        
        print(json.dumps(output))
        
    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'error': f'Invalid JSON input: {str(e)}'
        }))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Processing failed: {str(e)}'
        }), file=sys.stderr)

if __name__ == '__main__':
    main()