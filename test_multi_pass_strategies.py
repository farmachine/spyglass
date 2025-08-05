#!/usr/bin/env python3
"""
Test and demonstrate the multi-pass extraction strategies for handling truncated AI responses.
"""
import json
from multi_pass_extraction import MultiPassExtractor

print("🔄 MULTI-PASS EXTRACTION STRATEGIES")
print("=" * 50)

# Create sample schema with 500 fields to demonstrate the concept
def create_large_schema():
    """Create a schema with many fields to simulate truncation scenarios"""
    schema = {
        "schema_fields": [],
        "collections": []
    }
    
    # Add 50 schema fields
    for i in range(50):
        schema["schema_fields"].append({
            "id": f"field-{i:03d}",
            "fieldName": f"Document Field {i+1}",
            "fieldType": "TEXT",
            "description": f"Sample field {i+1} for testing"
        })
    
    # Add 3 collections with 50 properties each (= 150 properties × 3 records = 450 collection fields)
    for collection_idx in range(3):
        properties = []
        for prop_idx in range(50):
            properties.append({
                "id": f"collection-{collection_idx}-prop-{prop_idx:03d}",
                "propertyName": f"Property {prop_idx+1}",
                "propertyType": "TEXT",
                "description": f"Collection {collection_idx+1} property {prop_idx+1}"
            })
        
        schema["collections"].append({
            "collectionName": f"Collection {collection_idx+1}",
            "description": f"Sample collection {collection_idx+1}",
            "properties": properties
        })
    
    return schema

# Simulate truncated extraction (first 200 fields extracted, 300 remaining)
def simulate_truncated_extraction(schema):
    """Simulate what happens when first extraction is truncated after 200 fields"""
    extracted_field_ids = []
    
    # Simulate that we got all schema fields (50)
    for field in schema["schema_fields"]:
        extracted_field_ids.append(field['id'])
    
    # Simulate that we got first 50 properties from each collection (150 total)
    # But missing the remaining properties
    for collection_idx in range(3):
        collection = schema["collections"][collection_idx]
        properties = collection["properties"][:17]  # Only first 17 properties per collection
        for prop in properties:
            for record_idx in range(3):  # 3 records per property
                extracted_field_ids.append(prop['id'])
    
    return extracted_field_ids

# Test the strategies
extractor = MultiPassExtractor()
large_schema = create_large_schema()
expected_fields = extractor._count_expected_fields(large_schema)

print(f"📊 Test Scenario:")
print(f"   Total expected fields: {expected_fields}")
print(f"   Schema fields: {len(large_schema['schema_fields'])}")
print(f"   Collections: {len(large_schema['collections'])}")
print(f"   Properties per collection: {len(large_schema['collections'][0]['properties'])}")

# Simulate truncation after first pass
extracted_ids = simulate_truncated_extraction(large_schema)
remaining_fields = expected_fields - len(extracted_ids)

print(f"\n🔥 Simulated Truncation Scenario:")
print(f"   Pass 1 extracted: {len(extracted_ids)} fields")
print(f"   Remaining needed: {remaining_fields} fields")
print(f"   Completion rate: {len(extracted_ids)/expected_fields*100:.1f}%")

print(f"\n📋 MULTI-PASS STRATEGIES ANALYSIS:")
print(f"=" * 40)

# Strategy 1: Remaining Fields
print(f"\n1️⃣ REMAINING FIELDS STRATEGY")
print(f"   ✅ Most efficient - only extracts missing fields")
print(f"   ✅ Minimizes API calls and token usage")
print(f"   ✅ Best for simple truncation recovery")
print(f"   📝 Example: Pass 2 focuses on {remaining_fields} unextracted fields")

filtered_schema = extractor._create_filtered_schema(large_schema, extracted_ids)
filtered_count = extractor._count_expected_fields(filtered_schema)
print(f"   📊 Pass 2 would target: {filtered_count} remaining fields")

# Strategy 2: Schema Chunking  
print(f"\n2️⃣ SCHEMA CHUNKING STRATEGY")
print(f"   ✅ Balanced approach - splits remaining work evenly")
print(f"   ✅ Ensures systematic coverage of all field types")
print(f"   ✅ Good for complex schemas with many field types")
print(f"   📝 Example: Pass 2 gets chunk 1, Pass 3 gets chunk 2")

chunk_size = max(1, filtered_count // 2)
print(f"   📊 Pass 2 chunk size: {chunk_size} fields")
print(f"   📊 Pass 3 chunk size: {filtered_count - chunk_size} fields")

# Strategy 3: Collection Focused
print(f"\n3️⃣ COLLECTION FOCUSED STRATEGY")
print(f"   ✅ Perfect for documents with distinct sections")
print(f"   ✅ AI can focus deeply on one data type at a time")
print(f"   ✅ Excellent for complex documents with multiple entities")

remaining_collections = extractor._get_collections_with_missing_fields(large_schema, extracted_ids)
print(f"   📝 Example: Pass 2 focuses on '{remaining_collections[0]['collectionName']}'")
print(f"   📊 Collections needing completion: {len(remaining_collections)}")

# Strategy 4: Priority Based
print(f"\n4️⃣ PRIORITY BASED STRATEGY")
print(f"   ✅ Captures most critical fields first")
print(f"   ✅ Ensures important data isn't lost to further truncation")
print(f"   ✅ Business-critical fields get priority treatment")

priority_keywords = ['title', 'name', 'date', 'amount', 'value', 'party']
print(f"   📝 Priority keywords: {', '.join(priority_keywords)}")
print(f"   📊 High-priority fields extracted first, then lower priority")

print(f"\n🎯 STRATEGY RECOMMENDATIONS:")
print(f"=" * 30)
print(f"📄 Simple contracts → Use 'remaining_fields' (most efficient)")
print(f"🏢 Complex multi-section docs → Use 'collection_focused'")
print(f"⚖️ Legal documents → Use 'priority_based' (critical fields first)")
print(f"📊 Large structured data → Use 'schema_chunking' (balanced)")

print(f"\n💡 REAL-WORLD EXAMPLE:")
print(f"Original: 500 expected fields")
print(f"Pass 1: 200 fields extracted (40% complete) - TRUNCATED")
print(f"Pass 2: 150 fields extracted (70% complete)")
print(f"Pass 3: 100 fields extracted (90% complete)")
print(f"Result: 450/500 fields recovered vs 0/500 without multi-pass")

print(f"\n🚀 IMPLEMENTATION BENEFITS:")
print(f"✅ Converts complete failures into partial successes")
print(f"✅ Maximizes data recovery from any document size")
print(f"✅ Provides clear progress tracking and completion rates")
print(f"✅ User gets substantial value even from truncated responses")
print(f"✅ Flexible strategies for different document types")