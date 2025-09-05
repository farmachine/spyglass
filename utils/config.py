"""
Configuration loader with environment variable support
"""

import os
import json
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
env_path = Path('.') / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    # Try loading .env.example if .env doesn't exist (for development)
    env_example_path = Path('.') / '.env.example'
    if env_example_path.exists():
        load_dotenv(dotenv_path=env_example_path)

class Config:
    """
    Application configuration manager
    """
    
    def __init__(self):
        """Initialize configuration from config.json and environment variables"""
        self.config_data = self._load_config_file()
        self._override_with_env_vars()
    
    def _load_config_file(self) -> dict:
        """
        Load configuration from config.json
        
        Returns:
            dict: Configuration data
        """
        config_path = Path('.') / 'config.json'
        if config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Warning: Could not load config.json: {e}")
        return {}
    
    def _override_with_env_vars(self):
        """Override config values with environment variables where applicable"""
        # Database configuration
        if os.getenv('DATABASE_URL'):
            if 'database' not in self.config_data:
                self.config_data['database'] = {}
            self.config_data['database']['url'] = os.getenv('DATABASE_URL')
        
        # AI configuration
        if os.getenv('GEMINI_API_KEY'):
            if 'ai' not in self.config_data:
                self.config_data['ai'] = {}
            self.config_data['ai']['gemini_api_key'] = os.getenv('GEMINI_API_KEY')
        
        if os.getenv('GOOGLE_API_KEY'):
            if 'ai' not in self.config_data:
                self.config_data['ai'] = {}
            self.config_data['ai']['google_api_key'] = os.getenv('GOOGLE_API_KEY')
        
        # Server configuration
        if os.getenv('PORT'):
            if 'server' not in self.config_data:
                self.config_data['server'] = {}
            self.config_data['server']['port'] = int(os.getenv('PORT'))
        
        # Session configuration
        if os.getenv('SESSION_SECRET'):
            if 'server' not in self.config_data:
                self.config_data['server'] = {}
            self.config_data['server']['session_secret'] = os.getenv('SESSION_SECRET')
    
    def get(self, path: str, default=None):
        """
        Get configuration value by path (dot notation)
        
        Parameters:
            path (str): Configuration path (e.g., 'ai.models.default')
            default: Default value if path not found
        
        Returns:
            Configuration value or default
        """
        keys = path.split('.')
        value = self.config_data
        
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        
        return value
    
    def get_database_url(self) -> str:
        """
        Get database connection URL
        
        Returns:
            str: Database URL
        """
        return os.getenv('DATABASE_URL') or self.get('database.url')
    
    def get_api_key(self, service: str = 'gemini') -> str:
        """
        Get API key for a service
        
        Parameters:
            service (str): Service name (gemini, google, openai)
        
        Returns:
            str: API key
        """
        env_var = f"{service.upper()}_API_KEY"
        return os.getenv(env_var) or self.get(f'ai.{service}_api_key', '')
    
    def get_ai_model(self, model_type: str = 'default') -> str:
        """
        Get AI model name
        
        Parameters:
            model_type (str): Model type (default, extraction, flash)
        
        Returns:
            str: Model name
        """
        return self.get(f'ai.models.{model_type}', 'gemini-2.5-pro')
    
    def get_extraction_config(self) -> dict:
        """
        Get extraction configuration
        
        Returns:
            dict: Extraction configuration
        """
        return self.get('extraction', {
            'maxContentLength': 2000,
            'batchSize': 10,
            'tokenLimit': 8192,
            'minConfidenceScore': 70
        })
    
    def get_logging_config(self) -> dict:
        """
        Get logging configuration
        
        Returns:
            dict: Logging configuration
        """
        return self.get('logging', {
            'level': 'INFO',
            'enableFileLogging': True,
            'logFilePath': 'logs/app.log'
        })
    
    def is_debug_enabled(self) -> bool:
        """
        Check if debug mode is enabled
        
        Returns:
            bool: Debug mode status
        """
        return os.getenv('ENABLE_DEBUG_LOGGING', 'false').lower() == 'true'
    
    def is_production(self) -> bool:
        """
        Check if running in production
        
        Returns:
            bool: Production mode status
        """
        return os.getenv('NODE_ENV', 'development').lower() == 'production'


# Create global config instance
config = Config()

# Helper functions for backward compatibility
def get_config(path: str, default=None):
    """Get configuration value by path"""
    return config.get(path, default)

def get_database_url() -> str:
    """Get database URL"""
    return config.get_database_url()

def get_api_key(service: str = 'gemini') -> str:
    """Get API key for service"""
    return config.get_api_key(service)

def get_ai_model(model_type: str = 'default') -> str:
    """Get AI model name"""
    return config.get_ai_model(model_type)