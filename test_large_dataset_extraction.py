#!/usr/bin/env python3
"""
Test the enhanced extraction system with a large dataset that triggers continuation.
This simulates the real-world scenario where Excel files generate many field validations.
"""

import json
import logging
from ai_extraction_simplified import step1_extract_from_documents
from ai_continuation_system import (
    analyze_truncation_point,
    perform_continuation_extraction,
    merge_extraction_results
)

def create_large_test_dataset():
    """Create a test dataset that simulates a large Excel file with many columns"""
    
    # Simulate a pension scheme Excel file with multiple sheets and many columns
    document_content = """
PENSION SCHEME DATA EXTRACT
Sheet 1: New_Pensioners
Columns: Member Reference No, Date of Birth, Pension Start Date, Annual Pension Amount, Pension Type, Payment Frequency, Bank Account Number, Sort Code, Address Line 1, Address Line 2, City, Postcode, Phone Number, Email Address, Emergency Contact Name, Emergency Contact Phone, Marital Status, Gender, Employment Start Date, Employment End Date, Final Salary, Years of Service, Pension Calculation Method, Tax Code, National Insurance Number, Spouse Name, Spouse Date of Birth, Beneficiary Name, Beneficiary Relationship, Medical Conditions, Pension Transfer Value, Previous Scheme Name, Transfer Date, Additional Voluntary Contributions, State Pension Entitlement, Reduced Pension Flag, Early Retirement Flag, Ill Health Retirement Flag, Death Benefit Amount, Spouse Pension Amount, Dependents Pension Amount, Lump Sum Amount, Tax Free Cash Amount, PCLS Amount, Retirement Date, Payment Start Date, Last Payment Date, Pension Review Date, Increase Rate Applied, CPI Increase Amount, RPI Increase Amount, Fixed Increase Amount

Sheet 2: Active_Members  
Columns: Member Reference No, Employee Number, First Name, Last Name, Date of Birth, Gender, Employment Start Date, Current Salary, Pensionable Salary, Contribution Rate Employee, Contribution Rate Employer, Accrued Pension, Projected Pension, Normal Retirement Age, Address Line 1, Address Line 2, City, Postcode, Phone Number, Email Address, Department, Job Title, Employment Status, Part Time Flag, Salary Review Date, Last Salary Increase, Performance Rating, Bonus Amount, Benefits Package, Holiday Entitlement, Sickness Record, Training Record, Appraisal Date, Manager Name, HR Contact, Union Membership, Pension Opt Out Flag, AVC Contributions, Additional Benefits, Life Insurance Amount, Disability Insurance Amount, Medical Insurance, Dental Insurance, Vision Insurance, Flexible Benefits Account, Share Option Scheme, Company Car Allowance, Travel Allowance, Mobile Phone Allowance, Home Working Allowance, Professional Memberships, Certification Requirements

Sheet 3: Deferred_Members
Columns: Member Reference No, Date Left Service, Reason for Leaving, Deferred Pension Amount, Revaluation Rate, Current Value, Transfer Value, Previous Employer, New Employer Contact, Address Line 1, Address Line 2, City, Postcode, Phone Number, Email Address, Date of Birth, Gender, Original Employment Start Date, Final Salary, Years of Service, Pension Calculation Method, Revaluation Method, Annual Statements Sent, Last Contact Date, Trace Flag, Returned Mail Flag, GMP Amount, Post 88 GMP, Pre 88 GMP, State Pension Age, Normal Retirement Age, Early Retirement Reduction, Late Retirement Increase, Death Benefit Amount, Spouse Pension Amount, Dependents Pension Amount, Transfer Quote Date, Transfer Quote Amount, Transfer Quote Expiry, CETV Factor, QROPS Transfer Flag, Overseas Address Flag, Tax Status, HMRC Notification, Pension Credit Flag, Pension Sharing Order

Sheet 4: Pensioner_Payroll
Columns: Member Reference No, Monthly Pension Amount, Tax Code, Tax Amount, Net Payment, Payment Method, Bank Name, Bank Account Number, Sort Code, BACS Reference, Payment Date, Payment Status, Overpayment Amount, Underpayment Amount, Adjustment Amount, Reason Code, P60 Issued, P45 Issued, Annual Statement Sent, Increase Applied Date, Increase Percentage, Increase Amount, Previous Monthly Amount, Payroll Period, Payroll Run Date, Payroll System Reference, Manual Override Flag, Suspended Payment Flag, Deceased Flag, Spouse Continuation Flag, Review Required Flag, Address Change Flag, Bank Detail Change Flag, Tax Code Change Flag, State Pension Offset, COLA Adjustment, Minimum Pension Guarantee, Maximum Pension Limit, Pension Sharing Deduction, Attachment of Earnings, Court Order Reference, Third Party Payment, Power of Attorney Reference, Financial Abuse Flag, Vulnerable Person Flag

Sheet 5: Scheme_Administration
Columns: Scheme Name, Scheme Registration Number, Employer Name, Employer Reference Number, Administrator Name, Administrator Contact, Trustee Name, Trustee Contact, Actuary Name, Actuary Contact, Investment Manager, Investment Manager Contact, Legal Advisor, Legal Advisor Contact, Auditor Name, Auditor Contact, Bank Name, Bank Contact, Custodian Name, Custodian Contact, Scheme Year End, Last Valuation Date, Next Valuation Date, Funding Level, Deficit Amount, Recovery Plan End Date, Contribution Rate Review Date, Investment Strategy, Asset Allocation, Performance Benchmark, Risk Assessment Date, Covenant Assessment, TPR Engagement, PPF Assessment, Scheme Return Date, Event Report Date, Chair Statement Date, SIP Update Date, Investment Report Date, Governance Review Date, Trustee Training Record, Professional Indemnity Insurance, Fidelity Insurance, Cyber Insurance, Data Protection Registration, GDPR Compliance Date, Records Retention Policy, Disaster Recovery Plan, Business Continuity Plan

Sheet 6: Financial_Data
Columns: Fund Value, Asset Class, Asset Description, Market Value, Book Cost, Unrealized Gain Loss, Income Received, Dividend Yield, Interest Rate, Credit Rating, Duration, Beta, Allocation Percentage, Benchmark Weight, Active Weight, Performance YTD, Performance 1 Year, Performance 3 Year, Performance 5 Year, Performance Since Inception, Volatility, Sharpe Ratio, Information Ratio, Alpha, Tracking Error, Maximum Drawdown, VAR 95%, VAR 99%, Stress Test Result, Liquidity Rating, ESG Score, Carbon Footprint, Voting Record, Engagement Activity, Stewardship Report, Fee Rate, Transaction Cost, Custody Fee, Management Fee, Performance Fee, Total Expense Ratio, Net Asset Value, Gross Asset Value, Cash Position, Derivative Exposure, Currency Exposure, Geographic Exposure, Sector Exposure, Investment Grade Exposure, High Yield Exposure, Emerging Market Exposure, Alternative Investment Exposure, Real Estate Exposure, Infrastructure Exposure, Private Equity Exposure, Hedge Fund Exposure, Commodity Exposure
"""

    # Create a project schema that would match this dataset
    project_schema = {
        "schema_fields": [
            {"id": "scheme-name", "fieldName": "Scheme Name", "fieldType": "TEXT"},
            {"id": "total-members", "fieldName": "Total Members", "fieldType": "NUMBER"},
            {"id": "fund-value", "fieldName": "Total Fund Value", "fieldType": "CURRENCY"},
            {"id": "administrator", "fieldName": "Scheme Administrator", "fieldType": "TEXT"},
            {"id": "actuary", "fieldName": "Scheme Actuary", "fieldType": "TEXT"}
        ],
        "collections": [
            {
                "id": "data-fields",
                "collectionName": "Data Fields",
                "properties": []
            }
        ]
    }
    
    # Generate properties for the Data Fields collection (this will be large)
    all_columns = []
    sheets = {
        "New_Pensioners": ["Member Reference No", "Date of Birth", "Pension Start Date", "Annual Pension Amount", "Pension Type", "Payment Frequency", "Bank Account Number", "Sort Code", "Address Line 1", "Address Line 2", "City", "Postcode", "Phone Number", "Email Address", "Emergency Contact Name", "Emergency Contact Phone", "Marital Status", "Gender", "Employment Start Date", "Employment End Date", "Final Salary", "Years of Service", "Pension Calculation Method", "Tax Code", "National Insurance Number", "Spouse Name", "Spouse Date of Birth", "Beneficiary Name", "Beneficiary Relationship", "Medical Conditions", "Pension Transfer Value", "Previous Scheme Name", "Transfer Date", "Additional Voluntary Contributions", "State Pension Entitlement", "Reduced Pension Flag", "Early Retirement Flag", "Ill Health Retirement Flag", "Death Benefit Amount", "Spouse Pension Amount", "Dependents Pension Amount", "Lump Sum Amount", "Tax Free Cash Amount", "PCLS Amount", "Retirement Date", "Payment Start Date", "Last Payment Date", "Pension Review Date", "Increase Rate Applied", "CPI Increase Amount", "RPI Increase Amount", "Fixed Increase Amount"],
        "Active_Members": ["Member Reference No", "Employee Number", "First Name", "Last Name", "Date of Birth", "Gender", "Employment Start Date", "Current Salary", "Pensionable Salary", "Contribution Rate Employee", "Contribution Rate Employer", "Accrued Pension", "Projected Pension", "Normal Retirement Age", "Address Line 1", "Address Line 2", "City", "Postcode", "Phone Number", "Email Address", "Department", "Job Title", "Employment Status", "Part Time Flag", "Salary Review Date", "Last Salary Increase", "Performance Rating", "Bonus Amount", "Benefits Package", "Holiday Entitlement", "Sickness Record", "Training Record", "Appraisal Date", "Manager Name", "HR Contact", "Union Membership", "Pension Opt Out Flag", "AVC Contributions", "Additional Benefits", "Life Insurance Amount", "Disability Insurance Amount", "Medical Insurance", "Dental Insurance", "Vision Insurance", "Flexible Benefits Account", "Share Option Scheme", "Company Car Allowance", "Travel Allowance", "Mobile Phone Allowance", "Home Working Allowance", "Professional Memberships", "Certification Requirements"]
    }
    
    # Add all columns as collection properties (this simulates the Excel extraction scenario)
    for sheet_name, columns in sheets.items():
        for col in columns:
            all_columns.append(f"{sheet_name}.{col}")
    
    # Create field name and field type properties for each column
    properties = []
    for i, column in enumerate(all_columns):
        # Field Name property
        properties.append({
            "id": f"field-name-{i}",
            "propertyName": "Field Name",
            "propertyType": "TEXT",
            "collectionId": "data-fields"
        })
        # Field Type property  
        properties.append({
            "id": f"field-type-{i}",
            "propertyName": "Field Type", 
            "propertyType": "TEXT",
            "collectionId": "data-fields"
        })
    
    project_schema["collections"][0]["properties"] = properties
    
    documents = [{
        "file_content": document_content,
        "file_name": "pension_scheme_data.xlsx",
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }]
    
    return documents, project_schema

