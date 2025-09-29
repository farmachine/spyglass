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

def merge_multirow_headers(rows):
    """
    Intelligently merge multi-row headers in Excel data.
    
    Detects header rows and combines them into a single header row,
    then returns the merged header plus all data rows.
    """
    if not rows:
        return rows
    
    # Determine header boundary - look for the first row that looks like data
    header_end_index = find_header_boundary(rows)
    
    if header_end_index <= 1:
        # Single header row or no headers detected, return as-is
        return rows
    
    # Extract header rows and data rows
    header_rows = rows[:header_end_index]
    data_rows = rows[header_end_index:]
    
    # Merge header rows into a single header
    merged_header = merge_header_rows(header_rows)
    
    # Return merged header + data rows
    return [merged_header] + data_rows

def find_header_boundary(rows):
    """
    Find where header rows end and data rows begin.
    
    Logic: Header rows typically have fewer non-blank cells per row
    and often contain descriptive text. Data rows are more uniform.
    """
    if len(rows) <= 1:
        return len(rows)
    
    # Analyze first few rows to detect patterns
    max_check_rows = min(5, len(rows))
    
    for i in range(1, max_check_rows):
        current_row = rows[i]
        prev_row = rows[i-1]
        
        # Count non-blank cells in each row
        current_non_blank = sum(1 for cell in current_row if cell != "blank")
        prev_non_blank = sum(1 for cell in prev_row if cell != "blank")
        
        # If current row has significantly more data than previous rows,
        # it's likely the start of data rows
        if current_non_blank > prev_non_blank * 1.5 and current_non_blank > len(current_row) * 0.7:
            return i
        
        # If we find a row where most columns have non-blank, consistent-looking data
        # (not header-like text), it's likely data
        if is_data_row(current_row):
            return i
    
    # Default: assume first row is header
    return 1

def is_data_row(row):
    """
    Check if a row looks like a data row rather than a header row.
    
    Data rows typically have:
    - Higher proportion of non-blank cells
    - Shorter cell values (not long descriptive text)
    - More uniform cell types
    """
    non_blank_cells = [cell for cell in row if cell != "blank"]
    
    if len(non_blank_cells) < len(row) * 0.5:
        return False  # Too many blanks for a data row
    
    # Check for typical data patterns (numbers, dates, short codes)
    data_like_count = 0
    for cell in non_blank_cells:
        if (cell.isdigit() or 
            len(cell) <= 20 or  # Short values are more data-like
            any(char.isdigit() for char in cell)):  # Contains numbers
            data_like_count += 1
    
    # If most cells look data-like, it's probably a data row
    return data_like_count >= len(non_blank_cells) * 0.6

def merge_header_rows(header_rows):
    """
    Merge multiple header rows into a single header row.
    
    For each column position, combine text from all header rows
    where that column has non-blank values.
    """
    if not header_rows:
        return []
    
    num_columns = max(len(row) for row in header_rows)
    merged_header = []
    
    for col_index in range(num_columns):
        # Collect all non-blank values from this column across header rows
        column_parts = []
        
        for row in header_rows:
            if col_index < len(row) and row[col_index] != "blank":
                column_parts.append(row[col_index])
        
        # Combine the parts with spaces
        if column_parts:
            merged_header.append(" ".join(column_parts))
        else:
            merged_header.append("blank")
    
    return merged_header

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
                
                # Get the actual dimensions to preserve grid structure
                max_row = worksheet.max_row
                max_col = worksheet.max_column
                
                # Smart header detection and multi-row header merging
                all_rows = []
                for row_num in range(1, max_row + 1):
                    row_data = []
                    for col_num in range(1, max_col + 1):
                        cell_value = worksheet.cell(row=row_num, column=col_num).value
                        if cell_value is not None and str(cell_value).strip():
                            row_data.append(str(cell_value))
                        else:
                            row_data.append("blank")
                    
                    # Only include non-empty rows
                    if any(cell != "blank" for cell in row_data):
                        all_rows.append(row_data)
                
                if all_rows:
                    # Detect header rows and merge multi-row headers
                    merged_rows = merge_multirow_headers(all_rows)
                    for row in merged_rows:
                        text_parts.append("\t".join(row))
            
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
                    
                    # Get consistent column count for grid structure
                    max_cols = sheet.ncols
                    
                    # Smart header detection and multi-row header merging
                    all_rows = []
                    for row_index in range(sheet.nrows):
                        row_data = []
                        for col_index in range(max_cols):
                            try:
                                cell_value = sheet.cell_value(row_index, col_index)
                                if cell_value is not None and str(cell_value).strip():
                                    row_data.append(str(cell_value))
                                else:
                                    row_data.append("blank")
                            except:
                                row_data.append("blank")
                        
                        # Only include non-empty rows
                        if any(cell != "blank" for cell in row_data):
                            all_rows.append(row_data)
                    
                    if all_rows:
                        # Detect header rows and merge multi-row headers
                        merged_rows = merge_multirow_headers(all_rows)
                        for row in merged_rows:
                            text_parts.append("\t".join(row))
                
                os.unlink(tmp_file.name)
                return "\n".join(text_parts)
                
        except Exception as xls_error:
            # Final fallback using pandas
            try:
                excel_data = pd.read_excel(io.BytesIO(file_content), sheet_name=None)
                
                for sheet_name, df in excel_data.items():
                    text_parts.append(f"=== Sheet: {sheet_name} ===")
                    
                    # Include headers with consistent column count
                    headers = df.columns.tolist()
                    text_parts.append("\t".join(str(h) for h in headers))
                    
                    # Include ALL data rows with consistent column count
                    for _, row in df.iterrows():
                        # Ensure every row has same number of columns as headers
                        row_data = []
                        for val in row.values:
                            if pd.notna(val) and str(val).strip():
                                row_data.append(str(val))
                            else:
                                row_data.append("blank")
                        
                        # Only skip completely empty rows (all blanks)
                        if any(cell != "blank" for cell in row_data):
                            text_parts.append("\t".join(row_data))
                
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
        
        if step not in ['extract_text_only', 'extract']:
            print(json.dumps({
                'success': False,
                'error': f'Unsupported step: {step}. Only "extract_text_only" and "extract" are supported.'
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