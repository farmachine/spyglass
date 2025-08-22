import sys
import json

# Test with the actual document content that should be passed
document_content = """=== Sheet: New_Pensioners ===
Old Member's Reference No	Member's Reference No	Employer Code	Sex Code	Date of Birth	Date Became Pensioner	Code For Previous Status	Type Of Retirement	Date Of Exit From Active Service	Annual Pre-6.4.1988 GMP Component At Date Of Exit From Active Service	Annual Post-5.4.1988 GMP Component At Date Of Exit From Active Service	Annual Pre-6.4.1988 GMP Component At Date Of This Valuation	Annual Post-5.4.1988 GMP Component At Date Of This Valuation	Component Of Pension At This Valuation Subject To CPI (capped At 2.5%)	Component Of Pension At This Valuation Subject To CPI (capped At 5%)	Component Of Pension At This Valuation Subject To Increases In Excess Of GMP	Component Of Pension At This Valuation Subject To LPI	Component Of Pension At This Valuation In Payment At Fixed Rate	Date Pensionable Service Commenced
AD134226	MNM		M	1964-06-10 00:00:00	1984-01-03 00:00:00	2018-09-30 00:00:00	RTA_06092016	2016-09-06 00:00:00	0	0	1212.89	3105.17	0	0	0	0	90000	1974-01-01 00:00:00"""

# Parse to find column headers
lines = document_content.strip().split('\n')
for i, line in enumerate(lines):
    if line.startswith('=== Sheet:'):
        # Next line should be headers
        if i + 1 < len(lines):
            headers_line = lines[i + 1]
            columns = [col.strip() for col in headers_line.split('\t') if col.strip()]
            print(f"Found {len(columns)} columns in sheet")
            print(f"First 5 columns: {columns[:5]}")
            print(f"Last 5 columns: {columns[-5:]}")
            break

