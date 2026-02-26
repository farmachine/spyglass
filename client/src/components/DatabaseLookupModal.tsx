import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { X, Search, Check } from "lucide-react";

interface FilterConfig {
  column: string;
  operator: string;
  inputField: string;
  fuzziness: number;
  inputValue?: string;
}

interface DatabaseLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: string, selectedRecord?: any) => Promise<void> | void;
  datasourceData: any[];
  columnMappings: Record<string, string>;
  initialFilters: FilterConfig[];
  outputColumn: string;
  currentInputValues: Record<string, string>;
}

export function DatabaseLookupModal(props: DatabaseLookupModalProps) {
  const {
    isOpen,
    onClose,
    onSelect,
    datasourceData,
    columnMappings,
    initialFilters,
    outputColumn,
    currentInputValues
  } = props;
  
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      const filtersWithValues = initialFilters.map(f => ({
        ...f,
        inputValue: currentInputValues[f.inputField] || ""
      }));
      setFilters(filtersWithValues);
      setSelectedRecord(null);
      setSelectedValue("");
      setSearchTerm("");
    }
  }, [isOpen, initialFilters, currentInputValues]);

  const safeData = Array.isArray(datasourceData) ? datasourceData : [];
  
  const columns = useMemo(() => {
    if (safeData.length === 0) return [];
    return Object.keys(safeData[0]);
  }, [safeData]);

  const getDisplayName = (col: string) => columnMappings[col] || col;

  const applyOperator = (value: string, searchValue: string, operator: string): boolean => {
    if (!value || !searchValue) return false;
    
    const normalizedValue = value.toString().toLowerCase().trim();
    const normalizedSearch = searchValue.toString().toLowerCase().trim();
    
    switch (operator) {
      case 'equals':
        return normalizedValue === normalizedSearch;
      case 'contains':
        return normalizedValue.includes(normalizedSearch);
      case 'startsWith':
        return normalizedValue.startsWith(normalizedSearch);
      case 'endsWith':
        return normalizedValue.endsWith(normalizedSearch);
      default:
        return normalizedValue === normalizedSearch;
    }
  };

  const applyFuzzyMatch = (value: string, searchValue: string, operator: string, fuzziness: number): boolean => {
    if (!value || !searchValue) return false;
    
    const normalizedValue = value.toString().toLowerCase().trim();
    const normalizedSearch = searchValue.toString().toLowerCase().trim();
    
    if (fuzziness === 0) {
      return applyOperator(value, searchValue, operator);
    }
    
    if (applyOperator(value, searchValue, operator)) {
      return true;
    }
    
    if (operator === 'contains' || operator === 'equals') {
      if (normalizedValue.includes(normalizedSearch) || normalizedSearch.includes(normalizedValue)) {
        return true;
      }
    }
    
    if (fuzziness >= 30) {
      const valueWords = normalizedValue.split(/\s+/);
      const searchWords = normalizedSearch.split(/\s+/);
      const matchingWords = searchWords.filter(sw => 
        valueWords.some(vw => vw.includes(sw) || sw.includes(vw))
      );
      if (matchingWords.length >= Math.ceil(searchWords.length * (1 - fuzziness / 100))) {
        return true;
      }
    }
    
    if (fuzziness >= 50) {
      const levenshteinDistance = (a: string, b: string): number => {
        const matrix: number[][] = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
          for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = b[i-1] === a[j-1] 
              ? matrix[i-1][j-1]
              : Math.min(matrix[i-1][j-1] + 1, matrix[i][j-1] + 1, matrix[i-1][j] + 1);
          }
        }
        return matrix[b.length][a.length];
      };
      
      const maxLen = Math.max(normalizedValue.length, normalizedSearch.length);
      const distance = levenshteinDistance(normalizedValue, normalizedSearch);
      const similarity = 1 - (distance / maxLen);
      const threshold = 1 - (fuzziness / 100);
      if (similarity >= threshold) {
        return true;
      }
    }
    
    return false;
  };

  // Count how many filters have actual values
  const activeFilterCount = filters.filter(f => f.inputValue && f.inputValue.trim() !== "").length;
  
  const filteredData = useMemo(() => {
    let result = [...safeData];
    
    // First, exclude records with blank values in any filter column
    // (regardless of whether the filter has an input value)
    const activeFilterColumns = filters.map(f => f.column);
    if (activeFilterColumns.length > 0) {
      result = result.filter(record => {
        return activeFilterColumns.every(col => {
          const val = record[col];
          return val !== null && val !== undefined && val.toString().trim() !== "";
        });
      });
    }
    
    // Then apply filter matching for filters that have input values
    filters.forEach(filter => {
      if (!filter.inputValue || filter.inputValue.trim() === "") return;
      
      result = result.filter(record => {
        const recordValue = record[filter.column];
        return applyFuzzyMatch(recordValue, filter.inputValue!, filter.operator, filter.fuzziness);
      });
    });
    
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(record =>
        columns.some(col => {
          const val = record[col];
          return val && val.toString().toLowerCase().includes(searchLower);
        })
      );
    }
    
    return result.slice(0, 100);
  }, [safeData, filters, searchTerm, columns]);

  const updateFilterFuzziness = (index: number, fuzziness: number) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], fuzziness };
    setFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleSelectRecord = (record: any) => {
    setSelectedRecord(record);
    const value = record[outputColumn];
    setSelectedValue(value ? value.toString() : "");
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async () => {
    if (selectedValue) {
      setIsSaving(true);
      try {
        await onSelect(selectedValue, selectedRecord);
        onClose();
      } catch (error) {
        // Error is handled by the onSelect callback's own catch block
        // Don't close the modal so the user can retry
      } finally {
        setIsSaving(false);
      }
    }
  };

  const getFuzzinessLabel = (fuzziness: number) => {
    if (fuzziness === 0) return { label: 'Exact', color: 'text-green-600 dark:text-green-400' };
    if (fuzziness <= 30) return { label: 'Low', color: 'text-blue-600 dark:text-blue-400' };
    if (fuzziness <= 60) return { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400' };
    return { label: 'High', color: 'text-orange-600 dark:text-orange-400' };
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-[#4F63A4]" />
            Database Lookup - Select Record
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {filters.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg space-y-2">
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Active Filters</Label>
              {filters.map((filter, index) => {
                const { label, color } = getFuzzinessLabel(filter.fuzziness);
                return (
                  <div key={index} className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[100px]">
                        {getDisplayName(filter.column)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-gray-600 dark:text-gray-400">
                        {filter.operator}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate" title={filter.inputValue}>
                        "{filter.inputValue || '(empty)'}"
                      </span>
                      <button
                        onClick={() => removeFilter(index)}
                        className="p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Remove filter"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1.5 pl-0">
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 w-[55px]">Fuzziness:</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="10"
                        value={filter.fuzziness}
                        onChange={(e) => updateFilterFuzziness(index, parseInt(e.target.value))}
                        className="flex-1 h-1 accent-[#4F63A4]"
                      />
                      <span className={`text-[10px] min-w-[45px] text-right ${color}`}>
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search all columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md whitespace-nowrap">
              {filteredData.length === 100 && safeData.length > 100 
                ? `Showing 100 of ${safeData.length}` 
                : `${filteredData.length} of ${safeData.length}`} records
            </span>
          </div>
          
          <div className="flex-1 overflow-auto border rounded-lg">
            <div className="overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                  <TableRow className="border-b-2">
                    <TableHead className="w-10 py-2 px-2 sticky left-0 bg-white dark:bg-slate-900 z-20"></TableHead>
                    {columns.map(col => (
                      <TableHead key={col} className="py-2 px-3 text-xs font-semibold whitespace-nowrap min-w-[120px]">
                        <div className="flex flex-col">
                          <span className={col === outputColumn ? 'text-[#4F63A4] dark:text-[#7B8FD4] font-bold' : ''}>
                            {getDisplayName(col)}
                          </span>
                          {col === outputColumn && (
                            <span className="text-[10px] text-[#4F63A4] dark:text-[#7B8FD4] font-normal">Output Column</span>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="text-center py-8 text-gray-500">
                        No matching records found. Try adjusting your filters or increasing fuzziness.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((record, idx) => {
                      const isSelected = selectedRecord === record;
                      return (
                        <TableRow 
                          key={idx}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-[#4F63A4]/10 border-l-2 border-l-[#4F63A4]' 
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                          onClick={() => handleSelectRecord(record)}
                        >
                          <TableCell className="w-10 py-2 px-2 sticky left-0 bg-white dark:bg-slate-900">
                            {isSelected && (
                              <Check className="h-4 w-4 text-[#4F63A4]" />
                            )}
                          </TableCell>
                          {columns.map(col => (
                            <TableCell 
                              key={col} 
                              className={`py-2 px-3 text-sm whitespace-nowrap ${col === outputColumn ? 'font-medium text-[#4F63A4] dark:text-[#7B8FD4]' : ''}`}
                            >
                              <span className="max-w-[200px] truncate inline-block" title={record[col]?.toString()}>
                                {record[col]?.toString() || '-'}
                              </span>
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {selectedValue && (
              <span>
                Selected: <span className="font-medium text-[#4F63A4]">{selectedValue}</span>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!selectedValue || isSaving}
              className="bg-[#4F63A4] hover:bg-[#3A4A7C]"
            >
              {isSaving ? 'Saving...' : 'Update'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
