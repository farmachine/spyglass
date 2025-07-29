#!/usr/bin/env python3

import base64
import json
import tempfile
import os

def test_pdf_processing():
    print("=== TESTING PDF PROCESSING METHODS ===")
    
    # Use the Bryter PDF from attached_assets
    pdf_path = "attached_assets/Bryter-HB-20262-19-Apr-2022-15-45-48-signed_1752832473278.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"PDF file not found: {pdf_path}")
        return
    
    # Read the PDF file
    with open(pdf_path, 'rb') as f:
        binary_content = f.read()
    
    print(f"PDF file size: {len(binary_content)} bytes")
    
    # Test Method 1: PyPDF2
    print("\n--- Testing PyPDF2 ---")
    try:
        import PyPDF2
        import io
        
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(binary_content))
        text_content = ""
        
        print(f"Number of pages: {len(pdf_reader.pages)}")
        
        for i, page in enumerate(pdf_reader.pages):
            page_text = page.extract_text()
            text_content += page_text + "\n"
            print(f"Page {i+1} text length: {len(page_text)}")
        
        if text_content.strip():
            print(f"✅ PyPDF2 SUCCESS: {len(text_content)} characters extracted")
            print(f"First 200 chars: {text_content[:200]}...")
        else:
            print("❌ PyPDF2 FAILED: No text extracted")
            
    except Exception as e:
        print(f"❌ PyPDF2 ERROR: {e}")
    
    # Test Method 2: pdf2image
    print("\n--- Testing pdf2image ---")
    try:
        from pdf2image import convert_from_bytes
        
        for dpi in [200, 150, 100]:
            try:
                images = convert_from_bytes(binary_content, dpi=dpi, first_page=1, last_page=2)
                if images:
                    print(f"✅ pdf2image SUCCESS at {dpi} DPI: {len(images)} pages converted")
                    print(f"First image size: {images[0].size}")
                    break
            except Exception as dpi_error:
                print(f"❌ pdf2image FAILED at {dpi} DPI: {dpi_error}")
                continue
    except Exception as e:
        print(f"❌ pdf2image ERROR: {e}")

if __name__ == "__main__":
    test_pdf_processing()