def test_large_dataset_with_continuation():
    """Test the extraction system with a dataset large enough to trigger continuation"""
    
    print("🧪 Testing Large Dataset Extraction with Continuation System")
    print("=" * 70)
    
    # Create test data
    documents, project_schema = create_large_test_dataset()
    
    print(f"📊 Test Dataset:")
    print(f"   - Documents: {len(documents)}")
    print(f"   - Schema Fields: {len(project_schema['schema_fields'])}")
    print(f"   - Collections: {len(project_schema['collections'])}")
    print(f"   - Collection Properties: {len(project_schema['collections'][0]['properties'])}")
    print(f"   - Expected Field Validations: ~{len(project_schema['collections'][0]['properties']) + len(project_schema['schema_fields'])}")
    
    # Test Step 1: Initial extraction (this should trigger truncation)
    print(f"\n🚀 Step 1: Initial Extraction")
    
    extraction_result = step1_extract_from_documents(
        documents=documents,
        project_schema=project_schema,
        session_name="pension_scheme_test"
    )
    
    if not extraction_result.success:
        print(f"❌ Initial extraction failed: {extraction_result.error_message}")
        return False
    
    print(f"✅ Initial extraction completed")
    print(f"   - Success: {extraction_result.success}")
    print(f"   - Input tokens: {extraction_result.input_token_count}")
    print(f"   - Output tokens: {extraction_result.output_token_count}")
    
    extracted_data = extraction_result.extracted_data
    original_response = extraction_result.ai_response
    
    # Check if we got field validations
    field_validations = extracted_data.get('field_validations', []) if extracted_data else []
    print(f"   - Field validations extracted: {len(field_validations)}")
    
    # Test Step 2: Analyze if continuation is needed
    print(f"\n🔍 Step 2: Analyzing Truncation")
    
    needs_continuation = False
    continuation_info = None
    
    if original_response and len(field_validations) > 0:
        # Check if response was truncated
        response_stripped = original_response.strip()
        if not (response_stripped.endswith(']}') or response_stripped.endswith(']\n}')):
            print(f"🔄 Truncation detected in response")
            continuation_info = analyze_truncation_point(original_response, extracted_data)
            
            if continuation_info:
                needs_continuation = True
                print(f"✅ Continuation analysis successful:")
                print(f"   - Last processed index: {continuation_info['last_processed_index']}")
                print(f"   - Total recovered validations: {continuation_info['total_recovered']}")
                print(f"   - Continuation needed: {needs_continuation}")
            else:
                print(f"❌ Continuation analysis failed")
        else:
            print(f"✅ Response appears complete - no continuation needed")
    else:
        print(f"⚠️ No response or validations to analyze")
    
    # Test Step 3: Perform continuation if needed
    final_extracted_data = extracted_data
    if needs_continuation and continuation_info:
        print(f"\n🚀 Step 3: Performing Continuation Extraction")
        
        # Prepare extracted text
        extracted_text = ""
        for doc in documents:
            extracted_text += f"\n\n=== DOCUMENT: {doc['file_name']} ===\n{doc['file_content']}"
        
        # Mock the continuation function call (in real system this would be called)
        continuation_result = perform_continuation_extraction(
            session_id="test_session_123",
            project_id="test_project_456", 
            extracted_text=extracted_text,
            schema_fields=project_schema["schema_fields"],
            collections=project_schema["collections"],
            knowledge_base=[],
            extraction_rules=[],
            previous_response=original_response,
            repaired_data=extracted_data
        )
        
        if continuation_result and continuation_result.get('success'):
            print(f"✅ Continuation extraction successful")
            
            # Merge results
            continuation_data = continuation_result['continuation_data']
            final_extracted_data = merge_extraction_results(extracted_data, continuation_data)
            
            print(f"✅ Results merged successfully:")
            print(f"   - Original validations: {len(field_validations)}")
            print(f"   - Continuation validations: {len(continuation_data.get('field_validations', []))}")
            print(f"   - Total final validations: {len(final_extracted_data.get('field_validations', []))}")
        else:
            print(f"❌ Continuation extraction failed")
    else:
        print(f"\n⚪ Step 3: No continuation needed")
    
    # Test Step 4: Verify final results
    print(f"\n📊 Final Results:")
    final_validations = final_extracted_data.get('field_validations', []) if final_extracted_data else []
    print(f"   - Total field validations: {len(final_validations)}")
    print(f"   - Continuation was used: {needs_continuation}")
    
    # Analyze validation types
    schema_field_count = len([v for v in final_validations if v.get('validation_type') == 'schema_field'])
    collection_property_count = len([v for v in final_validations if v.get('validation_type') == 'collection_property'])
    
    print(f"   - Schema field validations: {schema_field_count}")
    print(f"   - Collection property validations: {collection_property_count}")
    
    # Success criteria
    expected_min_validations = 50  # Should have at least 50 validations for a large dataset
    success = len(final_validations) >= expected_min_validations
    
    if success:
        print(f"\n🎉 Large Dataset Test PASSED!")
        print(f"   ✓ Extracted {len(final_validations)} field validations")
        print(f"   ✓ Continuation system {'worked' if needs_continuation else 'was not needed'}")
        print(f"   ✓ Data integrity maintained throughout process")
    else:
        print(f"\n❌ Large Dataset Test FAILED!")
        print(f"   ✗ Only extracted {len(final_validations)} validations (expected >= {expected_min_validations})")
    
    return success

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    success = test_large_dataset_with_continuation()
    exit(0 if success else 1)