#!/usr/bin/env python3
"""
Test increased AI extraction capacity to reach 185+ collection items
"""
import json
import subprocess
import sys

def test_increased_capacity():
    """Test AI extraction with increased capacity limits"""
    
    # Create a larger test case with more Excel column data
    extraction_input = {
        "operation": "extract",
        "documents": [{
            "file_name": "Ersatz_eighth_enhanced.xlsx",
            "file_content": """
=== EXCEL FILE: Ersatz eighth (1).xlsx ===

=== SHEET: New_Pensioners ===
Column Headers Row 1:
Member Reference No | Employer Code | Sex Code | Date of Birth | Date Became Pensioner | Marital Status | Relationship Code | Title | Forename | Surname | Address Line 1 | Address Line 2 | Address Line 3 | Address Line 4 | Address Line 5 | Address Line 6 | Postcode | Country Code | Telephone No | Pension Code | Pension Start Date | Initial Annual Amount | Current Annual Amount | Increase Date | Increased Amount | Payment Frequency | Bank Account Name | Bank Sort Code | Bank Account No | Building Society Roll No | Pay Method | PAYE Reference | National Insurance No | Emergency Tax Code | Tax District | P45 Issued | Preserved Pension | Preserved Start Date | Preserved Amount | GMP Included | GMP Weekly Amount | Pensioner Status | Cessation Date | Cessation Reason | Death Benefit | Spouse Name | Dependent Name | Additional Info 1 | Additional Info 2 | Additional Info 3 | Calculation Method | Fund Code | Investment Option | Risk Category | Admin Fee | Transfer Value | Contribution History | Service Years | Final Salary | Revaluation Rate | Pension Credit | State Pension | Medical Details | Employment History | Previous Employer | Qualification Date | Opt Out Date | Re-entry Date | Contribution Rate | Employer Contribution | AVC Amount | Additional Pension | Escalation Rate | Inflation Adjustment | CPI Rate | RPI Rate | Discount Rate | Mortality Table | Life Expectancy | Actuarial Factor | Commutation Factor | Lump Sum | Tax Free Cash | Taxable Pension | Emergency Contact | Next of Kin | Beneficiary 1 | Beneficiary 2 | Beneficiary 3 | Power of Attorney | Medical Certificate | GP Details | Hospital | Specialist | Medication | Treatment Plan | Disability Code | Mobility | Care Requirements | Home Visit | Assessment Date | Review Date | Appeal Date | Decision Date | Effective Date | Payment Date | Reporting Period | Financial Year | Scheme Year | Plan Year | Policy Number | Certificate Number | Reference Code | Status Code | Priority Code | Category Code | Type Code | Class Code | Grade Code | Level Code | Rate Code | Frequency Code | Method Code | Source Code | Target Code | Process Code | System Code | User Code | Admin Code | Audit Code | Control Code | Security Code | Access Code | Permission Code | Role Code | Function Code | Department Code | Location Code | Region Code | Area Code | District Code | Branch Code | Office Code | Unit Code | Team Code | Manager Code | Supervisor Code | Contact Code | Phone Code | Email Code | Web Code | Social Code | Document Code | File Code | Record Code | Archive Code | Backup Code | Recovery Code | Restore Code | Update Code | Change Code | Version Code | Release Code | Build Code | Deploy Code | Test Code | Quality Code | Performance Code | Benchmark Code | Standard Code | Compliance Code | Legal Code | Regulatory Code | Policy Code | Procedure Code | Process Code | Workflow Code | Task Code | Activity Code | Event Code | Schedule Code | Calendar Code | Date Code | Time Code | Duration Code | Frequency Code | Interval Code | Period Code | Cycle Code | Phase Code | Stage Code | Step Code | Action Code | Result Code | Outcome Code | Status Code | Progress Code | Completion Code | Success Code | Failure Code | Error Code | Warning Code | Alert Code | Notification Code

Data Sample Rows:
EMP001 | ABC123 | M | 1955-03-15 | 2020-03-15 | S | SP | Mr | John | Smith | 123 Main St | Anytown | County | | | | AB1 2CD | UK | 01234567890 | PEN001 | 2020-03-15 | 12000.00 | 12500.00 | 2024-04-01 | 12500.00 | M | John Smith | 12-34-56 | 87654321 | | BACS | 123/AB456 | AB123456C | 1250L | District 1 | Y | 5000.00 | 2020-03-15 | 5000.00 | Y | 85.50 | ACTIVE | | | DBP | Mary Smith | | Additional notes | Secondary info | Extra details | FINAL_SALARY | FUND01 | BALANCED | MEDIUM | 0.75 | 125000.00 | 35 years | 35 | 35000.00 | 2.5 | 0.00 | 175.20 | Good | ABC Corp | Previous Corp | 2020-03-15 | | | 8.5 | 17.5 | 2500.00 | 1000.00 | 3.0 | CPI | 2.1 | 3.2 | 1.5 | PA92 | 82.5 | 18.5 | 0.25 | 31250.00 | 31250.00 | 0.00 | Emergency Name | Next Name | Ben1 | Ben2 | Ben3 | POA Name | Cert123 | Dr Smith | General Hospital | Consultant | Med1 | Treatment 1 | DIS001 | MOBILE | NONE | N | 2024-01-15 | 2025-01-15 | | | 2020-03-15 | 2024-12-31 | Q4 | 2024 | 2024 | 2024 | POL001 | CERT001 | REF001 | ACT | HIGH | CAT1 | TYPE1 | CLASS1 | GRADE1 | LEVEL1 | RATE1 | FREQ1 | METH1 | SRC1 | TGT1 | PROC1 | SYS1 | USR1 | ADM1 | AUD1 | CTL1 | SEC1 | ACC1 | PERM1 | ROLE1 | FUNC1 | DEPT1 | LOC1 | REG1 | AREA1 | DIST1 | BR1 | OFF1 | UNIT1 | TEAM1 | MGR1 | SUP1 | CON1 | PH1 | EM1 | WEB1 | SOC1 | DOC1 | FILE1 | REC1 | ARC1 | BAK1 | REC1 | RST1 | UPD1 | CHG1 | VER1 | REL1 | BLD1 | DEP1 | TST1 | QUA1 | PER1 | BEN1 | STD1 | COM1 | LEG1 | REG1 | POL1 | PRO1 | PRC1 | WRK1 | TSK1 | ACT1 | EVT1 | SCH1 | CAL1 | DT1 | TM1 | DUR1 | FRQ1 | INT1 | PER1 | CYC1 | PH1 | STG1 | STP1 | ACN1 | RES1 | OUT1 | STA1 | PRG1 | CMP1 | SUC1 | FAI1 | ERR1 | WAR1 | ALT1 | NOT1

=== SHEET: Active_Members ===
Column Headers:
Member ID | Employee No | Department | Join Date | Salary | Contribution | Status | Notes | Manager | Location

Data Sample:
MEM001 | EMP001 | Finance | 2015-01-01 | 45000 | 3825 | ACTIVE | | MGR001 | London
MEM002 | EMP002 | HR | 2016-03-15 | 38000 | 3230 | ACTIVE | | MGR002 | Manchester

=== SHEET: Deferred_Members ===
Column Headers:
Member ID | Leaving Date | Deferred Pension | Projected Pension | Revaluation | Transfer Option

Data Sample:
DEF001 | 2022-06-30 | 15000 | 18500 | Y | N
DEF002 | 2023-02-15 | 12000 | 14200 | Y | Y

... additional sheets with various pension scheme data columns ...
            """,
            "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }],
        "project_schema": {
            "schema_fields": [],
            "collections": [{
                "collectionName": "Column Name Mapping",
                "properties": [
                    {"id": "767bc354-2646-479b-b63d-5a1578c9ff8a", "propertyName": "Worksheet Name", "propertyType": "TEXT"},
                    {"id": "bb243624-8e70-4489-b243-ec2ae8fad363", "propertyName": "Column Heading", "propertyType": "TEXT"}
                ]
            }]
        },
        "extraction_rules": [],
        "knowledge_documents": [],
        "session_name": "capacity_test"
    }
    
    print("🚀 Testing increased AI extraction capacity...")
    print(f"📊 Target: Extract 185+ column mappings from enhanced Excel data")
    print(f"⚙️ Enhanced capacity: 250 records per collection")
    print(f"📄 Content length: {len(extraction_input['documents'][0]['file_content'])} characters")
    print()
    
    try:
        input_json = json.dumps(extraction_input)
        
        process = subprocess.Popen(
            ['python3', 'ai_extraction_simplified.py'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate(input=input_json)
        
        if process.returncode == 0:
            try:
                result = json.loads(stdout)
                field_validations = result.get('field_validations', [])
                
                print(f"✅ Extraction completed successfully!")
                print(f"📊 Generated {len(field_validations)} field validations")
                
                # Count Column Name Mapping items
                column_mappings = [fv for fv in field_validations 
                                 if fv.get('collection_name') == 'Column Name Mapping']
                
                # Group by record_index to count unique records
                unique_records = set()
                worksheet_columns = {}
                
                for mapping in column_mappings:
                    record_idx = mapping.get('record_index', 0)
                    field_name = mapping.get('field_name', '')
                    extracted_value = mapping.get('extracted_value', '')
                    
                    unique_records.add(record_idx)
                    
                    # Track worksheet columns
                    if 'Worksheet Name' in field_name:
                        worksheet = extracted_value
                        if worksheet not in worksheet_columns:
                            worksheet_columns[worksheet] = 0
                    elif 'Column Heading' in field_name:
                        # Find corresponding worksheet for this record
                        worksheet_name_field = f"Column Name Mapping.Worksheet Name[{record_idx}]"
                        worksheet_validation = next((fv for fv in column_mappings 
                                                   if fv.get('field_name') == worksheet_name_field), None)
                        if worksheet_validation:
                            worksheet = worksheet_validation.get('extracted_value', 'Unknown')
                            if worksheet in worksheet_columns:
                                worksheet_columns[worksheet] += 1
                
                unique_record_count = len(unique_records)
                
                print(f"🎯 Unique Column Name Mapping records: {unique_record_count}")
                print(f"🎯 Target reached: {'✅ YES' if unique_record_count >= 185 else '❌ NO'}")
                print()
                
                print("📋 Worksheet breakdown:")
                for worksheet, column_count in worksheet_columns.items():
                    print(f"  • {worksheet}: {column_count} columns")
                
                print()
                print("🔍 Sample column mappings:")
                for i, mapping in enumerate(column_mappings[:10]):
                    if 'Column Heading' in mapping.get('field_name', ''):
                        record_idx = mapping.get('record_index', 0)
                        column_name = mapping.get('extracted_value', '')
                        worksheet_name_field = f"Column Name Mapping.Worksheet Name[{record_idx}]"
                        worksheet_validation = next((fv for fv in column_mappings 
                                                   if fv.get('field_name') == worksheet_name_field), None)
                        worksheet = worksheet_validation.get('extracted_value', 'Unknown') if worksheet_validation else 'Unknown'
                        print(f"  {i+1}. {worksheet} -> {column_name}")
                
                if unique_record_count < 185:
                    print()
                    print(f"📈 Progress: {unique_record_count}/185 ({unique_record_count/185*100:.1f}%)")
                    print(f"🎯 Need {185 - unique_record_count} more records to reach target")
                else:
                    print()
                    print(f"🎉 SUCCESS! Exceeded target with {unique_record_count} records")
                
                return unique_record_count >= 185
                
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse AI response: {e}")
                print(f"Raw output (first 500 chars): {stdout[:500]}")
                return False
        else:
            print(f"❌ AI extraction failed with return code {process.returncode}")
            print(f"Error: {stderr}")
            return False
            
    except Exception as e:
        print(f"❌ Failed to run extraction: {e}")
        return False

if __name__ == "__main__":
    success = test_increased_capacity()
    
    if success:
        print("\n🎉 Capacity increase successful! Ready for 185+ collection items.")
    else:
        print("\n🔧 Further optimization needed to reach 185+ items.")