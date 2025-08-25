import os
import psycopg2
from psycopg2.extras import RealDictCursor
import json

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("❌ DATABASE_URL not found")
    exit(1)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get the three field IDs
    cur.execute("""
        SELECT sv.id, sv.value_name
        FROM step_values sv
        JOIN workflow_steps ws ON sv.step_id = ws.id
        WHERE ws.project_id = '915d87a3-dd55-401e-8f8b-df38132c2215'
        AND ws.step_name = 'Column Name Mapping'
        ORDER BY sv.order_index
    """)
    
    fields = cur.fetchall()
    print("📋 Column Name Mapping fields:")
    field_map = {}
    for field in fields:
        field_map[field['value_name']] = field['id']
        print(f"   {field['value_name']}: {field['id']}")
    
    # Now check identifier consistency across the three fields for first 10 records
    print("\n🔍 Checking identifier consistency (first 10 records):")
    print("-" * 100)
    
    for record_index in range(10):
        print(f"\n📌 Record {record_index}:")
        
        # Get ID field value and identifier
        cur.execute("""
            SELECT identifier_id, extracted_value
            FROM field_validations
            WHERE session_id = '29e7713e-e4b9-4966-b414-5f4393164266'
            AND collection_name = 'Column Name Mapping'
            AND value_id = %s
            AND record_index = %s
        """, (field_map['ID'], record_index))
        
        id_result = cur.fetchone()
        if id_result:
            print(f"   ID: {id_result['extracted_value'][:40]}... | identifier: {id_result['identifier_id']}")
        
        # Get Worksheet Name value and identifier  
        cur.execute("""
            SELECT identifier_id, extracted_value
            FROM field_validations
            WHERE session_id = '29e7713e-e4b9-4966-b414-5f4393164266'
            AND collection_name = 'Column Name Mapping'
            AND value_id = %s
            AND record_index = %s
        """, (field_map['Worksheet Name'], record_index))
        
        ws_result = cur.fetchone()
        if ws_result:
            print(f"   Worksheet: {ws_result['extracted_value'] or 'NULL'} | identifier: {ws_result['identifier_id']}")
        
        # Get Standard Equivalent value and identifier
        cur.execute("""
            SELECT identifier_id, extracted_value, ai_reasoning
            FROM field_validations
            WHERE session_id = '29e7713e-e4b9-4966-b414-5f4393164266'
            AND collection_name = 'Column Name Mapping'
            AND value_id = %s
            AND record_index = %s
        """, (field_map['Standard Equivalent'], record_index))
        
        std_result = cur.fetchone()
        if std_result:
            print(f"   Standard: {std_result['extracted_value'] or 'NULL'} | identifier: {std_result['identifier_id']}")
            if id_result and std_result['identifier_id'] != id_result['identifier_id']:
                print(f"   ⚠️ MISMATCH: Standard Equivalent has different identifier!")
    
    # Check if any Standard Equivalent records have the correct col_XXXX format
    print("\n📊 Checking identifier format in Standard Equivalent:")
    cur.execute("""
        SELECT identifier_id, COUNT(*) as count
        FROM field_validations
        WHERE session_id = '29e7713e-e4b9-4966-b414-5f4393164266'
        AND collection_name = 'Column Name Mapping'
        AND value_id = %s
        GROUP BY identifier_id
        ORDER BY identifier_id
        LIMIT 10
    """, (field_map['Standard Equivalent'],))
    
    id_formats = cur.fetchall()
    has_col_format = False
    has_uuid_format = False
    
    for fmt in id_formats:
        if fmt['identifier_id'].startswith('col_'):
            has_col_format = True
            print(f"   ✅ Correct format: {fmt['identifier_id']} ({fmt['count']} records)")
        else:
            has_uuid_format = True
            print(f"   ❌ Wrong format: {fmt['identifier_id']} ({fmt['count']} records)")
    
    if has_uuid_format and not has_col_format:
        print("\n❌ PROBLEM: All Standard Equivalent identifiers are UUIDs instead of col_XXXX format!")
        print("   This breaks the identifier mapping chain!")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
