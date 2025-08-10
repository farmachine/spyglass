#!/usr/bin/env python3
"""
Test Enhanced Excel Extraction with Increased Limits
"""
import json
import pandas as pd
import io
import base64
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

def create_large_test_excel():
    """Create a large test Excel file to verify extraction improvements"""
    
    # Create test data with multiple sheets
    sheets = {}
    
    # Sheet 1: Large data sheet (300 rows)
    data1 = {
        'Code': [f'CODE_{i:04d}' for i in range(300)],
        'Description': [f'Description for item {i}' for i in range(300)],
        'Category': [f'Category_{i % 10}' for i in range(300)],
        'Value': [i * 1.5 for i in range(300)],
        'Status': ['Active' if i % 2 == 0 else 'Inactive' for i in range(300)]
    }
    sheets['Large_Data'] = pd.DataFrame(data1)
    
    # Sheet 2: Code meanings sheet
    data2 = {
        'Code': ['ACTIVE', 'INACTIVE', 'PENDING', 'RETIRED'],
        'Meaning': ['Currently in use', 'No longer active', 'Awaiting approval', 'Discontinued'],
        'Description': ['Item is actively being used', 'Item has been deactivated', 'Item is under review', 'Item has been retired']
    }
    sheets['Code_Meanings'] = pd.DataFrame(data2)
    
    # Sheet 3: Summary sheet
    data3 = {
        'Summary_Type': ['Total Items', 'Active Items', 'Categories', 'Average Value'],
        'Count': [300, 150, 10, 224.25]
    }
    sheets['Summary'] = pd.DataFrame(data3)
    
    # Create Excel file in memory
    excel_buffer = io.BytesIO()
    with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
        for sheet_name, df in sheets.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False)
    
    excel_buffer.seek(0)
    excel_data = excel_buffer.getvalue()
    
    # Convert to base64 data URL
    base64_data = base64.b64encode(excel_data).decode()
    data_url = f"data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,{base64_data}"
    
    return data_url, sheets

def test_extraction_limits():
    """Test the extraction with various sheet sizes"""
    
    print("=== Testing Enhanced Excel Extraction Limits ===")
    
    # Test different sheet sizes
    test_cases = [
        {"rows": 50, "expected_behavior": "Full extraction"},
        {"rows": 150, "expected_behavior": "Full extraction"},
        {"rows": 250, "expected_behavior": "Expanded sampling (200+ rows)"},
        {"rows": 600, "expected_behavior": "Intelligent sampling (500+ rows)"}
    ]
    
    for case in test_cases:
        rows = case["rows"]
        
        # Create test dataframe
        test_df = pd.DataFrame({
            'ID': range(rows),
            'Data': [f'Item_{i}' for i in range(rows)]
        })
        
        # Simulate the extraction logic from the enhanced script
        if rows > 500:
            # Very large sheet logic
            sample_df = pd.concat([
                test_df.head(150),
                test_df.iloc[rows//4:rows//4+50],
                test_df.iloc[rows//2-25:rows//2+25],
                test_df.iloc[3*rows//4:3*rows//4+50],
                test_df.tail(100)
            ]).drop_duplicates()
            extraction_type = "Intelligent sampling (500+ rows)"
            sample_size = len(sample_df)
        elif rows > 200:
            # Medium-large sheet logic
            sample_df = pd.concat([
                test_df.head(100),
                test_df.iloc[rows//2-25:rows//2+25],
                test_df.tail(50)
            ]).drop_duplicates()
            extraction_type = "Expanded sampling (200+ rows)"
            sample_size = len(sample_df)
        else:
            # Full extraction for smaller sheets
            sample_df = test_df
            extraction_type = "Full extraction"
            sample_size = len(sample_df)
        
        print(f"Sheet with {rows} rows:")
        print(f"  Expected: {case['expected_behavior']}")
        print(f"  Actual: {extraction_type}")
        print(f"  Sample size: {sample_size} rows")
        print(f"  Coverage: {(sample_size/rows)*100:.1f}%")
        print()

def test_limits_comparison():
    """Compare old vs new limits"""
    
    print("=== Extraction Limits Comparison ===")
    
    limits = {
        "Per Document Limit": {
            "Old": "200KB (200,000 chars)",
            "New": "800KB (800,000 chars)",
            "Improvement": "4x increase"
        },
        "Total Content Limit": {
            "Old": "500KB (500,000 chars)",
            "New": "1.5MB (1,500,000 chars)",
            "Improvement": "3x increase"
        },
        "AI Output Tokens": {
            "Old": "65,536 tokens",
            "New": "100,000 tokens",
            "Improvement": "53% increase"
        },
        "Row Sampling (Large Sheets)": {
            "Old": "90 rows total (50+20+20)",
            "New": "Up to 400 rows (150+50+50+50+100)",
            "Improvement": "4.4x more data"
        },
        "Response Limit Philosophy": {
            "Old": "Hard 100-record limit",
            "New": "Comprehensive extraction priority",
            "Improvement": "Quality-focused approach"
        }
    }
    
    for category, details in limits.items():
        print(f"{category}:")
        print(f"  Old: {details['Old']}")
        print(f"  New: {details['New']}")
        print(f"  Improvement: {details['Improvement']}")
        print()

if __name__ == "__main__":
    print("Enhanced Excel Extraction Test Suite")
    print("====================================")
    
    # Test extraction limits
    test_extraction_limits()
    
    # Compare limits
    test_limits_comparison()
    
    # Create large test file
    print("=== Creating Large Test Excel File ===")
    data_url, sheets_info = create_large_test_excel()
    
    print("Created test Excel file with:")
    for sheet_name, df in sheets_info.items():
        print(f"  - {sheet_name}: {len(df)} rows, {len(df.columns)} columns")
    
    print(f"\nData URL length: {len(data_url)} characters")
    print("Test file ready for extraction testing")
    
    print("\n=== Summary of Improvements ===")
    print("✅ Increased per-document limit from 200KB to 800KB")
    print("✅ Increased total content limit from 500KB to 1.5MB")
    print("✅ Enhanced sampling for large sheets (up to 400 rows vs 90)")
    print("✅ Increased AI output tokens from 65K to 100K")
    print("✅ Removed hard 100-record response limit")
    print("✅ Added graduated sampling thresholds (200+ and 500+ rows)")
    
    print("\nThese changes should significantly reduce Excel extraction truncation!")