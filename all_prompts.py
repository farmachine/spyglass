"""
Centralized prompt management for Extractly AI-powered document processing.
All prompts used throughout the system are defined here for easy maintenance and consistency.
"""

# Document format analysis prompt
DOCUMENT_FORMAT_ANALYSIS = """Analyze these documents and determine their format. For each document, return ONLY one word: "Excel", "Word", or "PDF".

Documents to analyze:
{documents}

Return format: One word per document, separated by newlines."""

# Main extraction prompt template
MAIN_EXTRACTION_PROMPT = """You are an AI assistant specialized in extracting structured data from documents. 
Analyze the provided documents and extract the requested information according to the schema below.

Schema: {schema}
Documents: {documents}

Instructions:
- Extract data accurately from the documents
- Follow the schema structure exactly
- Return data in JSON format
- If information is not found, use null values"""

# Field validation prompt
FIELD_VALIDATION_PROMPT = """Validate the extracted field data against the source document.

Field: {field_name}
Extracted Value: {extracted_value}
Source Document: {document_content}

Determine if the extracted value is accurate and provide confidence score (0-100)."""

# Knowledge-based extraction prompt
KNOWLEDGE_EXTRACTION_PROMPT = """Extract data using the provided knowledge base as reference.

Knowledge Base: {knowledge_base}
Document: {document}
Target Fields: {target_fields}

Use the knowledge base to guide extraction and ensure consistency with established patterns."""

# Collection processing prompt
COLLECTION_PROCESSING_PROMPT = """Extract collection data from the document.

Collection Schema: {collection_schema}
Document: {document}
Existing Records: {existing_records}

Extract new collection items that are not already present in existing records."""

# Conflict detection prompt
CONFLICT_DETECTION_PROMPT = """Analyze the extracted data for potential conflicts or inconsistencies.

Extracted Data: {extracted_data}
Reference Data: {reference_data}

Identify any conflicts and suggest resolutions."""

# Session summary prompt
SESSION_SUMMARY_PROMPT = """Generate a summary of the extraction session.

Session Data: {session_data}
Validation Results: {validation_results}

Provide a comprehensive summary of what was extracted and validated."""

# Error handling prompt
ERROR_HANDLING_PROMPT = """Analyze the error and provide a solution.

Error: {error_message}
Context: {context}

Suggest steps to resolve the issue."""

# Chat context prompt
CHAT_CONTEXT_PROMPT = """You are an AI assistant helping with document data extraction. 
You have access to the current session data and can answer questions about the extracted information.

Session Context: {session_context}
User Question: {user_question}

Provide helpful answers based on the session data."""