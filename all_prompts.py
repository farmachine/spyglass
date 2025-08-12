# Document format analysis prompt
DOCUMENT_FORMAT_ANALYSIS = """Analyze these documents and determine their format. Either "Excel", "Word", or "PDF".

Documents to analyze:
{documents}

Fields to extract:
{target_fields}

Then based on the format, look at the provided descriptions of the target field and determine which of the following extraction processes to use:

- Excel Column Extraction: Extracts a list of all columns within an excel document.
- Excel Sheet Extraction: Extracts all sheets within an excel document.
- AI Extraction: Uses AI to extract the data from the document.

Just return the name of the extraction process to use.

"""