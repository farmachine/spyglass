#!/usr/bin/env python3
"""
SIMPLIFIED PDF EXTRACTION SYSTEM
Direct PDF text extraction without complex AI processing
"""
import os
import json
import logging
from typing import Dict, Any, Optional
import base64
from io import BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO)

try:
    from google import genai
    from google.genai import types
except ImportError:
    logging.error("Google GenAI library not installed. Run: pip install google-genai")
    exit(1)

def extract_pdf_content(pdf_data: str, filename: str) -> Dict[str, Any]:
    """
    Extract text content from PDF using Gemini API
    Args:
        pdf_data: Base64 encoded PDF data
        filename: Name of the PDF file
    Returns:
        Dictionary with extraction results
    """
    try:
        logging.info(f"Starting PDF extraction for: {filename}")
        
        # Initialize Gemini client
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            return {"success": False, "error": "GEMINI_API_KEY not found"}
        
        client = genai.Client(api_key=api_key)
        
        # Convert base64 to bytes
        if pdf_data.startswith('data:application/pdf;base64,'):
            pdf_data = pdf_data.split(',')[1]
        
        pdf_bytes = base64.b64decode(pdf_data)
        logging.info(f"PDF size: {len(pdf_bytes)} bytes")
        
        # Simple extraction prompt
        prompt = """Extract all text content from this PDF document. 
        Return the complete text content exactly as it appears, preserving formatting and structure.
        Do not summarize or modify the content - extract everything."""
        
        # Send to Gemini
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(
                    data=pdf_bytes,
                    mime_type="application/pdf"
                ),
                prompt
            ],
            config=types.GenerateContentConfig(
                max_output_tokens=8192,
                temperature=0.1
            )
        )
        
        if response and response.text:
            extracted_text = response.text.strip()
            word_count = len(extracted_text.split())
            
            logging.info(f"Successfully extracted {word_count} words from {filename}")
            
            return {
                "success": True,
                "extracted_text": extracted_text,
                "word_count": word_count,
                "filename": filename
            }
        else:
            return {"success": False, "error": "No text content received from Gemini"}
            
    except Exception as e:
        logging.error(f"PDF extraction failed for {filename}: {str(e)}")
        return {"success": False, "error": str(e)}

def process_session_documents(session_id: str) -> Dict[str, Any]:
    """
    Process all documents for a session using simple extraction
    """
    try:
        # This would integrate with your existing storage system
        # For now, just return a template
        return {
            "success": True,
            "session_id": session_id,
            "message": "Use extract_pdf_content() for individual PDFs"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    # Test with a simple example
    logging.info("Simple PDF Extractor ready")
    print("Use extract_pdf_content(pdf_data, filename) to extract text from PDFs")