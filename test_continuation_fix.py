#!/usr/bin/env python3
"""
Test the improved continuation system with explicit field ID tracking.
This test simulates the real-world scenario where 137 out of 185 validations are extracted.
"""

import json
import logging
from ai_extraction_simplified import step1_extract_from_documents
from ai_continuation_system import (
    analyze_truncation_point,
    perform_continuation_extraction,
    merge_extraction_results
)

def test_continuation_fix():
    """Test the enhanced continuation system with proper field ID tracking"""
    
    print("🧪 Testing Continuation Fix - Proper Field ID Tracking")
    print("=" * 60)
    
    # Create a test scenario that mimics the real-world case
    documents = [{
        "file_content": """
PENSION SCHEME DATA ANALYSIS

This document contains extensive pension data across multiple sheets:

Sheet 1: New_Pensioners (48 columns)
Member Reference No, Date of Birth, Pension Start Date, Annual Pension Amount, Pension Type, Payment Frequency, Bank Account Number, Sort Code, Address Line 1, Address Line 2, City, Postcode, Phone Number, Email Address, Emergency Contact Name, Emergency Contact Phone, Marital Status, Gender, Employment Start Date, Employment End Date, Final Salary, Years of Service, Pension Calculation Method, Tax Code, National Insurance Number, Spouse Name, Spouse Date of Birth, Beneficiary Name, Beneficiary Relationship, Medical Conditions, Pension Transfer Value, Previous Scheme Name, Transfer Date, Additional Voluntary Contributions, State Pension Entitlement, Reduced Pension Flag, Early Retirement Flag, Ill Health Retirement Flag, Death Benefit Amount, Spouse Pension Amount, Dependents Pension Amount, Lump Sum Amount, Tax Free Cash Amount, PCLS Amount, Retirement Date, Payment Start Date, Last Payment Date, Pension Review Date, Increase Rate Applied

Sheet 2: Active_Members (50 columns)  
Member Reference No, Employee Number, First Name, Last Name, Date of Birth, Gender, Employment Start Date, Current Salary, Pensionable Salary, Contribution Rate Employee, Contribution Rate Employer, Accrued Pension, Projected Pension, Normal Retirement Age, Address Line 1, Address Line 2, City, Postcode, Phone Number, Email Address, Department, Job Title, Employment Status, Part Time Flag, Salary Review Date, Last Salary Increase, Performance Rating, Bonus Amount, Benefits Package, Holiday Entitlement, Sickness Record, Training Record, Appraisal Date, Manager Name, HR Contact, Union Membership, Pension Opt Out Flag, AVC Contributions, Additional Benefits, Life Insurance Amount, Disability Insurance Amount, Medical Insurance, Dental Insurance, Vision Insurance, Flexible Benefits Account, Share Option Scheme, Company Car Allowance, Travel Allowance, Mobile Phone Allowance

Sheet 3: Deferred_Members (45 columns)
Member Reference No, Date Left Service, Reason for Leaving, Deferred Pension Amount, Revaluation Rate, Current Value, Transfer Value, Previous Employer, New Employer Contact, Address Line 1, Address Line 2, City, Postcode, Phone Number, Email Address, Date of Birth, Gender, Original Employment Start Date, Final Salary, Years of Service, Pension Calculation Method, Revaluation Method, Annual Statements Sent, Last Contact Date, Trace Flag, Returned Mail Flag, GMP Amount, Post 88 GMP, Pre 88 GMP, State Pension Age, Normal Retirement Age, Early Retirement Reduction, Late Retirement Increase, Death Benefit Amount, Spouse Pension Amount, Dependents Pension Amount, Transfer Quote Date, Transfer Quote Amount, Transfer Quote Expiry, CETV Factor, QROPS Transfer Flag, Overseas Address Flag

Sheet 4: Financial_Data (42 columns)
Fund Value, Asset Class, Asset Description, Market Value, Book Cost, Unrealized Gain Loss, Income Received, Dividend Yield, Interest Rate, Credit Rating, Duration, Beta, Allocation Percentage, Benchmark Weight, Active Weight, Performance YTD, Performance 1 Year, Performance 3 Year, Performance 5 Year, Performance Since Inception, Volatility, Sharpe Ratio, Information Ratio, Alpha, Tracking Error, Maximum Drawdown, VAR 95%, VAR 99%, Stress Test Result, Liquidity Rating, ESG Score, Carbon Footprint, Voting Record, Engagement Activity, Stewardship Report, Fee Rate, Transaction Cost, Custody Fee, Management Fee, Performance Fee, Total Expense Ratio, Net Asset Value
""",
        "file_name": "pension_data_comprehensive.xlsx",
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }]
    
    # Create a schema that matches the 185 columns (simulated)
    # This creates enough fields to trigger truncation
    all_columns = [
        # Sheet 1 columns (48)
        "Member Reference No", "Date of Birth", "Pension Start Date", "Annual Pension Amount", "Pension Type", 
        "Payment Frequency", "Bank Account Number", "Sort Code", "Address Line 1", "Address Line 2", 
        "City", "Postcode", "Phone Number", "Email Address", "Emergency Contact Name", "Emergency Contact Phone", 
        "Marital Status", "Gender", "Employment Start Date", "Employment End Date", "Final Salary", 
        "Years of Service", "Pension Calculation Method", "Tax Code", "National Insurance Number", 
        "Spouse Name", "Spouse Date of Birth", "Beneficiary Name", "Beneficiary Relationship", "Medical Conditions", 
        "Pension Transfer Value", "Previous Scheme Name", "Transfer Date", "Additional Voluntary Contributions", 
        "State Pension Entitlement", "Reduced Pension Flag", "Early Retirement Flag", "Ill Health Retirement Flag", 
        "Death Benefit Amount", "Spouse Pension Amount", "Dependents Pension Amount", "Lump Sum Amount", 
        "Tax Free Cash Amount", "PCLS Amount", "Retirement Date", "Payment Start Date", "Last Payment Date", 
        "Pension Review Date", "Increase Rate Applied",
        
        # Sheet 2 columns (50) - abbreviated for space
        "Employee Number", "First Name", "Last Name", "Current Salary", "Pensionable Salary", 
        "Contribution Rate Employee", "Contribution Rate Employer", "Accrued Pension", "Projected Pension", 
        "Normal Retirement Age", "Department", "Job Title", "Employment Status", "Part Time Flag", 
        "Salary Review Date", "Last Salary Increase", "Performance Rating", "Bonus Amount", "Benefits Package", 
        "Holiday Entitlement", "Sickness Record", "Training Record", "Appraisal Date", "Manager Name", 
        "HR Contact", "Union Membership", "Pension Opt Out Flag", "AVC Contributions", "Additional Benefits", 
        "Life Insurance Amount", "Disability Insurance Amount", "Medical Insurance", "Dental Insurance", 
        "Vision Insurance", "Flexible Benefits Account", "Share Option Scheme", "Company Car Allowance", 
        "Travel Allowance", "Mobile Phone Allowance", "Home Working Allowance", "Professional Memberships", 
        "Certification Requirements", "Skills Matrix", "Training Budget", "Appraisal Score", "Next Review Date", 
        "Career Development Plan", "Succession Planning", "Exit Interview", "Reference Check", "Background Check", 
        "Security Clearance",
        
        # Add more columns to reach 185 total
        "Overtime Hours", "Commission Rate", "Expense Claims", "Mileage Allowance", "Parking Allowance",
        "Gym Membership", "Health Screening", "Occupational Health", "Risk Assessment", "Safety Training",
        "Fire Warden", "First Aid", "Mental Health Support", "Employee Assistance", "Wellbeing Score",
        "Engagement Score", "Retention Risk", "Promotion Eligibility", "Salary Band", "Grade Level",
        "Notice Period", "Probation End", "Contract Type", "Working Pattern", "Flexible Working",
        "Remote Working", "Hybrid Working", "Core Hours", "Flexitime", "Compressed Hours",
        "Job Share", "Secondment", "Sabbatical", "Study Leave", "Maternity Leave", "Paternity Leave",
        "Adoption Leave", "Shared Parental Leave", "Carers Leave", "Bereavement Leave", "Special Leave",
        "Annual Leave Entitlement", "Carry Over Days", "Leave Taken", "Leave Balance", "Public Holidays",
        "Bank Holidays", "Religious Holidays", "Cultural Leave", "Volunteer Days", "Training Days",
        "Conference Days", "Study Days", "Exam Leave", "Jury Service", "Emergency Leave",
        "Compassionate Leave", "Medical Leave", "Sick Leave", "Long Term Sick", "Return to Work",
        "Occupational Sick Pay", "Statutory Sick Pay", "Disability Allowance", "Reasonable Adjustments",
        "Access to Work", "Equipment Needs", "Workspace Requirements", "IT Equipment", "Software Licenses",
        "Mobile Phone", "Laptop", "Tablet", "Headset", "Monitor", "Keyboard", "Mouse",
        "Desk Setup", "Chair Type", "Standing Desk", "Ergonomic Assessment", "DSE Assessment",
        "Workstation Review", "Health and Safety", "Incident Reports", "Near Miss Reports", "Accident Reports",
        "Investigation Outcomes", "Corrective Actions", "Prevention Measures", "Safety Improvements",
        "Compliance Status", "Audit Results", "Inspection Results", "Certification Status", "License Status",
        "Registration Status", "Approval Status", "Accreditation Status", "Quality Scores", "Performance Metrics",
        "KPI Scores", "Target Achievement", "Bonus Eligibility", "Incentive Schemes", "Recognition Awards",
        "Long Service Awards", "Achievement Awards", "Team Awards", "Innovation Awards", "Safety Awards",
        "Customer Service Awards", "Sales Awards", "Leadership Awards", "Mentoring Awards", "Training Awards",
        "Development Awards", "Improvement Awards", "Excellence Awards", "Outstanding Performance",
        "Exceptional Service", "Above and Beyond", "Going the Extra Mile", "Team Player", "Role Model",
        "Ambassador", "Champion", "Leader", "Mentor", "Coach", "Trainer", "Specialist", "Expert",
        "Consultant", "Advisor", "Subject Matter Expert", "Technical Lead", "Project Lead", "Team Lead"
    ]
    
    # Create schema with enough fields to trigger truncation
    project_schema = {
        "schema_fields": [
            {"id": "scheme-name", "fieldName": "Scheme Name", "fieldType": "TEXT"},
            {"id": "total-members", "fieldName": "Total Members", "fieldType": "NUMBER"},
            {"id": "fund-value", "fieldName": "Total Fund Value", "fieldType": "CURRENCY"},
        ],
        "collections": [
            {
                "id": "data-fields",
                "collectionName": "Data Fields",
                "properties": []
            }
        ]
    }
    
    # Generate properties for each column (this will create 185*2 = 370 properties)
    properties = []
    for i, column in enumerate(all_columns[:185]):  # Limit to 185 to match the real scenario
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
    
    total_expected_validations = len(project_schema["schema_fields"]) + len(properties)
    
    print(f"📊 Test Configuration:")
    print(f"   - Documents: {len(documents)}")
    print(f"   - Schema Fields: {len(project_schema['schema_fields'])}")
    print(f"   - Collection Properties: {len(properties)}")
    print(f"   - Expected Total Validations: {total_expected_validations}")
    
    # Step 1: Initial extraction (this should get truncated)
    print(f"\n🚀 Step 1: Initial Extraction (expecting truncation)")
    
    try:
        extraction_result = step1_extract_from_documents(
            documents=documents,
            project_schema=project_schema,
            session_name="continuation_fix_test"
        )
        
        if not extraction_result.success:
            print(f"❌ Initial extraction failed: {extraction_result.error_message}")
            return False
            
        print(f"✅ Initial extraction completed")
        extracted_data = extraction_result.extracted_data
        field_validations = extracted_data.get('field_validations', []) if extracted_data else []
        
        print(f"   - Extracted: {len(field_validations)} out of {total_expected_validations} expected")
        print(f"   - Extraction ratio: {len(field_validations)/total_expected_validations*100:.1f}%")
        
        # Step 2: Check if continuation is needed
        needs_continuation = len(field_validations) < total_expected_validations * 0.9  # If less than 90% extracted
        
        if needs_continuation:
            print(f"\n🔄 Step 2: Continuation Required (got {len(field_validations)}, expected ~{total_expected_validations})")
            
            # Perform continuation extraction with improved system
            continuation_result = perform_continuation_extraction(
                session_id="test-session-123",
                project_id="test-project-456", 
                extracted_text=documents[0]["file_content"],
                schema_fields=project_schema["schema_fields"],
                collections=project_schema["collections"],
                knowledge_base=[],
                extraction_rules=[],
                previous_response=extraction_result.ai_response or "",
                repaired_data=extracted_data
            )
            
            if continuation_result and continuation_result.get('success'):
                continuation_data = continuation_result['continuation_data']
                continuation_validations = continuation_data.get('field_validations', [])
                
                print(f"✅ Continuation extraction successful")
                print(f"   - Additional validations: {len(continuation_validations)}")
                print(f"   - Remaining items requested: {continuation_result.get('remaining_items_requested', 'N/A')}")
                print(f"   - Duplicates filtered: {continuation_result.get('duplicates_filtered', 0)}")
                
                # Merge results
                final_data = merge_extraction_results(extracted_data, continuation_data)
                final_validations = final_data.get('field_validations', [])
                
                print(f"✅ Results merged successfully")
                print(f"   - Original: {len(field_validations)} validations")
                print(f"   - Continuation: {len(continuation_validations)} validations")
                print(f"   - Final total: {len(final_validations)} validations")
                print(f"   - Coverage: {len(final_validations)/total_expected_validations*100:.1f}%")
                
                # Verify no duplicates
                field_ids = set()
                duplicates = 0
                for validation in final_validations:
                    field_id = validation.get('field_id', '')
                    if field_id in field_ids:
                        duplicates += 1
                    else:
                        field_ids.add(field_id)
                
                if duplicates == 0:
                    print(f"✅ No duplicate field_ids found")
                else:
                    print(f"⚠️ Found {duplicates} duplicate field_ids")
                
                # Test success criteria
                expected_min_validations = total_expected_validations * 0.8  # At least 80% coverage
                success = len(final_validations) >= expected_min_validations and duplicates == 0
                
                print(f"\n📊 Final Test Results:")
                print(f"   - Total validations: {len(final_validations)} / {total_expected_validations}")
                print(f"   - Coverage achieved: {len(final_validations)/total_expected_validations*100:.1f}%")
                print(f"   - Minimum required: {expected_min_validations}")
                print(f"   - Duplicates: {duplicates}")
                print(f"   - Test status: {'✅ PASSED' if success else '❌ FAILED'}")
                
                return success
                
            else:
                print(f"❌ Continuation extraction failed")
                error = continuation_result.get('error', 'Unknown error') if continuation_result else 'No result'
                print(f"   - Error: {error}")
                return False
        else:
            print(f"✅ No continuation needed - extraction was complete")
            print(f"   - Coverage: {len(field_validations)/total_expected_validations*100:.1f}%")
            return True
            
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    success = test_continuation_fix()
    exit(0 if success else 1)