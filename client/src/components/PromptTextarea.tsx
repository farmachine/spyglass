import React, { useState, useRef, useEffect } from 'react';
import { Textarea } from "@/components/ui/textarea";

interface ReferenceOption {
  id: string;
  name: string;
  type: string;
  description?: string;
  category: string;
}

interface PromptTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  knowledgeDocuments?: Array<{id: string, displayName?: string, fileName?: string, description?: string}>;
  referencedFields?: Array<{id: string, name: string, type: string, description?: string}>;
  referencedCollections?: Array<{id: string, name: string, description?: string}>;
  extractionRules?: Array<{id: string, ruleName: string, ruleContent?: string}>;
}

export function PromptTextarea({
  value,
  onChange,
  placeholder,
  rows = 5,
  className,
  knowledgeDocuments = [],
  referencedFields = [],
  referencedCollections = [],
  extractionRules = []
}: PromptTextareaProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [currentAtKey, setCurrentAtKey] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<ReferenceOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Build all available reference options
  const buildReferenceOptions = (): ReferenceOption[] => {
    const options: ReferenceOption[] = [];
    
    // Add knowledge documents
    knowledgeDocuments.forEach(doc => {
      options.push({
        id: `knowledge-document:${doc.id}`,
        name: doc.displayName || doc.fileName || 'Unnamed Document',
        type: 'Knowledge Document',
        description: doc.description,
        category: 'knowledge-document'
      });
    });

    // Add referenced fields
    referencedFields.forEach(field => {
      options.push({
        id: `referenced-field:${field.id}`,
        name: field.name,
        type: field.type,
        description: field.description,
        category: 'referenced-field'
      });
    });

    // Add referenced collections
    referencedCollections.forEach(collection => {
      options.push({
        id: `referenced-collection:${collection.id}`,
        name: collection.name,
        type: 'Collection',
        description: collection.description,
        category: 'referenced-collection'
      });
    });

    // Add extraction rules
    extractionRules.forEach(rule => {
      options.push({
        id: `extraction-rule:${rule.id}`,
        name: rule.ruleName,
        type: 'Extraction Rule',
        description: rule.ruleContent,
        category: 'extraction-rule'
      });
    });

    // Add supplied document placeholder
    options.push({
      id: 'supplied-document:0',
      name: 'First Supplied Document',
      type: 'Supplied Document',
      description: 'References the first document supplied during extraction',
      category: 'supplied-document'
    });

    return options;
  };

  const allOptions = buildReferenceOptions();

  // Handle textarea input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Check if user is typing an @-reference
    const textarea = e.target;
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = newValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      
      // Check if this looks like the start of a reference (no spaces)
      if (!textAfterAt.includes(' ') && textAfterAt.length >= 0) {
        setCurrentAtKey(textAfterAt);
        
        // Filter options based on what user has typed
        const filtered = allOptions.filter(option => 
          option.name.toLowerCase().includes(textAfterAt.toLowerCase()) ||
          option.category.toLowerCase().includes(textAfterAt.toLowerCase())
        );
        
        setFilteredOptions(filtered);
        setSelectedIndex(0);
        
        if (filtered.length > 0) {
          // Calculate dropdown position
          const rect = textarea.getBoundingClientRect();
          const lineHeight = 20; // Approximate line height
          const lines = textBeforeCursor.split('\n').length;
          
          setDropdownPosition({
            top: rect.top + (lines * lineHeight) + 20,
            left: rect.left + 10
          });
          
          setShowDropdown(true);
        } else {
          setShowDropdown(false);
        }
      } else {
        setShowDropdown(false);
      }
    } else {
      setShowDropdown(false);
    }
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectOption(filteredOptions[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    }
  };

  // Select an option from dropdown
  const selectOption = (option: ReferenceOption) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const newValue = 
        value.substring(0, lastAtIndex) + 
        '@' + option.id + 
        textAfterCursor;
      
      onChange(newValue);
      setShowDropdown(false);
      
      // Set cursor position after the inserted reference
      setTimeout(() => {
        const newCursorPos = lastAtIndex + option.id.length + 1;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
      
      {showDropdown && filteredOptions.length > 0 && (
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto min-w-80"
          style={{
            top: dropdownPosition.top + 'px',
            left: dropdownPosition.left + 'px'
          }}
        >
          {filteredOptions.map((option, index) => (
            <div
              key={option.id}
              className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                index === selectedIndex ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
              }`}
              onClick={() => selectOption(option)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{option.name}</div>
                  {option.description && (
                    <div className="text-xs text-gray-500 mt-1 truncate">{option.description}</div>
                  )}
                </div>
                <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded ml-2 flex-shrink-0">
                  {option.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-500">
        Type @ to reference knowledge documents, fields, collections, rules, or supplied documents
      </div>
    </div>
  );
}