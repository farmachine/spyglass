import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, FileText, Database, Type, Copy, Check, Upload, Loader2, ChevronDown, ChevronRight, Key, RefreshCw, Brain, Code, Info as InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";


interface SampleDataRow {
  [key: string]: string;
}

interface InputParameter {
  id: string;
  name: string;
  type: "text" | "data" | "document";
  description: string;
  multiline?: boolean; // Only applies to text type
  documentType?: "all" | "excel" | "word" | "pdf"; // Document type filter for document inputs
  sampleFile?: string; // Sample file name for documents/data
  sampleFileURL?: string; // Sample file URL for documents/data
  sampleText?: string; // Sample text for text type
  sampleData?: {
    name?: string;
    columns: (string | { identifierId: number; name: string })[];
    rows: SampleDataRow[];
    identifierColumn?: string;
  }; // Sample data table for data type
  sampleDocumentIds?: string[]; // Array of sample document IDs for proper UUID mapping
}

interface CreateToolDialogProps {
  projectId: string;
  editingFunction?: any;
  setEditingFunction?: (func: any) => void;
  trigger?: React.ReactNode;
}

export default function CreateToolDialog({ projectId, editingFunction, setEditingFunction, trigger }: CreateToolDialogProps) {
  const [open, setOpen] = useState(false);
  const [toolType, setToolType] = useState<"AI_ONLY" | "CODE" | "DATABASE_LOOKUP" | null>(null);
  const [aiAssistanceRequired, setAiAssistanceRequired] = useState(false);
  const [operationType, setOperationType] = useState<"create" | "update">("update");
  const [inputParameters, setInputParameters] = useState<InputParameter[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    aiAssistancePrompt: "",
    functionCode: "",
    aiPrompt: "",
    llmModel: "gemini-2.0-flash"
  });

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [expandedInputs, setExpandedInputs] = useState<Set<string>>(new Set());
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [showColumnInput, setShowColumnInput] = useState<Set<string>>(new Set());
  const [processingParams, setProcessingParams] = useState<Set<string>>(new Set());
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentEditingFunctionId, setCurrentEditingFunctionId] = useState<string | null>(null);
  const [displayConfig, setDisplayConfig] = useState<{
    modalType: 'none' | 'table' | 'map';
    modalSize?: string;
    mapConfig?: {
      latField: string;
      lngField: string;
      labelField?: string;
      popupFields?: string[];
      defaultZoom?: number;
      defaultCenter?: [number, number];
    };
  }>({ modalType: 'none' });

  const queryClient = useQueryClient();

  const resetForm = () => {
    setFormData({ name: "", description: "", aiAssistancePrompt: "", functionCode: "", aiPrompt: "", llmModel: "gemini-2.0-flash" });
    setToolType(null);
    // outputType removed - always use multiple
    setOperationType("update");
    setInputParameters([]);
    setAiAssistanceRequired(false);
    setLoadingMessage("");
    setLoadingProgress(0);
    setExpandedInputs(new Set());
    setShowColumnInput(new Set());
    setProcessingParams(new Set());
    setCodeExpanded(false);
    setIsEditMode(false);
    setCurrentEditingFunctionId(null);
    setDisplayConfig({ modalType: 'none' });
  };

  // Track previous open state to detect when dialog opens
  const [prevOpen, setPrevOpen] = useState(false);
  
  // Load editing function data when provided
  useEffect(() => {
    if (editingFunction) {
      const functionId = editingFunction.id;
      
      // Reload form state when:
      // 1. Dialog is opening (was closed, now open)
      // 2. It's a different function
      const isOpening = !prevOpen && open;
      if (isOpening || currentEditingFunctionId !== functionId) {
        setFormData({
          name: editingFunction.name || "",
          description: editingFunction.description || "",
          aiAssistancePrompt: editingFunction.aiAssistancePrompt || "",
          functionCode: editingFunction.functionCode || "",
          aiPrompt: editingFunction.aiPrompt || "",
          llmModel: editingFunction.llmModel || "gemini-2.0-flash"
        });
        // Set tool type properly for all three options
        const tt = editingFunction.toolType;
        if (tt === 'AI_ONLY' || tt === 'CODE' || tt === 'DATABASE_LOOKUP') {
          setToolType(tt);
        } else {
          setToolType('CODE');
        }
        
        // Parse the full operationType enum back to base form
        const fullOpType = editingFunction.operationType || "updateMultiple";
        // Handle potentially corrupted values like "createMultipleMultiple" 
        const cleanOpType = fullOpType.replace(/Multiple+$/, 'Multiple').replace(/Single+$/, 'Single');
        const baseOpType = cleanOpType.startsWith('create') ? 'create' : 'update';
        setOperationType(baseOpType as "create" | "update");
        
        setInputParameters(editingFunction.inputParameters || []);
        const dc = editingFunction.displayConfig || editingFunction.display_config;
        if (dc && dc.modalType) {
          setDisplayConfig(dc);
        } else if (tt === 'DATABASE_LOOKUP') {
          setDisplayConfig({ modalType: 'table', modalSize: 'xl' });
        } else {
          setDisplayConfig({ modalType: 'none' });
        }
        setIsEditMode(true);
        setCurrentEditingFunctionId(functionId);
        setOpen(true);
        console.log('🔧 Form loaded for editing function:', functionId, 'Type:', editingFunction.toolType, 'OperationType:', editingFunction.operationType);
      } else {
        console.log('🔧 Preserving current form state for function:', functionId, '(Dialog already open with same function)');
      }
      
      // Always keep code section expanded if there's existing code (for regeneration)
      if (editingFunction.functionCode) {
        setCodeExpanded(true);
      }
    } else if (!editingFunction) {
      setIsEditMode(false);
      setCurrentEditingFunctionId(null);
    }
    
    // Update prevOpen for next render
    setPrevOpen(open);
  }, [editingFunction, currentEditingFunctionId, open, prevOpen]);

  // Add update mutation for editing
  const updateTool = useMutation({
    mutationFn: async (data: any) => {
      console.log('🔧 Updated Tool Object:', {
        id: editingFunction.id,
        name: data.name,
        description: data.description,
        toolType: data.toolType,
        outputType: "multiple",
        operationType: data.operationType,
        inputParameters: data.inputParameters,
        tags: data.tags || []
      });
      
      return apiRequest(`/api/projects/${projectId}/excel-functions/${editingFunction.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          functionCode: data.toolType === 'CODE' ? (data.functionCode || editingFunction.functionCode) : null,
          aiPrompt: (data.toolType === 'AI_ONLY' || data.toolType === 'DATABASE_LOOKUP') ? (data.aiPrompt || editingFunction.aiPrompt) : null,
          toolType: data.toolType,
          dataSourceId: data.toolType === 'DATABASE_LOOKUP' ? data.dataSourceId : null,
          outputType: "multiple",
          operationType: data.operationType,
          inputParameters: data.inputParameters,
          inputSchema: data.inputSchema,
          outputSchema: data.outputSchema,
          tags: data.tags || [],
          llmModel: data.llmModel || "gemini-2.0-flash",
          displayConfig: data.displayConfig || null
        })
      });
    },
    onSuccess: async (updatedData) => {
      await queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/excel-functions`] });
      await queryClient.refetchQueries({ queryKey: [`/api/projects/${projectId}/excel-functions`] });
      
      // Update the editingFunction if the dialog is still open to show saved changes
      if (editingFunction && updatedData) {
        setEditingFunction?.(updatedData);
      }
      
      // Close dialog and reset
      setEditingFunction?.(null);
      setOpen(false);
      resetForm();
      
      console.log('✅ Tool successfully updated:', updatedData);
    },
    onError: (error: any) => {
      console.error('Failed to update tool:', error);
    }
  });

  const createTool = useMutation({
    mutationFn: async (data: any) => {
      console.log('🚀 CREATING TOOL - Sending data to API:', JSON.stringify(data, null, 2));
      
      // Log data input parameters with their JSON arrays
      const dataInputs = data.inputParameters?.filter((p: any) => p.type === 'data' && p.sampleData);
      if (dataInputs && dataInputs.length > 0) {
        console.log("📊 Data Input Parameters with JSON Arrays:");
        dataInputs.forEach((param: any) => {
          console.log(`Parameter: ${param.name}`);
          console.log(`Identifier Column: ${param.sampleData.identifierColumn || param.sampleData.columns[0]}`);
          console.log(`JSON Array:`, JSON.stringify(param.sampleData.rows, null, 2));
        });
      }

      const response = await apiRequest("/api/excel-functions", {
        method: "POST",
        body: JSON.stringify(data)
      });
      
      console.log('✅ CREATE TOOL API RESPONSE:', JSON.stringify(response, null, 2));
      return response;
    },
    onSuccess: (response) => {
      console.log('🎉 CREATE TOOL SUCCESS CALLBACK TRIGGERED');
      console.log('📄 Response from successful creation:', JSON.stringify(response, null, 2));
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/excel-functions`] });
      console.log('✅ Tool created successfully, closing modal in 1.5s...');
      setTimeout(() => {
        console.log('🔄 CLOSING MODAL AND RESETTING FORM');
        // Clear editing function first to prevent form contamination
        setEditingFunction?.(null);
        resetForm();
        setOpen(false);
        setLoadingProgress(0);
        setLoadingMessage("");
      }, 1500); // Give time to see completion
    },
    onError: (error: any) => {
      console.error('❌ CREATE TOOL ERROR CALLBACK TRIGGERED');
      console.error('💥 Full error object:', error);
      console.error('💥 Error message:', error?.message);
      console.error('💥 Error response:', error?.response);
      console.error('Failed to create tool:', error);
      setLoadingProgress(0);
      setLoadingMessage("");
    }
  });

  // NEW CLEAN CODE GENERATION
  const generateCodeClean = useMutation({
    mutationFn: async () => {
      console.log('🚀 NEW CLEAN CODE GENERATION - Using current form data');
      
      // Build the full operationType enum value - always Multiple
      const fullOperationType = `${operationType}Multiple` as 'createMultiple' | 'updateMultiple';
      
      const formDataToSend = {
        projectId: projectId,
        name: formData.name,
        description: formData.description,
        inputParameters: inputParameters,
        toolType: toolType,
        outputType: "multiple",
        operationType: fullOperationType,
        aiAssistanceRequired: formData.aiAssistanceRequired,
        aiAssistancePrompt: formData.aiAssistancePrompt
      };
      
      console.log('📋 Sending form data to new endpoint:', JSON.stringify(formDataToSend, null, 2));
      
      const response = await apiRequest("/api/excel-functions/generate", {
        method: "POST",
        body: JSON.stringify(formDataToSend)
      });
      
      return response;
    },
    onSuccess: (response) => {
      console.log('✅ Clean code generation completed:', JSON.stringify(response, null, 2));
      
      // Update the form state with generated content (code or prompt)
      if (editingFunction) {
        // For editing mode, update the form data
        setFormData(prev => ({
          ...prev,
          functionCode: response.functionCode,
          aiPrompt: response.aiPrompt
        }));
        console.log('🔧 Updated editing function content in form');
      } else {
        // For creation mode, store the generated content
        setFormData(prev => ({
          ...prev,
          functionCode: response.functionCode,
          aiPrompt: response.aiPrompt
        }));
        console.log('🎉 Generated content ready for new tool creation');
      }
    },
    onError: (error: any) => {
      console.error('❌ Clean code generation failed:', error);
    }
  });

  const generateToolCode = useMutation({
    mutationFn: async (data: any) => {
      setLoadingProgress(25);
      setLoadingMessage("Generating tool");
      console.log('🔧 Creating tool with data:', JSON.stringify(data, null, 2));
      
      setLoadingProgress(50);
      
      const response = await apiRequest("/api/excel-functions/generate", {
        method: "POST",
        body: JSON.stringify(data)
      });
      
      setLoadingProgress(75);
      
      return response;
    },
    onSuccess: (response) => {
      setLoadingProgress(100);
      setLoadingMessage("Tool created successfully!");
      
      console.log('🎉 AI generation response:', JSON.stringify(response, null, 2));
      
      // Validate response based on tool type
      // AI_ONLY and DATABASE_LOOKUP tools need aiPrompt, CODE tools need functionCode
      const isValidResponse = toolType === 'CODE' 
        ? !!response.functionCode  // CODE tools need functionCode
        : !!response.aiPrompt; // AI_ONLY and DATABASE_LOOKUP tools need aiPrompt
        
      if (!isValidResponse) {
        console.error('❌ Missing required fields in AI response:', {
          toolType: toolType,
          hasAiPrompt: !!response.aiPrompt,
          hasFunctionCode: !!response.functionCode,
          response: response
        });
        console.error(`❌ AI generation incomplete - missing ${toolType === 'CODE' ? 'functionCode' : 'aiPrompt'}`);
        setLoadingProgress(0);
        setLoadingMessage("");
        return;
      }
      
      console.log('✅ AI response validation passed, loading content into form...');
      
      // Load the generated content into the form (don't create tool yet)
      setFormData(prev => ({
        ...prev,
        functionCode: response.functionCode || prev.functionCode,
        aiPrompt: response.aiPrompt || prev.aiPrompt
      }));
      
      // Reset loading state after populating form
      setTimeout(() => {
        setLoadingProgress(0);
        setLoadingMessage("");
      }, 1000);
    },
    onError: (error: any) => {
      console.error('Code generation failed:', error);
      setLoadingProgress(0);
      setLoadingMessage("");
    }
  });

  // Regenerate function code mutation
  const regenerateToolCode = useMutation({
    mutationFn: async (toolId: string) => {
      // Build the full operationType enum value - always Multiple
      const fullOperationType = `${operationType}Multiple` as 'createMultiple' | 'updateMultiple';
      
      return apiRequest(`/api/excel-functions/${toolId}/regenerate`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          inputParameters: inputParameters,
          toolType: toolType,
          outputType: "multiple",
          operationType: fullOperationType,
          aiAssistanceRequired: formData.aiAssistanceRequired,
          aiAssistancePrompt: formData.aiAssistancePrompt,
          currentCode: editingFunction?.functionCode
        })
      });
    },
    onSuccess: (updatedTool) => {
      console.log('🎯 Regeneration response:', JSON.stringify(updatedTool, null, 2));
      console.log('🎯 Function code from response:', updatedTool?.functionCode);
      
      // Update both the editing function and form data
      if (setEditingFunction) {
        setEditingFunction(updatedTool);
      }
      // Update the form data with the new code
      setFormData(prev => ({ ...prev, functionCode: updatedTool?.functionCode || '' }));
      console.log('✅ Form data updated with new code:', updatedTool?.functionCode?.substring(0, 100) + '...');
      console.log('Tool code regenerated successfully');
    },
    onError: (error: any) => {
      console.error('Failed to regenerate tool code:', error);
    }
  });

  const addInputParameter = () => {
    const newParam: InputParameter = {
      id: Math.random().toString(36),
      name: "",
      type: "text",
      description: "",
      multiline: false
    };
    
    // If this is a data type parameter, initialize empty sample data
    if (newParam.type === "data") {
      newParam.sampleData = {
        name: "",
        columns: [],
        rows: [],
        identifierColumn: undefined
      };
    }
    
    setInputParameters([...inputParameters, newParam]);
    // Default new inputs to expanded
    setExpandedInputs(prev => new Set([...Array.from(prev), newParam.id]));
  };

  const updateInputParameter = (id: string, field: keyof InputParameter, value: string | boolean) => {
    setInputParameters(prev => 
      prev.map(param => {
        if (param.id === id) {
          const updatedParam = { ...param, [field]: value };
          // Reset multiline to false when type changes away from "text"
          if (field === "type" && value !== "text") {
            updatedParam.multiline = false;
          }
          // Initialize documentType when changing to document type
          if (field === "type" && value === "document" && !updatedParam.documentType) {
            updatedParam.documentType = "all";
          }
          // If changing to data type, initialize empty sample data
          if (field === "type" && value === "data" && !updatedParam.sampleData) {
            updatedParam.sampleData = {
              name: "",
              columns: [],
              rows: [],
              identifierColumn: undefined
            };
          }
          return updatedParam;
        }
        return param;
      })
    );
  };

  const removeInputParameter = (id: string) => {
    setInputParameters(prev => prev.filter(param => param.id !== id));
    setExpandedInputs(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const toggleInputExpanded = (id: string) => {
    setExpandedInputs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };



  // Sample data table functions
  const addSampleColumn = (paramId: string, columnName: string) => {
    if (!columnName.trim()) return;
    
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId) {
        const currentData = param.sampleData || { columns: [], rows: [], identifierColumn: undefined };
        if (currentData.columns.some(col => typeof col === 'string' ? col === columnName.trim() : col.name === columnName.trim())) return param;
        
        // Generate identifier ID based on current array length
        const identifierId = currentData.columns.length;
        
        // Create column object with identifierId and name
        const newColumnObject = {
          identifierId: identifierId,
          name: columnName.trim()
        };
        
        const newColumns = [...currentData.columns, newColumnObject];
        
        // Set identifier column if this is the first column being created
        const identifierColumn = currentData.columns.length === 0 ? columnName.trim() : currentData.identifierColumn;
        
        const newRows = currentData.rows.map(row => ({
          ...row,
          [columnName.trim()]: ""
        }));
        
        return {
          ...param,
          sampleData: {
            ...currentData,
            columns: newColumns,
            rows: newRows,
            identifierColumn: identifierColumn
          }
        };
      }
      return param;
    }));
    
    // Hide the column input after adding
    setShowColumnInput(prev => {
      const newSet = new Set(prev);
      newSet.delete(paramId);
      return newSet;
    });
  };

  const updateSampleDataName = (paramId: string, name: string) => {
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId) {
        const currentData = param.sampleData || { columns: [], rows: [], identifierColumn: undefined };
        return {
          ...param,
          sampleData: {
            ...currentData,
            name: name
          }
        };
      }
      return param;
    }));
  };

  const toggleColumnInput = (paramId: string) => {
    setShowColumnInput(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paramId)) {
        newSet.delete(paramId);
      } else {
        newSet.add(paramId);
      }
      return newSet;
    });
  };

  const removeSampleColumn = (paramId: string, columnName: string) => {
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId && param.sampleData) {
        const newColumns = param.sampleData.columns.filter(col => 
          typeof col === 'string' ? col !== columnName : col.name !== columnName
        );
        const newRows = param.sampleData.rows.map(row => {
          const { [columnName]: removed, ...rest } = row;
          return rest;
        });
        
        // Update identifier column if we're removing it
        let identifierColumn = param.sampleData.identifierColumn;
        if (identifierColumn === columnName) {
          // Set new identifier to first remaining column, or undefined if no columns left
          if (newColumns.length > 0) {
            identifierColumn = typeof newColumns[0] === 'string' ? newColumns[0] : newColumns[0].name;
          } else {
            identifierColumn = undefined;
          }
        }
        
        return {
          ...param,
          sampleData: {
            ...param.sampleData,
            columns: newColumns,
            rows: newRows,
            identifierColumn: identifierColumn
          }
        };
      }
      return param;
    }));
  };

  const addSampleRow = (paramId: string) => {
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId) {
        const currentData = param.sampleData || { columns: [], rows: [], identifierColumn: undefined };
        if (currentData.rows.length >= 5) return param; // Max 5 rows
        
        const newRow: SampleDataRow = {};
        currentData.columns.forEach(col => {
          const colName = typeof col === 'string' ? col : col.name;
          newRow[colName] = "";
        });
        
        return {
          ...param,
          sampleData: {
            ...currentData,
            columns: currentData.columns,
            rows: [...currentData.rows, newRow],
            identifierColumn: currentData.identifierColumn
          }
        };
      }
      return param;
    }));
  };

  const removeSampleRow = (paramId: string, rowIndex: number) => {
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId && param.sampleData) {
        const newRows = param.sampleData.rows.filter((_, index) => index !== rowIndex);
        return {
          ...param,
          sampleData: {
            ...param.sampleData,
            columns: param.sampleData.columns,
            rows: newRows
          }
        };
      }
      return param;
    }));
  };

  const updateSampleCellValue = (paramId: string, rowIndex: number, columnName: string, value: string) => {
    setInputParameters(prev => prev.map(param => {
      if (param.id === paramId && param.sampleData) {
        const newRows = param.sampleData.rows.map((row, index) => {
          if (index === rowIndex) {
            return { ...row, [columnName]: value };
          }
          return row;
        });
        
        return {
          ...param,
          sampleData: {
            ...param.sampleData,
            columns: param.sampleData.columns,
            rows: newRows
          }
        };
      }
      return param;
    }));
  };

  const processSampleDocuments = async (functionId: string, parameters: InputParameter[]) => {
    // Array to collect updated parameters with sample document IDs
    const updatedParameters: InputParameter[] = [];

    for (const param of parameters) {
      let updatedParam = { ...param };
      
      try {
        if (param.sampleText) {
          // Process text sample
          const response = await apiRequest("/api/sample-documents/process", {
            method: "POST",
            body: JSON.stringify({
              functionId,
              parameterName: param.name,
              sampleText: param.sampleText
            })
          });
          
          // Store the sample document ID in the parameter
          if (response.document?.id) {
            updatedParam.sampleDocumentIds = [response.document.id];
            console.log(`✅ Stored sample document ID for text parameter ${param.name}:`, response.document.id);
          }
        } else if (param.sampleFileURL && param.sampleFile) {
          // Process file sample using the SAME extraction process as session documents
          const response = await apiRequest("/api/sample-documents/process", {
            method: "POST", 
            body: JSON.stringify({
              functionId,
              parameterName: param.name,
              fileName: param.sampleFile,
              fileURL: param.sampleFileURL
            })
          });
          
          // Store the sample document ID in the parameter
          if (response.document?.id) {
            updatedParam.sampleDocumentIds = [response.document.id];
            console.log(`✅ Stored sample document ID for file parameter ${param.name}:`, response.document.id);
          }
        } else if (param.sampleData && param.sampleData.columns.length > 0 && param.sampleData.rows.length > 0) {
          // Process data table sample - convert to array of objects format with identifier column info
          const sampleDataWithIdentifier = {
            data: param.sampleData.rows,
            identifierColumn: param.sampleData.identifierColumn || param.sampleData.columns[0]
          };
          const tableDataAsJSON = JSON.stringify(sampleDataWithIdentifier, null, 2);
          
          const response = await apiRequest("/api/sample-documents/process", {
            method: "POST",
            body: JSON.stringify({
              functionId,
              parameterName: param.name,
              sampleText: tableDataAsJSON
            })
          });
          
          // Store the sample document ID in the parameter
          if (response.document?.id) {
            updatedParam.sampleDocumentIds = [response.document.id];
            console.log(`✅ Stored sample document ID for data parameter ${param.name}:`, response.document.id);
          }
        }
      } catch (error) {
        console.error(`Failed to process sample for parameter ${param.name}:`, error);
        // Don't throw error to prevent function creation failure
      }
      
      updatedParameters.push(updatedParam);
    }

    // Update the function with the sample document IDs
    if (updatedParameters.some(p => p.sampleDocumentIds)) {
      try {
        console.log('🔄 Updating function with sample document IDs...');
        await apiRequest(`/api/excel-functions/${functionId}`, {
          method: "PATCH",
          body: JSON.stringify({
            inputParameters: updatedParameters
          })
        });
        console.log('✅ Function updated with sample document IDs');
      } catch (error) {
        console.error('Failed to update function with sample document IDs:', error);
      }
    }
  };

  const handleSampleFileUpload = async (paramId: string, file: File | undefined) => {
    if (!file) return;
    
    console.log('📁 Sample file selected:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    // Start processing for this parameter
    setProcessingParams(prev => new Set([...prev, paramId]));

    try {
      // Get upload URL for the sample file
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/objects/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });

      if (!response.ok) {
        throw new Error("Failed to get upload URL");
      }

      const { uploadURL } = await response.json();

      // Upload the file
      const uploadResponse = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      const fileURL = uploadURL.split('?')[0]; // Store the base URL without query params
      
      // Update the parameter with the uploaded file info
      updateInputParameter(paramId, "sampleFile", file.name);
      updateInputParameter(paramId, "sampleFileURL", fileURL);
      
      // Always process the uploaded document for extraction
      const param = inputParameters.find(p => p.id === paramId);
      console.log('📄 Processing document upload:', {
        paramName: param?.name,
        paramId,
        editingFunctionId: editingFunction?.id,
        fileURL
      });
      
      if (param) {
        try {
          // Use a temporary ID for new functions or the existing ID for edits
          const functionId = editingFunction?.id || `temp-${Date.now()}`;
          console.log('📄 Using function ID for extraction:', functionId);
          console.log('📄 Calling /api/sample-documents/process with:', {
            functionId,
            parameterName: param.name,
            fileName: file.name,
            fileURL
          });
          
          const processResponse = await fetch("/api/sample-documents/process", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token && { Authorization: `Bearer ${token}` })
            },
            body: JSON.stringify({
              functionId: functionId,
              parameterName: param.name,
              fileName: file.name,
              fileURL: fileURL
            })
          });

          if (!processResponse.ok) {
            throw new Error("Failed to process document for extraction");
          }

          const processResult = await processResponse.json();
          console.log('✅ Sample document processed:', processResult);
          
          // Store the sample document ID in metadata for now
          if (processResult.sampleDocument?.id) {
            // We'll store this in the parameter's metadata or just log it
            console.log(`✅ Sample document ID ${processResult.sampleDocument.id} created for parameter ${param.name}`);
            
            // If editing an existing function, we don't need to update it here
            // since the sample document is already saved with the function ID
            if (editingFunction?.id) {
              console.log('✅ Sample document linked to existing function');
            }
          }
          
          console.log(`📝 Sample file "${file.name}" has been uploaded and processed for extraction.`);
        } catch (processError) {
          console.error("Processing error:", processError);
          console.warn(`File uploaded but processing failed. It will be processed when testing the tool.`);
        }
      } else {
        console.error("Parameter not found for file upload");
      }
    } catch (error) {
      console.error("Upload error:", error);
      console.error("Upload Failed: Failed to upload sample file. Please try again.");
    } finally {
      // Stop processing for this parameter
      setProcessingParams(prev => {
        const newSet = new Set([...prev]);
        newSet.delete(paramId);
        return newSet;
      });
    }
  };

  const clearSampleFile = (paramId: string) => {
    updateInputParameter(paramId, "sampleFile", "");
    updateInputParameter(paramId, "sampleFileURL", "");
    console.log("Sample file has been removed from this parameter.");
  };

  const handleRegenerateCode = () => {
    setShowRegenerateDialog(true);
  };

  const confirmRegenerate = () => {
    console.log('🎯 Using NEW CLEAN CODE GENERATION pathway');
    generateCodeClean.mutate();
    setShowRegenerateDialog(false);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.description || !toolType || inputParameters.length === 0) {
      console.error("Validation Error: Please fill in all required fields, select a tool type, and add at least one input.");
      return;
    }

    // Validate input parameters
    const invalidParams = inputParameters.filter(p => !p.name || !p.description);
    if (invalidParams.length > 0) {
      console.error("Validation Error: All inputs must have a name and description.");
      return;
    }

    // Add validation for required content based on tool type
    if (toolType === 'AI_ONLY' && !formData.aiPrompt) {
      console.error("Validation Error: AI_ONLY tools require an AI prompt. Please generate or enter a prompt.");
      return;
    }
    
    if (toolType === 'CODE' && !formData.functionCode) {
      console.error("Validation Error: CODE tools require function code. Please generate or enter code.");
      return;
    }

    // Build the full operationType enum value - always Multiple
    const fullOperationType = `${operationType}Multiple` as 'createMultiple' | 'updateMultiple';

    const toolData = {
      projectId,
      name: formData.name,
      description: formData.description,
      toolType,
      outputType: "multiple",
      operationType: fullOperationType,
      inputParameters,
      aiAssistanceRequired: toolType === "CODE" ? aiAssistanceRequired : false,
      aiAssistancePrompt: aiAssistanceRequired ? formData.aiAssistancePrompt : null,
      // Include the actual content based on tool type
      aiPrompt: (toolType === 'AI_ONLY' || toolType === 'DATABASE_LOOKUP') ? formData.aiPrompt : null,
      functionCode: toolType === 'CODE' ? formData.functionCode : null,
      llmModel: formData.llmModel || "gemini-2.0-flash",
      // Add required schema fields
      inputSchema: {
        parameters: inputParameters
      },
      outputSchema: {
        format: "field_validations_compatible"
      },
      tags: [],
      displayConfig: displayConfig.modalType !== 'none' ? displayConfig : null
    };

    console.log('🚀 SUBMITTING TOOL DATA:', JSON.stringify(toolData, null, 2));

    if (editingFunction) {
      updateTool.mutate(toolData);
    } else {
      // FIX: Use createTool instead of generateToolCode for new tools
      createTool.mutate(toolData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gray-700 hover:bg-gray-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Create Tool
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border dark:border-gray-700" aria-describedby="create-tool-dialog-description">
        <DialogHeader>
          <DialogTitle className="text-gray-800 dark:text-gray-100 flex items-center">
            {editingFunction ? 'Edit' : 'Create new'} extrapl
            <span className="w-2 h-2 rounded-full mx-2" style={{ backgroundColor: '#4F63A4' }}></span>
            Tool
          </DialogTitle>
          <p id="create-tool-dialog-description" className="sr-only">
            {editingFunction ? 'Edit existing extraction tool configuration and parameters' : 'Create new extraction tool with AI assistance for document processing'}
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card className="border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-800 dark:text-gray-100">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tool Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Extract Financial Data"
                  className="mt-1 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description *
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe how this tool works."
                  rows={3}
                  className="mt-1 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>

            </CardContent>
          </Card>

          {/* Tool Type - Show in both create and edit mode */}
          <Card className="border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-800 dark:text-gray-100">Tool Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={toolType || ""} onValueChange={(value: "AI_ONLY" | "CODE" | "DATABASE_LOOKUP") => {
                setToolType(value);
                if (value === 'DATABASE_LOOKUP' && displayConfig.modalType === 'none') {
                  setDisplayConfig({ modalType: 'table', modalSize: 'xl' });
                }
              }}>
                <SelectTrigger className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100">
                  <SelectValue placeholder="Select tool type" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                  <SelectItem value="AI_ONLY" className="dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700">AI</SelectItem>
                  <SelectItem value="CODE" className="dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700">Code</SelectItem>
                  <SelectItem value="DATABASE_LOOKUP" className="dark:text-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700">Database Lookup</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {toolType === "CODE"
                  ? "Data is processed using a coded function"
                  : toolType === "DATABASE_LOOKUP"
                  ? "Data is looked up from an external data source with AI-powered matching"
                  : "Data is processed using AI"
                }
              </p>

            </CardContent>
          </Card>

          {/* LLM Model Selector - Only for AI tools or Database Lookup */}
          {(toolType === "AI_ONLY" || toolType === "DATABASE_LOOKUP") && (
            <Card className="border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-gray-800 dark:text-gray-100">AI Model</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={formData.llmModel} onValueChange={(value) => setFormData({ ...formData, llmModel: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                    <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash Experimental</SelectItem>
                    <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                    <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Choose the AI model to use for data extraction
                </p>
              </CardContent>
            </Card>
          )}

          {/* Inputs - Only show when tool type is selected */}
          {(toolType || isEditMode) && (
            <Card className="border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-gray-800 dark:text-gray-100">
                  Inputs *
                </CardTitle>
                
                {/* Output Type Selectors - Top Right */}
                <div className="flex items-center gap-3">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Method
                  </Label>
                  <Select value={operationType} onValueChange={(value: "create" | "update") => setOperationType(value)}>
                    <SelectTrigger className="w-[100px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Information about automatic incremental data for UPDATE operations */}
              {operationType === 'update' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex gap-3">
                    <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                        Automatic Incremental Data for Update Operations
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        Update operations automatically receive previous column data from the current step. 
                        Each subsequent column gets all previously extracted data with identifierIds for proper row mapping.
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-400">
                        <span className="font-medium">Note:</span> Data inputs defined below are for reference data only 
                        (e.g., lookup tables, validation rules) - not for the data being updated.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {inputParameters.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    No inputs defined. Click "Add Input" to start.
                  </p>
                  <Button 
                    size="sm" 
                    onClick={addInputParameter}
                    className="bg-gray-600 hover:bg-gray-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Input
                  </Button>
                </div>
              ) : (
                <>
                  {inputParameters.map((param, index) => {
                    const isExpanded = expandedInputs.has(param.id);
                    return (
                      <div key={param.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Input
                                value={param.name}
                                onChange={(e) => updateInputParameter(param.id, "name", e.target.value)}
                                placeholder="Input name"
                                className="text-sm"
                              />
                            </div>
                            <div className="w-40">
                              <Select 
                                value={param.type} 
                                onValueChange={(value: "text" | "data" | "document") => updateInputParameter(param.id, "type", value)}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="text">
                                    <div className="flex items-center gap-2">
                                      <Type className="h-4 w-4" />
                                      Text
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="data">
                                    <div className="flex items-center gap-2">
                                      <Database className="h-4 w-4" />
                                      Data
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="document">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4" />
                                      Document
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleInputExpanded(param.id)}
                                className="p-1 h-auto text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeInputParameter(param.id)}
                                className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-3 space-y-3 border-t border-gray-100 dark:border-gray-700">
                            <div>
                              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</Label>
                              <Textarea
                                value={param.description}
                                onChange={(e) => updateInputParameter(param.id, "description", e.target.value)}
                                placeholder="Describe this input parameter..."
                                className="mt-1 resize-none"
                                rows={2}
                              />
                            </div>

                            {param.type === "text" && (
                              <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={param.multiline}
                                    onCheckedChange={(checked) => updateInputParameter(param.id, "multiline", checked)}
                                  />
                                  <Label className="text-sm text-gray-600 dark:text-gray-400">Multi-line text input</Label>
                                </div>
                              </div>
                            )}
                            {param.type === "document" && (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Document Type</Label>
                                  <Select 
                                    value={param.documentType || "all"} 
                                    onValueChange={(value: "all" | "excel" | "word" | "pdf") => updateInputParameter(param.id, "documentType", value)}
                                  >
                                    <SelectTrigger className="mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">All Document Types</SelectItem>
                                      <SelectItem value="excel">Excel Files</SelectItem>
                                      <SelectItem value="word">Word Documents</SelectItem>
                                      <SelectItem value="pdf">PDF Files</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Upload a sample document to test this tool.
                                  </Label>
                                  <div className="relative">
                                    {!processingParams.has(param.id) ? (
                                      <>
                                        <input
                                          type="file"
                                          accept=".xlsx,.xls,.docx,.doc,.pdf,.json,.csv,.txt"
                                          onChange={(e) => handleSampleFileUpload(param.id, e.target.files?.[0])}
                                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <div className="flex items-center justify-center w-full h-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer">
                                          <Upload className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-center justify-center w-full h-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                                        <Loader2 className="h-5 w-5 text-gray-600 dark:text-gray-400 animate-spin mr-2" />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Processing document...</span>
                                      </div>
                                    )}
                                  </div>
                                  {param.sampleFile && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <div className="inline-flex items-center gap-2 bg-gray-700 text-gray-100 px-3 py-1 rounded text-xs">
                                        <span>{param.sampleFile}</span>
                                        <button
                                          type="button"
                                          onClick={() => clearSampleFile(param.id)}
                                          className="hover:bg-gray-600 rounded p-0.5 transition-colors"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {param.type === "data" && (
                              <div className="space-y-3">
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {operationType === 'update' 
                                    ? 'Reference Data Collection (e.g., lookup tables, validation rules)'
                                    : 'Create sample data collection (up to 5 rows)'}
                                </Label>
                                
                                {/* Sample Data Name */}
                                <div>
                                  <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">Sample Data Name</Label>
                                  <Input
                                    value={param.sampleData?.name || ''}
                                    onChange={(e) => updateSampleDataName(param.id, e.target.value)}
                                    placeholder="e.g., Customer List, Product Catalog, etc."
                                    className="text-sm mt-1"
                                  />
                                </div>

                                {/* Add Column Button */}
                                {!showColumnInput.has(param.id) && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => toggleColumnInput(param.id)}
                                    className="bg-gray-600 hover:bg-gray-700"
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Column
                                  </Button>
                                )}

                                {/* Column Input (Hidden until Add Column is clicked) */}
                                {showColumnInput.has(param.id) && (
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder="Column name"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          const input = e.target as HTMLInputElement;
                                          if (input.value.trim()) {
                                            addSampleColumn(param.id, input.value.trim());
                                            input.value = '';
                                          }
                                        }
                                        if (e.key === 'Escape') {
                                          toggleColumnInput(param.id);
                                        }
                                      }}
                                      className="flex-1 text-sm"
                                      autoFocus
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={(e) => {
                                        const input = (e.target as HTMLElement).closest('div')?.querySelector('input') as HTMLInputElement;
                                        if (input && input.value.trim()) {
                                          addSampleColumn(param.id, input.value.trim());
                                          input.value = '';
                                        }
                                      }}
                                      className="bg-gray-600 hover:bg-gray-700 px-3"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleColumnInput(param.id)}
                                      className="px-3"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}

                                {/* Data Table */}
                                {param.sampleData && param.sampleData.columns.length > 0 && (
                                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    {/* Table Header */}
                                    <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                      <div className="flex">
                                        {param.sampleData.columns.map((column, colIndex) => {
                                          const columnName = typeof column === 'string' ? column : column.name;
                                          return (
                                            <div key={colIndex} className="flex-1 min-w-0 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                                              <div className="flex items-center justify-between p-2">
                                                <div className="flex items-center gap-1">
                                                  {param.sampleData?.identifierColumn === columnName && (
                                                    <Key className="h-3 w-3 text-amber-500" />
                                                  )}
                                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{columnName}</span>
                                                </div>
                                                <Button
                                                  type="button"
                                                  size="sm"
                                                  variant="ghost"
                                                  onClick={() => removeSampleColumn(param.id, columnName)}
                                                  className="h-5 w-5 p-0 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 ml-1"
                                                >
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                        <div className="w-8"></div> {/* Space for row delete button */}
                                      </div>
                                    </div>

                                    {/* Table Rows */}
                                    <div className="bg-white dark:bg-gray-900">
                                      {param.sampleData.rows.map((row, rowIndex) => (
                                        <div key={rowIndex} className="flex border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                                          {param.sampleData!.columns.map((column, colIndex) => {
                                            const columnName = typeof column === 'string' ? column : column.name;
                                            return (
                                              <div key={colIndex} className="flex-1 min-w-0 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                                                <Input
                                                  value={row[columnName] || ''}
                                                  onChange={(e) => updateSampleCellValue(param.id, rowIndex, columnName, e.target.value)}
                                                  placeholder={`${columnName} value`}
                                                  className="border-0 rounded-none text-xs h-8 focus:ring-0"
                                                />
                                              </div>
                                            );
                                          })}
                                          <div className="w-8 flex items-center justify-center">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => removeSampleRow(param.id, rowIndex)}
                                              className="h-5 w-5 p-0 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Add Row Button */}
                                    {param.sampleData.rows.length < 5 && (
                                      <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => addSampleRow(param.id)}
                                          className="w-full text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Add Row ({param.sampleData.rows.length}/5)
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(!param.sampleData || param.sampleData.columns.length === 0) && (
                                  <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                                    Click "Add Column" to start creating your sample data collection
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Add Input button */}
                  <div className="text-center py-4">
                    <Button 
                      size="sm" 
                      onClick={addInputParameter}
                      className="bg-gray-600 hover:bg-gray-700"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Input
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          )}

          {/* AI Assistance (only for SCRIPT functions) */}
          {toolType === "CODE" && (
            <Card className="border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-gray-800 dark:text-gray-100">AI Assistance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="ai-assistance"
                    checked={aiAssistanceRequired}
                    onCheckedChange={setAiAssistanceRequired}
                  />
                  <Label htmlFor="ai-assistance" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Require AI assistance for final output processing
                  </Label>
                </div>
                {aiAssistanceRequired && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      AI Assistance Instructions
                    </Label>
                    <Textarea
                      value={formData.aiAssistancePrompt}
                      onChange={(e) => setFormData({ ...formData, aiAssistancePrompt: e.target.value })}
                      placeholder="Describe how AI should process the tool results to generate the final output"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Code/Prompt Section - Always visible when tool type is selected */}
          {toolType && (
            <Card className="border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-gray-800 dark:text-gray-100">
                    {toolType === 'CODE' ? 'Tool Code' : 'Tool Prompt'}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={editingFunction ? handleRegenerateCode : () => {
                      // For new tools, trigger the generation process
                      // Build the full operationType enum value - always Multiple
                      const fullOperationType = `${operationType}Multiple` as 'createMultiple' | 'updateMultiple';
                      
                      const toolData = {
                        projectId,
                        name: formData.name,
                        description: formData.description,
                        toolType,
                        outputType: "multiple",
                        operationType: fullOperationType,
                        inputParameters,
                        aiAssistanceRequired: toolType === "CODE" ? aiAssistanceRequired : false,
                        aiAssistancePrompt: aiAssistanceRequired ? formData.aiAssistancePrompt : null,
                      };
                      generateToolCode.mutate(toolData);
                    }}
                    disabled={regenerateToolCode.isPending || generateToolCode.isPending || generateCodeClean.isPending || !formData.name || !formData.description || inputParameters.length === 0}
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${(regenerateToolCode.isPending || generateToolCode.isPending || generateCodeClean.isPending) ? 'animate-spin' : ''}`} />
                    {(regenerateToolCode.isPending || generateToolCode.isPending || generateCodeClean.isPending) ? 
                      (toolType === 'CODE' ? 'Generating Code' : 'Generating Prompt') : 
                      (toolType === 'CODE' ? 'Generate Code' : 'Generate Prompt')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={toolType === 'CODE' ? (formData.functionCode || '') : (formData.aiPrompt || '')}
                  onChange={(e) => {
                    if (toolType === 'CODE') {
                      setFormData({ ...formData, functionCode: e.target.value });
                    } else {
                      setFormData({ ...formData, aiPrompt: e.target.value });
                    }
                  }}
                  placeholder={toolType === 'CODE' 
                    ? "Enter your Python code here, or click 'Generate Code' to create automatically..."
                    : toolType === 'DATABASE_LOOKUP'
                    ? "Enter lookup instructions here, or click 'Generate Prompt' to create automatically..."
                    : "Enter your prompt here, or click 'Generate Prompt' to create automatically..."
                  }
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {toolType === 'CODE' 
                    ? 'You can manually enter Python code or use the "Generate Code" button to create it automatically based on your inputs.'
                    : toolType === 'DATABASE_LOOKUP'
                    ? 'You can manually enter lookup instructions or use the "Generate Prompt" button to create them automatically. These instructions guide the AI in filtering and matching records from the data source.'
                    : 'You can manually enter your prompt or use the "Generate Prompt" button to create it automatically based on your inputs.'
                  }
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={createTool.isPending || updateTool.isPending}
              className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createTool.isPending || updateTool.isPending}
              className="bg-gray-700 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-700 text-white"
            >
              {createTool.isPending || updateTool.isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingFunction ? "Updating..." : "Creating..."}
                </div>
              ) : (
                editingFunction ? "Update Tool" : "Create Tool"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toolType === 'AI_ONLY' ? 'Generate Prompt' : 'Generate Code'}</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate new {toolType === 'AI_ONLY' ? 'prompt' : 'code'} based on current inputs. Any existing {toolType === 'AI_ONLY' ? 'prompt' : 'code'} will be overwritten. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowRegenerateDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmRegenerate} className="bg-gray-700 hover:bg-gray-800">
              {toolType === 'AI_ONLY' ? 'Generate Prompt' : 'Generate Code'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}