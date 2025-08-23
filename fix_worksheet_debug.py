#!/usr/bin/env python3
"""
Debug script to understand why Worksheet Name function isn't finding columns
"""

import sys
import json
import psycopg2
import os

def main():
    # Connect to database
    DATABASE_URL = os.environ.get('DATABASE_URL')
    if not DATABASE_URL:
        print("DATABASE_URL not found")
        sys.exit(1)
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Get sample document content
    cur.execute("""
        SELECT extracted_content 
        FROM session_documents 
        WHERE file_name LIKE '%xlsx%' 
        ORDER BY extracted_at DESC 
        LIMIT 1
    """)
    
    result = cur.fetchone()
    if result and result[0]:
        content = result[0]
        print(f"Document content length: {len(content)} characters")
        print(f"First 1000 chars:\n{content[:1000]}")
        print("\n" + "="*50 + "\n")
        
        # Check for sheet markers
        lines = content.split('\n')
        print(f"Total lines: {len(lines)}")
        
        # Find sheet headers
        for i, line in enumerate(lines[:20]):
            if '=== Sheet:' in line:
                print(f"Line {i}: {line}")
                if i+1 < len(lines):
                    print(f"  Headers line {i+1}: {lines[i+1][:200]}")
                    # Check if tabs exist
                    if '\t' in lines[i+1]:
                        headers = lines[i+1].split('\t')
                        print(f"  Found {len(headers)} columns (tab-separated)")
                        print(f"  First 5 columns: {headers[:5]}")
                    else:
                        print("  WARNING: No tabs found in header line!")
    else:
        print("No Excel documents found in session_documents")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()