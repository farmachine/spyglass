"""
Logging configuration for the application
"""

import logging
import logging.handlers
import os
import json
from datetime import datetime

def setup_logger(name: str = None, log_level: str = "INFO") -> logging.Logger:
    """
    Set up a logger with file and console handlers
    
    Parameters:
        name (str): Logger name (defaults to root logger)
        log_level (str): Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    
    Returns:
        logging.Logger: Configured logger instance
    """
    
    # Load configuration
    config_file = 'config.json'
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
                log_config = config.get('logging', {})
                log_level = log_config.get('level', 'INFO').upper()
        except Exception:
            pass
    
    # Create logger
    logger = logging.getLogger(name or __name__)
    logger.setLevel(getattr(logging, log_level))
    
    # Remove existing handlers to avoid duplicates
    logger.handlers.clear()
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    simple_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(simple_formatter)
    logger.addHandler(console_handler)
    
    # File handler (only if not in production to avoid file system issues)
    if os.getenv('NODE_ENV') != 'production':
        try:
            # Create logs directory if it doesn't exist
            log_dir = 'logs'
            if not os.path.exists(log_dir):
                os.makedirs(log_dir)
            
            # Create rotating file handler
            file_handler = logging.handlers.RotatingFileHandler(
                filename=os.path.join(log_dir, f'{name or "app"}.log'),
                maxBytes=10*1024*1024,  # 10MB
                backupCount=5,
                encoding='utf-8'
            )
            file_handler.setLevel(logging.DEBUG)
            file_handler.setFormatter(detailed_formatter)
            logger.addHandler(file_handler)
        except Exception as e:
            print(f"Warning: Could not set up file logging: {e}")
    
    return logger


def log_error(logger: logging.Logger, error: Exception, context: str = None) -> None:
    """
    Log an error with context
    
    Parameters:
        logger: Logger instance
        error: Exception to log
        context: Additional context information
    """
    error_msg = f"Error: {str(error)}"
    if context:
        error_msg = f"{context} - {error_msg}"
    
    logger.error(error_msg, exc_info=True)


def log_api_request(logger: logging.Logger, method: str, endpoint: str, 
                   params: dict = None, response_time: float = None) -> None:
    """
    Log API request details
    
    Parameters:
        logger: Logger instance
        method: HTTP method
        endpoint: API endpoint
        params: Request parameters
        response_time: Response time in seconds
    """
    log_msg = f"API Request: {method} {endpoint}"
    
    if params:
        # Don't log sensitive data
        safe_params = {k: v for k, v in params.items() 
                      if 'password' not in k.lower() and 'token' not in k.lower()}
        log_msg += f" - Params: {safe_params}"
    
    if response_time:
        log_msg += f" - Response time: {response_time:.2f}s"
    
    logger.info(log_msg)


def log_extraction_start(logger: logging.Logger, extraction_type: str, 
                        document_count: int = None, field_count: int = None) -> None:
    """
    Log the start of an extraction process
    
    Parameters:
        logger: Logger instance
        extraction_type: Type of extraction
        document_count: Number of documents
        field_count: Number of fields
    """
    log_msg = f"Starting {extraction_type} extraction"
    
    if document_count:
        log_msg += f" for {document_count} document(s)"
    
    if field_count:
        log_msg += f" with {field_count} field(s)"
    
    logger.info(log_msg)


def log_extraction_complete(logger: logging.Logger, extraction_type: str, 
                          success_count: int, failure_count: int = 0,
                          duration: float = None) -> None:
    """
    Log the completion of an extraction process
    
    Parameters:
        logger: Logger instance
        extraction_type: Type of extraction
        success_count: Number of successful extractions
        failure_count: Number of failed extractions
        duration: Duration in seconds
    """
    log_msg = f"Completed {extraction_type} extraction - Success: {success_count}"
    
    if failure_count > 0:
        log_msg += f", Failures: {failure_count}"
    
    if duration:
        log_msg += f" - Duration: {duration:.2f}s"
    
    if failure_count > 0:
        logger.warning(log_msg)
    else:
        logger.info(log_msg)


def sanitize_log_data(data: dict) -> dict:
    """
    Remove sensitive information from data before logging
    
    Parameters:
        data: Data dictionary
    
    Returns:
        dict: Sanitized data
    """
    sensitive_keys = ['password', 'token', 'key', 'secret', 'api_key', 'credential']
    
    sanitized = {}
    for key, value in data.items():
        if any(sensitive in key.lower() for sensitive in sensitive_keys):
            sanitized[key] = '***REDACTED***'
        elif isinstance(value, dict):
            sanitized[key] = sanitize_log_data(value)
        else:
            sanitized[key] = value
    
    return sanitized