"""
Global constants for the application
"""

# Content and Text Processing
MAX_CONTENT_LENGTH = 5000000  # Maximum length for text content (5MB to handle large Excel files)
MAX_TOKEN_LIMIT = 8192     # Token limit for AI models
DEFAULT_BATCH_SIZE = 10    # Default batch size for processing
MAX_BATCH_SIZE_COLUMN_NAME = 10  # Maximum batch size for column name extraction

# AI Configuration
DEFAULT_AI_MODEL = "gemini-2.5-pro"
FLASH_AI_MODEL = "gemini-2.5-flash"
IMAGE_GEN_MODEL = "gemini-2.0-flash-preview-image-generation"
DEFAULT_TEMPERATURE = 0.7
MAX_RETRIES = 3
AI_TIMEOUT = 30000  # milliseconds

# Confidence Scores
MIN_CONFIDENCE_SCORE = 70
DEFAULT_CONFIDENCE_SCORE = 85
HIGH_CONFIDENCE_SCORE = 95

# Database
DB_CONNECTION_TIMEOUT = 5000  # milliseconds
DB_MAX_CONNECTIONS = 20
DB_IDLE_TIMEOUT = 10000  # milliseconds

# File Processing
MAX_FILE_SIZE = 10485760  # 10MB in bytes
EXTRACTION_TIMEOUT = 120000  # milliseconds

# Regular Expressions
EMAIL_REGEX = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
PHONE_REGEX = r'^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$'
UUID_REGEX = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

# Allowed MIME Types
ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg'
]

# Date Formats
DATE_FORMATS = [
    '%Y-%m-%d',
    '%d/%m/%Y', 
    '%m/%d/%Y',
    '%Y/%m/%d',
    '%d-%m-%Y',
    '%m-%d-%Y'
]

# Validation Status
VALIDATION_STATUS = {
    'VALID': 'valid',
    'INVALID': 'invalid',
    'PENDING': 'pending',
    'REVIEW': 'review_required'
}

# Operation Types
OPERATION_TYPES = {
    'CREATE': 'CREATE',
    'UPDATE': 'UPDATE',
    'DELETE': 'DELETE',
    'READ': 'READ'
}

# Error Messages
ERROR_MESSAGES = {
    'INVALID_INPUT': 'Invalid input provided',
    'DB_CONNECTION_FAILED': 'Failed to connect to database',
    'AI_EXTRACTION_FAILED': 'AI extraction failed',
    'FILE_TOO_LARGE': 'File size exceeds maximum limit',
    'UNSUPPORTED_FILE_TYPE': 'File type not supported',
    'MISSING_REQUIRED_FIELD': 'Required field is missing',
    'UNAUTHORIZED_ACCESS': 'Unauthorized access',
    'RESOURCE_NOT_FOUND': 'Requested resource not found'
}