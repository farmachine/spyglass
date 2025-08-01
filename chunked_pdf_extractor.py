#!/usr/bin/env python3
"""
CHUNKED PDF EXTRACTION SYSTEM
Processes large PDFs in chunks to avoid token limits and timeouts
"""
import os
import json
import logging
import base64
import math
from typing import Dict, Any, List, Optional
from io import BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO)

try:
    from google import genai
    from google.genai import types
    import PyPDF2
    from pdf2image import convert_from_bytes
except ImportError as e:
    logging.error(f"Required library not installed: {e}")
    logging.error("Run: pip install google-genai PyPDF2 pdf2image")
    exit(1)

class ChunkedPDFExtractor:
    def __init__(self, api_key: str = None):
        """Initialize the chunked PDF extractor"""
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found")
        
        self.client = genai.Client(api_key=self.api_key)
        self.max_tokens_per_chunk = 800000  # Conservative limit for gemini-2.5-pro
        self.max_pages_per_chunk = 10  # Process in smaller page chunks
        
    def estimate_pdf_size(self, pdf_bytes: bytes) -> Dict[str, int]:
        """Estimate PDF processing requirements"""
        try:
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_bytes))
            total_pages = len(pdf_reader.pages)
            
            # Estimate tokens based on file size and pages
            file_size_mb = len(pdf_bytes) / (1024 * 1024)
            estimated_tokens = int(file_size_mb * 100000)  # Rough estimate
            
            return {
                "total_pages": total_pages,
                "file_size_mb": file_size_mb,
                "estimated_tokens": estimated_tokens,
                "needs_chunking": estimated_tokens > self.max_tokens_per_chunk or total_pages > self.max_pages_per_chunk
            }
        except Exception as e:
            logging.warning(f"Could not analyze PDF structure: {e}")
            # Fallback to file size estimation
            file_size_mb = len(pdf_bytes) / (1024 * 1024)
            return {
                "total_pages": -1,
                "file_size_mb": file_size_mb,
                "estimated_tokens": int(file_size_mb * 100000),
                "needs_chunking": file_size_mb > 5  # Chunk if larger than 5MB
            }
    
    def split_pdf_by_pages(self, pdf_bytes: bytes, pages_per_chunk: int = None) -> List[bytes]:
        """Split PDF into smaller chunks by pages"""
        if pages_per_chunk is None:
            pages_per_chunk = self.max_pages_per_chunk
            
        try:
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_bytes))
            total_pages = len(pdf_reader.pages)
            chunks = []
            
            for start_page in range(0, total_pages, pages_per_chunk):
                end_page = min(start_page + pages_per_chunk, total_pages)
                
                # Create new PDF with selected pages
                pdf_writer = PyPDF2.PdfWriter()
                for page_num in range(start_page, end_page):
                    pdf_writer.add_page(pdf_reader.pages[page_num])
                
                # Convert to bytes
                chunk_buffer = BytesIO()
                pdf_writer.write(chunk_buffer)
                chunk_bytes = chunk_buffer.getvalue()
                chunks.append(chunk_bytes)
                
                logging.info(f"Created chunk {len(chunks)}: pages {start_page + 1}-{end_page}")
            
            return chunks
            
        except Exception as e:
            logging.error(f"Failed to split PDF by pages: {e}")
            # Fallback: split by file size
            return self.split_pdf_by_size(pdf_bytes)
    
    def split_pdf_by_size(self, pdf_bytes: bytes, max_chunk_size: int = 4 * 1024 * 1024) -> List[bytes]:
        """Fallback: split PDF by file size (crude but works)"""
        chunks = []
        total_size = len(pdf_bytes)
        
        for start in range(0, total_size, max_chunk_size):
            end = min(start + max_chunk_size, total_size)
            chunk = pdf_bytes[start:end]
            chunks.append(chunk)
            logging.info(f"Created size-based chunk {len(chunks)}: {len(chunk)} bytes")
        
        return chunks
    
    def extract_chunk(self, chunk_bytes: bytes, chunk_index: int, total_chunks: int, filename: str) -> Dict[str, Any]:
        """Extract text from a single PDF chunk"""
        try:
            chunk_size_mb = len(chunk_bytes) / (1024 * 1024)
            logging.info(f"Processing chunk {chunk_index + 1}/{total_chunks} ({chunk_size_mb:.2f}MB) for {filename}")
            
            prompt = f"""Extract all text content from this PDF chunk ({chunk_index + 1} of {total_chunks}).

INSTRUCTIONS:
- Extract all readable text from every page in this chunk
- Preserve document structure and formatting where possible
- Include headers, body text, tables, lists, and any other textual content
- Maintain logical flow and organization of information
- Focus on key data points and structured information
- If this is part of a larger document, extract complete sections when possible

CONTEXT: This is chunk {chunk_index + 1} of {total_chunks} from document: {filename}

RETURN: Complete text content from this PDF chunk."""

            response = self.client.models.generate_content(
                model="gemini-2.5-pro",
                contents=[
                    types.Part.from_bytes(
                        data=chunk_bytes,
                        mime_type="application/pdf"
                    ),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    max_output_tokens=65536,  # Max output for gemini-2.5-pro
                    temperature=0.1
                ),
                request_options={"timeout": 300}  # 5-minute timeout per chunk
            )
            
            if response and response.text:
                extracted_text = response.text.strip()
                word_count = len(extracted_text.split())
                
                logging.info(f"Successfully extracted {word_count} words from chunk {chunk_index + 1}")
                
                return {
                    "success": True,
                    "chunk_index": chunk_index,
                    "extracted_text": extracted_text,
                    "word_count": word_count,
                    "chunk_size_mb": chunk_size_mb
                }
            else:
                return {
                    "success": False,
                    "chunk_index": chunk_index,
                    "error": "No text content received from Gemini",
                    "chunk_size_mb": chunk_size_mb
                }
                
        except Exception as e:
            logging.error(f"Chunk {chunk_index + 1} extraction failed: {str(e)}")
            return {
                "success": False,
                "chunk_index": chunk_index,
                "error": str(e),
                "chunk_size_mb": len(chunk_bytes) / (1024 * 1024)
            }
    
    def extract_pdf_chunked(self, pdf_data: str, filename: str) -> Dict[str, Any]:
        """Extract text from PDF using chunking approach"""
        try:
            logging.info(f"Starting chunked PDF extraction for: {filename}")
            
            # Convert base64 to bytes
            if pdf_data.startswith('data:application/pdf;base64,'):
                pdf_data = pdf_data.split(',')[1]
            
            pdf_bytes = base64.b64decode(pdf_data)
            
            # Analyze PDF size and determine if chunking is needed
            pdf_info = self.estimate_pdf_size(pdf_bytes)
            logging.info(f"PDF Analysis: {pdf_info}")
            
            if not pdf_info["needs_chunking"]:
                # Small PDF - process normally
                logging.info("PDF is small enough for single-pass processing")
                return self.extract_single_pdf(pdf_bytes, filename)
            
            # Large PDF - use chunking
            logging.info("PDF requires chunking for processing")
            chunks = self.split_pdf_by_pages(pdf_bytes)
            
            if not chunks:
                return {
                    "success": False,
                    "error": "Failed to create PDF chunks",
                    "filename": filename
                }
            
            # Process each chunk
            chunk_results = []
            total_text = ""
            total_words = 0
            
            for i, chunk_bytes in enumerate(chunks):
                result = self.extract_chunk(chunk_bytes, i, len(chunks), filename)
                chunk_results.append(result)
                
                if result["success"]:
                    chunk_text = result["extracted_text"]
                    total_text += f"\n\n=== CHUNK {i + 1} OF {len(chunks)} ===\n{chunk_text}"
                    total_words += result["word_count"]
                else:
                    total_text += f"\n\n=== CHUNK {i + 1} FAILED ===\nError: {result.get('error', 'Unknown error')}"
            
            # Calculate success rate
            successful_chunks = sum(1 for r in chunk_results if r["success"])
            success_rate = successful_chunks / len(chunks)
            
            logging.info(f"Chunked extraction completed: {successful_chunks}/{len(chunks)} chunks successful")
            
            return {
                "success": success_rate > 0,  # Success if at least one chunk worked
                "extracted_text": total_text.strip(),
                "word_count": total_words,
                "filename": filename,
                "chunks_processed": len(chunks),
                "successful_chunks": successful_chunks,
                "success_rate": success_rate,
                "chunk_results": chunk_results,
                "chunked": True
            }
            
        except Exception as e:
            logging.error(f"Chunked PDF extraction failed for {filename}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "filename": filename,
                "chunked": True
            }
    
    def extract_single_pdf(self, pdf_bytes: bytes, filename: str) -> Dict[str, Any]:
        """Extract text from small PDF in single pass"""
        try:
            logging.info(f"Processing small PDF in single pass: {filename}")
            
            prompt = """Extract all text content from this PDF document.

INSTRUCTIONS:
- Extract all readable text from every page
- Preserve document structure and formatting where possible
- Include headers, body text, tables, lists, and any other textual content
- Maintain logical flow and organization of information
- Focus on key data points and structured information

RETURN: Complete text content from this PDF document."""

            response = self.client.models.generate_content(
                model="gemini-2.5-pro",
                contents=[
                    types.Part.from_bytes(
                        data=pdf_bytes,
                        mime_type="application/pdf"
                    ),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    max_output_tokens=65536,
                    temperature=0.1
                ),
                request_options={"timeout": 300}
            )
            
            if response and response.text:
                extracted_text = response.text.strip()
                word_count = len(extracted_text.split())
                
                logging.info(f"Successfully extracted {word_count} words from {filename}")
                
                return {
                    "success": True,
                    "extracted_text": extracted_text,
                    "word_count": word_count,
                    "filename": filename,
                    "chunked": False
                }
            else:
                return {
                    "success": False,
                    "error": "No text content received from Gemini",
                    "filename": filename,
                    "chunked": False
                }
                
        except Exception as e:
            logging.error(f"Single PDF extraction failed for {filename}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "filename": filename,
                "chunked": False
            }

def extract_pdf_with_chunking(pdf_data: str, filename: str) -> Dict[str, Any]:
    """Main function to extract PDF with automatic chunking"""
    try:
        extractor = ChunkedPDFExtractor()
        return extractor.extract_pdf_chunked(pdf_data, filename)
    except Exception as e:
        logging.error(f"PDF extraction with chunking failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "filename": filename
        }

if __name__ == "__main__":
    logging.info("Chunked PDF Extractor ready")
    print("Use extract_pdf_with_chunking(pdf_data, filename) to extract large PDFs")