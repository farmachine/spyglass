-- Insert Column Heading validation records
INSERT INTO field_validations (
    session_id,
    field_id,
    collection_name,
    extracted_value,
    confidence_score,
    validation_status,
    validation_type,
    data_type,
    ai_reasoning,
    record_index,
    batch_number,
    manually_verified,
    manually_updated,
    original_extracted_value,
    original_confidence_score,
    original_ai_reasoning,
    document_source,
    document_sections,
    created_at,
    updated_at
) VALUES
('f15121bb-8d87-412b-891e-a08e052dce94', '34580f0d-321f-498a-b1c0-6162ad831122', 'Column Name Mapping', 'NI Number', 95, 'unverified', 'collection_property', 'TEXT', 'Column header extracted from row 1 of Excel sheet', 0, 1, false, false, 'NI Number', 95, 'Column header extracted from row 1 of Excel sheet', '5b0c3f7c-f948-4ae7-aa7c-e0000e11e4b5', 'Sheet1:Row1', NOW(), NOW()),
('f15121bb-8d87-412b-891e-a08e052dce94', '34580f0d-321f-498a-b1c0-6162ad831122', 'Column Name Mapping', 'Surname', 95, 'unverified', 'collection_property', 'TEXT', 'Column header extracted from row 1 of Excel sheet', 1, 1, false, false, 'Surname', 95, 'Column header extracted from row 1 of Excel sheet', '5b0c3f7c-f948-4ae7-aa7c-e0000e11e4b5', 'Sheet1:Row1', NOW(), NOW()),
('f15121bb-8d87-412b-891e-a08e052dce94', '34580f0d-321f-498a-b1c0-6162ad831122', 'Column Name Mapping', 'Forename', 95, 'unverified', 'collection_property', 'TEXT', 'Column header extracted from row 1 of Excel sheet', 2, 1, false, false, 'Forename', 95, 'Column header extracted from row 1 of Excel sheet', '5b0c3f7c-f948-4ae7-aa7c-e0000e11e4b5', 'Sheet1:Row1', NOW(), NOW()),
('f15121bb-8d87-412b-891e-a08e052dce94', '34580f0d-321f-498a-b1c0-6162ad831122', 'Column Name Mapping', 'Date of Birth', 95, 'unverified', 'collection_property', 'TEXT', 'Column header extracted from row 1 of Excel sheet', 3, 1, false, false, 'Date of Birth', 95, 'Column header extracted from row 1 of Excel sheet', '5b0c3f7c-f948-4ae7-aa7c-e0000e11e4b5', 'Sheet1:Row1', NOW(), NOW()),
('f15121bb-8d87-412b-891e-a08e052dce94', '34580f0d-321f-498a-b1c0-6162ad831122', 'Column Name Mapping', 'Gender', 95, 'unverified', 'collection_property', 'TEXT', 'Column header extracted from row 1 of Excel sheet', 4, 1, false, false, 'Gender', 95, 'Column header extracted from row 1 of Excel sheet', '5b0c3f7c-f948-4ae7-aa7c-e0000e11e4b5', 'Sheet1:Row1', NOW(), NOW());