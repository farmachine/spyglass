"""
Database utilities for PostgreSQL operations
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
import json
import logging
from typing import List, Dict, Any, Optional
from contextlib import contextmanager

# Configure logging
logger = logging.getLogger(__name__)

class DatabaseConnection:
    """
    Manages PostgreSQL database connections and operations
    """
    
    def __init__(self, connection_string: Optional[str] = None):
        """
        Initialize database connection
        
        Parameters:
            connection_string (str): PostgreSQL connection string
        """
        self.connection_string = connection_string or os.getenv('DATABASE_URL')
        if not self.connection_string:
            raise ValueError("Database connection string not found. Set DATABASE_URL environment variable.")
    
    @contextmanager
    def get_connection(self):
        """
        Context manager for database connections
        
        Yields:
            connection: Database connection object
        """
        conn = None
        try:
            conn = psycopg2.connect(self.connection_string)
            yield conn
        except psycopg2.Error as e:
            logger.error(f"Database connection error: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def fetch_one(self, query: str, params: tuple = None) -> Optional[Dict[str, Any]]:
        """
        Fetch a single row from database
        
        Parameters:
            query (str): SQL query
            params (tuple): Query parameters
            
        Returns:
            dict: Single row as dictionary or None
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                result = cursor.fetchone()
                return dict(result) if result else None
    
    def fetch_all(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """
        Fetch all rows from database
        
        Parameters:
            query (str): SQL query
            params (tuple): Query parameters
            
        Returns:
            list: List of rows as dictionaries
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                results = cursor.fetchall()
                return [dict(row) for row in results]
    
    def execute(self, query: str, params: tuple = None) -> int:
        """
        Execute a query (INSERT, UPDATE, DELETE)
        
        Parameters:
            query (str): SQL query
            params (tuple): Query parameters
            
        Returns:
            int: Number of affected rows
        """
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                conn.commit()
                return cursor.rowcount
    
    def insert_and_return(self, query: str, params: tuple = None) -> Optional[Dict[str, Any]]:
        """
        Insert and return the created row
        
        Parameters:
            query (str): INSERT query with RETURNING clause
            params (tuple): Query parameters
            
        Returns:
            dict: Created row as dictionary
        """
        with self.get_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                conn.commit()
                result = cursor.fetchone()
                return dict(result) if result else None
    
    def batch_insert(self, table: str, columns: List[str], values: List[tuple]) -> int:
        """
        Batch insert multiple rows
        
        Parameters:
            table (str): Table name
            columns (list): Column names
            values (list): List of value tuples
            
        Returns:
            int: Number of inserted rows
        """
        if not values:
            return 0
            
        placeholders = ','.join(['%s'] * len(columns))
        query = f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders})"
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.executemany(query, values)
                conn.commit()
                return cursor.rowcount


# Function utility methods for backward compatibility
def fetch_excel_function(function_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch Excel function details from database
    
    Parameters:
        function_id (str): Function UUID
        
    Returns:
        dict: Function details or None
    """
    db = DatabaseConnection()
    query = """
        SELECT id, name, function_code, input_parameters, 
               output_format, description, tool_type
        FROM excel_wizardry_functions 
        WHERE id = %s
    """
    return db.fetch_one(query, (function_id,))


def fetch_step_values(step_id: str) -> List[Dict[str, Any]]:
    """
    Fetch step values for a workflow step
    
    Parameters:
        step_id (str): Workflow step UUID
        
    Returns:
        list: List of step values
    """
    db = DatabaseConnection()
    query = """
        SELECT id, step_id, value_name, data_type, tool_id, 
               is_identifier, order_index, input_values, fields
        FROM step_values 
        WHERE step_id = %s 
        ORDER BY order_index
    """
    return db.fetch_all(query, (step_id,))


def fetch_validation_records(field_id: str, session_id: str = None) -> List[Dict[str, Any]]:
    """
    Fetch validation records for a field
    
    Parameters:
        field_id (str): Field UUID
        session_id (str): Session UUID (optional)
        
    Returns:
        list: List of validation records
    """
    db = DatabaseConnection()
    
    if session_id:
        query = """
            SELECT id, field_id, identifier_id, extracted_value, 
                   validation_status, ai_reasoning, confidence_score
            FROM field_validations 
            WHERE field_id = %s AND session_id = %s
            ORDER BY created_at DESC
        """
        params = (field_id, session_id)
    else:
        query = """
            SELECT id, field_id, identifier_id, extracted_value, 
                   validation_status, ai_reasoning, confidence_score
            FROM field_validations 
            WHERE field_id = %s
            ORDER BY created_at DESC
        """
        params = (field_id,)
    
    return db.fetch_all(query, params)


def update_validation_status(validation_id: str, status: str, reasoning: str = None) -> bool:
    """
    Update validation status
    
    Parameters:
        validation_id (str): Validation record UUID
        status (str): New status (valid/invalid/pending)
        reasoning (str): AI reasoning (optional)
        
    Returns:
        bool: Success status
    """
    db = DatabaseConnection()
    
    if reasoning:
        query = """
            UPDATE field_validations 
            SET validation_status = %s, ai_reasoning = %s, updated_at = NOW()
            WHERE id = %s
        """
        params = (status, reasoning, validation_id)
    else:
        query = """
            UPDATE field_validations 
            SET validation_status = %s, updated_at = NOW()
            WHERE id = %s
        """
        params = (status, validation_id)
    
    return db.execute(query, params) > 0