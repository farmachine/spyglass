import { useState, useEffect, useRef, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Check, X } from "lucide-react";

interface FieldEditorPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldName: string;
  initialValue: string;
  fieldType: 'TEXT' | 'TEXTAREA' | 'DATE' | 'NUMBER' | 'BOOLEAN' | 'DROPDOWN';
  onSave: (value: string) => void;
  onCancel: () => void;
  children: React.ReactNode;
  // Dropdown-specific props
  dropdownOptions?: string[];
  dropdownLoading?: boolean;
}

export function FieldEditorPopover({
  open,
  onOpenChange,
  fieldName,
  initialValue,
  fieldType,
  onSave,
  onCancel,
  children,
  dropdownOptions = [],
  dropdownLoading = false,
}: FieldEditorPopoverProps) {
  const [value, setValue] = useState(initialValue);
  const [dropdownFilter, setDropdownFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Reset internal state when popover opens
  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setDropdownFilter("");
      setIsSaving(false);
      // Focus the input after a short delay to allow popover to render
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open, initialValue]);

  const handleSave = useCallback(() => {
    if (isSaving) return;
    setIsSaving(true);
    onSave(value);
    onOpenChange(false);
  }, [value, onSave, onOpenChange, isSaving]);

  const handleCancel = useCallback(() => {
    onCancel();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const handleDropdownSelect = useCallback((option: string) => {
    if (isSaving) return;
    setIsSaving(true);
    onSave(option);
    onOpenChange(false);
  }, [onSave, onOpenChange, isSaving]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Enter' && fieldType !== 'TEXT' && fieldType !== 'TEXTAREA') {
      // For single-line fields (DATE, NUMBER), Enter saves
      e.preventDefault();
      handleSave();
    }
  }, [handleCancel, handleSave, fieldType]);

  const filteredDropdownOptions = dropdownOptions.filter(opt =>
    !dropdownFilter || opt.toLowerCase().includes(dropdownFilter.toLowerCase())
  );

  const renderEditor = () => {
    switch (fieldType) {
      case 'DROPDOWN':
        return (
          <div className="space-y-2">
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={dropdownFilter}
              onChange={(e) => setDropdownFilter(e.target.value)}
              placeholder="Type to search..."
              className="w-full"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancel();
                } else if (e.key === 'Enter' && filteredDropdownOptions.length === 1) {
                  e.preventDefault();
                  handleDropdownSelect(filteredDropdownOptions[0]);
                }
              }}
            />
            <div className="max-h-[200px] overflow-y-auto border rounded-md bg-white dark:bg-gray-800">
              {dropdownLoading ? (
                <div className="px-3 py-2 text-sm text-gray-400">Loading options...</div>
              ) : filteredDropdownOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">No matches</div>
              ) : (
                filteredDropdownOptions.map((opt, i) => (
                  <div
                    key={i}
                    className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                      value === opt ? 'bg-blue-100 dark:bg-gray-600 font-medium' : ''
                    }`}
                    onClick={() => handleDropdownSelect(opt)}
                  >
                    {opt}
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case 'DATE':
        return (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full"
            onKeyDown={handleKeyDown}
          />
        );

      case 'NUMBER':
        return (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full"
            onKeyDown={handleKeyDown}
          />
        );

      case 'BOOLEAN':
        return (
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        );

      case 'TEXT':
      case 'TEXTAREA':
      default:
        return (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter value..."
            className="w-full min-h-[120px] resize-y whitespace-pre-wrap"
            rows={5}
            onKeyDown={handleKeyDown}
          />
        );
    }
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleCancel();
      } else {
        onOpenChange(true);
      }
    }}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0 shadow-xl border-blue-200 dark:border-blue-800"
        side="bottom"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => {
          // Prevent default focus to let our manual focus work
          e.preventDefault();
        }}
      >
        <div className="p-3 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {fieldName}
            </Label>
            <button
              onClick={handleCancel}
              className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </div>

          {/* Editor */}
          {renderEditor()}

          {/* Footer */}
          {fieldType !== 'DROPDOWN' && (
            <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {fieldType === 'TEXT' || fieldType === 'TEXTAREA'
                  ? 'Ctrl+Enter to save'
                  : 'Enter to save'}
                {' \u00b7 Esc to cancel'}
              </span>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  className="h-7 px-2.5 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-7 px-2.5 text-xs bg-[#4F63A4] hover:bg-[#3A4A7C]"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
