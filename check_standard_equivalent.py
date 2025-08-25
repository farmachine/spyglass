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
    
    # Find the Standard Equivalent value_id
    cur.execute("""
        SELECT sv.id, sv.value_name, sv.tool_id, sv.input_values
        FROM step_values sv
        JOIN workflow_steps ws ON sv.step_id = ws.id
        WHERE ws.project_id = '915d87a3-dd55-401e-8f8b-df38132c2215'
        AND ws.step_name = 'Column Name Mapping'
        AND sv.value_name = 'Standard Equivalent'
    """)
    
    std_equiv = cur.fetchone()
    if not std_equiv:
        print("❌ Standard Equivalent field not found")
        exit(1)
    
    print(f"✅ Found Standard Equivalent field")
    print(f"   ID: {std_equiv['id']}")
    print(f"   Tool ID: {std_equiv['tool_id']}")
    print(f"   Input Values: {json.dumps(std_equiv['input_values'], indent=2) if std_equiv['input_values'] else 'None'}")
    
    # Get the tool details
    if std_equiv['tool_id']:
        cur.execute("""
            SELECT name, tool_type 
            FROM excel_wizardry_functions 
            WHERE id = %s
        """, (std_equiv['tool_id'],))
        
        tool = cur.fetchone()
        if tool:
            print(f"\n📧 Tool configured:")
            print(f"   Name: {tool['name']}")
            print(f"   Type: {tool['tool_type']}")
    
    # Check extraction results
    cur.execute("""
        SELECT 
            identifier_id,
            extracted_value,
            validation_status,
            confidence_score,
            ai_reasoning,
            record_index
        FROM field_validations
        WHERE session_id = '29e7713e-e4b9-4966-b414-5f4393164266'
        AND collection_name = 'Column Name Mapping'
        AND value_id = %s
        ORDER BY record_index
        LIMIT 20
    """, (std_equiv['id'],))
    
    results = cur.fetchall()
    
    print(f"\n📊 Sample extraction results (first 20):")
    null_count = 0
    success_count = 0
    
    for i, result in enumerate(results):
        if result['extracted_value'] is None or result['extracted_value'] == '':
            null_count += 1
            status = "❌ NULL"
        else:
            success_count += 1
            status = f"✅ {result['extracted_value'][:50]}"
        
        print(f"{i+1}. Row {result['record_index']}: {status}")
        print(f"   Identifier: {result['identifier_id']}")
        if result['ai_reasoning']:
            print(f"   Reason: {result['ai_reasoning'][:100]}...")
    
    # Get overall stats
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN extracted_value IS NOT NULL AND extracted_value != '' THEN 1 END) as success,
            COUNT(CASE WHEN extracted_value IS NULL OR extracted_value = '' THEN 1 END) as failed
        FROM field_validations
        WHERE session_id = '29e7713e-e4b9-4966-b414-5f4393164266'
        AND collection_name = 'Column Name Mapping'
        AND value_id = %s
    """, (std_equiv['id'],))
    
    stats = cur.fetchone()
    print(f"\n📈 Overall statistics:")
    print(f"   Total: {stats['total']}")
    print(f"   Success: {stats['success']} ({(stats['success']/stats['total']*100):.1f}%)")
    print(f"   Failed: {stats['failed']} ({(stats['failed']/stats['total']*100):.1f}%)")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
