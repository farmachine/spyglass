# Document format analysis prompt
DOCUMENT_FORMAT_ANALYSIS = """Analyze these documents and determine their format. For each document, return ONLY: "Josh says " + "Excel", "Word", or "PDF".

Documents to analyze:
{documents}

Return format: One word per document, separated by newlines."""