              {/* Info Tab Content - Single Object View */}
              <TabsContent value="info" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {project.mainObjectName || "Session"} Information
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Core information and fields extracted from this {(project.mainObjectName || "session").toLowerCase()}.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {project.schemaFields
                        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                        .map((field) => {
                        const originalValue = extractedData[field.fieldName];
                        const validation = getValidation(field.fieldName);
                        
                        // Show field if it has a value OR if there's a validation for it
                        if (originalValue !== undefined || validation) {
                          // Use validation's extractedValue (which includes manual edits), not the original extracted value
                          let displayValue = validation?.extractedValue ?? originalValue ?? null;
                          if (displayValue === "null" || displayValue === "undefined") {
                            displayValue = null;
                          }
                          
                          return (
                            <div key={field.id} className="space-y-2">
                              <Label className="text-sm font-medium text-gray-700">
                                {field.fieldName}
                              </Label>
                              <div className="relative">
                                {(() => {
                                  const fieldName = field.fieldName;
                                  const validation = getValidation(fieldName);
                                  const hasValue = displayValue !== null && displayValue !== undefined && displayValue !== "";
                                  const wasManuallyUpdated = validation && validation.originalValue !== validation.extractedValue && validation.extractedValue !== null;
                                  const isVerified = validation?.validationStatus === 'verified' || validation?.validationStatus === 'valid';
                                  const score = Math.round(validation?.confidenceScore || 0);

                                  // Render confidence indicator/verification status  
                                  if (wasManuallyUpdated) {
                                    return (
                                      <div className="absolute top-2 left-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                      </div>
                                    );
                                  } else if (isVerified) {
                                    // Show green tick when verified
                                    return (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              onClick={() => handleFieldVerification(fieldName, false)}
                                              className="absolute top-2 left-1 w-3 h-3 flex items-center justify-center text-green-600 hover:bg-green-50 rounded transition-colors"
                                              aria-label="Click to unverify"
                                            >
                                              <span className="text-xs font-bold">✓</span>
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Verified with {score}% confidence
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  } else if (hasValue && validation?.confidenceScore) {
                                    // Show colored confidence dot when not verified
                                    const colorClass = score >= 80 ? 'bg-green-500' : 
                                                     score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                    
                                    return (
                                      <button
                                        onClick={() => {
                                          if (validation.aiReasoning) {
                                            setSelectedReasoning({
                                              reasoning: validation.aiReasoning,
                                              fieldName,
                                              confidenceScore: validation.confidenceScore || 0
                                            });
                                          }
                                        }}
                                        className={`absolute top-2 left-1 w-3 h-3 ${colorClass} rounded-full cursor-pointer hover:opacity-80 transition-opacity`}
                                        title={`${score}% confidence - Click for AI analysis`}
                                      />
                                    );
                                  }
                                  return null;
                                })()}
                                
                                <div className="pl-6 pr-2">
                                  {(() => {
                                    const validation = getValidation(field.fieldName);
                                    const isEditing = editingField === field.fieldName;
                                    const fieldType = field.fieldType;
                                    
                                    if (isEditing) {
                                      return (
                                        <div className="flex items-center gap-2">
                                          {fieldType === 'DATE' ? (
                                            <Input
                                              type="date"
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              className="flex-1"
                                            />
                                          ) : fieldType === 'NUMBER' ? (
                                            <Input
                                              type="number"
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              className="flex-1"
                                            />
                                          ) : fieldType === 'BOOLEAN' ? (
                                            <Select value={editValue} onValueChange={setEditValue}>
                                              <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Select value" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="true">True</SelectItem>
                                                <SelectItem value="false">False</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          ) : fieldType === 'TEXTAREA' ? (
                                            <textarea
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              className="w-full min-h-[100px] p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                              rows={4}
                                            />
                                          ) : (
                                            <Input
                                              type="text"
                                              value={editValue}
                                              onChange={(e) => setEditValue(e.target.value)}
                                              className="flex-1"
                                            />
                                          )}
                                          <Button size="sm" onClick={() => handleSave(field.fieldName)}>
                                            Save
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>
                                            Cancel
                                          </Button>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1">
                                            {fieldType === 'TEXTAREA' ? (
                                              <div className="whitespace-pre-wrap text-sm text-gray-900 p-2 bg-gray-50 border rounded-md min-h-[60px]">
                                                {formatValueForDisplay(displayValue, fieldType)}
                                              </div>
                                            ) : (
                                              <span className="text-sm text-gray-900">
                                                {formatValueForDisplay(displayValue, fieldType)}
                                              </span>
                                            )}
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleEdit(field.fieldName, displayValue)}
                                            className="h-6 px-2"
                                          >
                                            <Edit3 className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      );
                                    }
                                  })()}
                                </div>
                              </div>
                              
                              {field.description && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {field.description}
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Individual Collection Tabs */}
              {project.collections.map((collection) => {
                const collectionData = extractedData[collection.collectionName];
                const collectionValidations = validations.filter(v => v.collectionName === collection.collectionName);
                const validationIndices = collectionValidations.length > 0 ? collectionValidations.map(v => v.recordIndex) : [];
                const maxRecordIndex = validationIndices.length > 0 ? Math.max(...validationIndices) : -1;
                
                if (maxRecordIndex < 0) return null;

                return (
                  <TabsContent key={collection.id} value={collection.collectionName} className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {collection.collectionName}
                          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {maxRecordIndex + 1} {maxRecordIndex === 0 ? 'item' : 'items'}
                          </span>
                        </CardTitle>
                        <p className="text-sm text-gray-600">{collection.description}</p>
                      </CardHeader>
                      <CardContent>
                        <Table className="session-table">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-24 border-r border-gray-300">Item #</TableHead>
                              {collection.properties
                                .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                                .map((property) => (
                                <TableHead 
                                  key={property.id} 
                                  className="relative border-r border-gray-300"
                                  style={{ 
                                    width: `${columnWidths[`${collection.id}-${property.id}`] || (
                                      property.fieldType === 'TEXTAREA' ? 400 : 
                                      property.propertyName.toLowerCase().includes('summary') || property.propertyName.toLowerCase().includes('description') ? 300 :
                                      property.propertyName.toLowerCase().includes('remediation') || property.propertyName.toLowerCase().includes('action') ? 280 :
                                      property.fieldType === 'TEXT' && (property.propertyName.toLowerCase().includes('title') || property.propertyName.toLowerCase().includes('name')) ? 200 :
                                      property.fieldType === 'TEXT' ? 120 : 
                                      property.fieldType === 'NUMBER' || property.fieldType === 'DATE' ? 80 :
                                      property.propertyName.toLowerCase().includes('status') ? 100 :
                                      100
                                    )}px`,
                                    minWidth: '80px'
                                  }}
                                >
                                  <div className="flex items-center justify-between group">
                                    <button
                                      onClick={() => handleSort(property.propertyName, collection.id)}
                                      className="flex items-center gap-2 hover:bg-gray-100 px-2 py-1 rounded flex-1 min-w-0"
                                    >
                                      <span className="truncate">{property.propertyName}</span>
                                      {getSortIcon(property.propertyName, collection.id)}
                                    </button>
                                    <div
                                      className="column-resizer opacity-0 group-hover:opacity-100 transition-opacity"
                                      onMouseDown={(e) => handleMouseDown(e, `${collection.id}-${property.id}`)}
                                    />
                                  </div>
                                </TableHead>
                              ))}
                              <TableHead className="w-32 border-r border-gray-300">Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              // Create array of items with original indices
                              const itemsWithIndices = Array.from({ length: maxRecordIndex + 1 }, (_, index) => ({
                                item: collectionData?.[index] || {},
                                originalIndex: index
                              }));
                              
                              // Apply sorting if configured
                              const sortedItems = sortConfig && sortConfig.collectionId === collection.id 
                                ? sortCollectionData(itemsWithIndices, collection, sortConfig)
                                : itemsWithIndices;
                              
                              return sortedItems.map(({ item, originalIndex }, displayIndex) => (
                                <TableRow key={originalIndex} className="border-b border-gray-300">
                                  <TableCell className="font-medium border-r border-gray-300">{displayIndex + 1}</TableCell>
                                  {collection.properties
                                    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                                    .map((property) => {
                                    const fieldName = `${collection.collectionName}.${property.propertyName}[${originalIndex}]`;
                                    const validation = getValidation(fieldName);
                                    
                                    // Try multiple possible property name mappings for extracted data
                                    const possibleKeys = [
                                      property.propertyName,
                                      property.propertyName.toLowerCase(),
                                      property.propertyName.charAt(0).toLowerCase() + property.propertyName.slice(1),
                                    ];
                                    
                                    let originalValue = undefined;
                                    for (const key of possibleKeys) {
                                      if (item[key] !== undefined) {
                                        originalValue = item[key];
                                        break;
                                      }
                                    }
                                    
                                    let displayValue = validation?.extractedValue ?? originalValue ?? null;
                                    if (displayValue === "null" || displayValue === "undefined") {
                                      displayValue = null;
                                    }
                                    
                                    return (
                                      <TableCell 
                                        key={property.id} 
                                        className="relative border-r border-gray-300"
                                        style={{ 
                                          width: `${columnWidths[`${collection.id}-${property.id}`] || (
                                            property.fieldType === 'TEXTAREA' ? 400 : 
                                            property.propertyName.toLowerCase().includes('summary') || property.propertyName.toLowerCase().includes('description') ? 300 :
                                            property.propertyName.toLowerCase().includes('remediation') || property.propertyName.toLowerCase().includes('action') ? 280 :
                                            property.fieldType === 'TEXT' && (property.propertyName.toLowerCase().includes('title') || property.propertyName.toLowerCase().includes('name')) ? 200 :
                                            property.fieldType === 'TEXT' ? 120 : 
                                            property.fieldType === 'NUMBER' || property.fieldType === 'DATE' ? 80 :
                                            property.propertyName.toLowerCase().includes('status') ? 100 :
                                            100
                                          )}px`,
                                          minWidth: '80px'
                                        }}
                                      >
                                        <div className="relative w-full">
                                          {/* Content */}
                                          <div className={`table-cell-content w-full pl-6 pr-2 ${
                                            property.fieldType === 'TEXTAREA' ? 'min-h-[60px] py-2' : 'py-2'
                                          } break-words whitespace-normal overflow-wrap-anywhere leading-relaxed`}>
                                            {formatValueForDisplay(displayValue, property.fieldType)}
                                          </div>
                                          
                                          {/* Combined confidence/verification indicator on top-left corner */}
                                          {validation && (
                                            <>
                                              {(() => {
                                                const wasManuallyUpdated = validation.validationStatus === 'manual';
                                                const hasValue = validation.extractedValue !== null && 
                                                               validation.extractedValue !== undefined && 
                                                               validation.extractedValue !== "" && 
                                                               validation.extractedValue !== "null" && 
                                                               validation.extractedValue !== "undefined";
                                                const isVerified = validation.validationStatus === 'verified' || validation.validationStatus === 'valid';
                                                const score = Math.round(validation.confidenceScore || 0);

                                                if (wasManuallyUpdated) {
                                                  return (
                                                    <div className="absolute top-2 left-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                                    </div>
                                                  );
                                                } else if (isVerified) {
                                                  // Show green tick when verified
                                                  return (
                                                    <TooltipProvider>
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <button
                                                            onClick={() => handleFieldVerification(fieldName, false)}
                                                            className="absolute top-2 left-1 w-3 h-3 flex items-center justify-center text-green-600 hover:bg-green-50 rounded transition-colors"
                                                            aria-label="Click to unverify"
                                                          >
                                                            <span className="text-xs font-bold">✓</span>
                                                          </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                          Verified with {score}% confidence
                                                        </TooltipContent>
                                                      </Tooltip>
                                                    </TooltipProvider>
                                                  );
                                                } else if (hasValue && validation.confidenceScore) {
                                                  // Show colored confidence dot when not verified
                                                  const colorClass = score >= 80 ? 'bg-green-500' : 
                                                                   score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
                                                  
                                                  return (
                                                    <button
                                                      onClick={() => {
                                                        if (validation.aiReasoning) {
                                                          setSelectedReasoning({
                                                            reasoning: validation.aiReasoning,
                                                            fieldName,
                                                            confidenceScore: validation.confidenceScore || 0
                                                          });
                                                        }
                                                      }}
                                                      className={`absolute top-2 left-1 w-3 h-3 ${colorClass} rounded-full cursor-pointer hover:opacity-80 transition-opacity`}
                                                      title={`${score}% confidence - Click for AI analysis`}
                                                    />
                                                  );
                                                }
                                                return null;
                                              })()}
                                            </>
                                          )}
                                        </div>
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="border-r border-gray-300">
                                    {(() => {
                                      // Calculate verification status for this item
                                      const itemValidations = collection.properties.map(property => {
                                        const fieldName = `${collection.collectionName}.${property.propertyName}[${originalIndex}]`;
                                        return getValidation(fieldName);
                                      }).filter(Boolean);
                                      
                                      const allVerified = itemValidations.length > 0 && 
                                        itemValidations.every(v => v?.validationStatus === 'valid' || v?.validationStatus === 'verified');
                                      
                                      return (
                                        <button
                                          onClick={() => handleItemVerification(collection.collectionName, originalIndex, !allVerified)}
                                          className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                                          title={allVerified ? "Click to mark all fields as unverified" : "Click to mark all fields as verified"}
                                        >
                                          {allVerified ? (
                                            <>
                                              <CheckCircle className="h-4 w-4 text-green-600" />
                                              <span className="text-green-600 font-medium text-sm">Verified</span>
                                            </>
                                          ) : (
                                            <>
                                              <AlertTriangle className="h-4 w-4 text-red-600" />
                                              <span className="text-red-600 font-medium text-sm">Unverified</span>
                                            </>
                                          )}
                                        </button>
                                      );
                                    })()}
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </div>
      </div>

      {/* AI Reasoning Modal */}
      {selectedReasoning && (
        <Dialog open={!!selectedReasoning} onOpenChange={() => setSelectedReasoning(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                AI Analysis - {getFieldDisplayName(selectedReasoning.fieldName)}
              </DialogTitle>
              <DialogDescription>
                Confidence: {Math.round(selectedReasoning.confidenceScore)}%
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              <div>
                <Label className="text-sm font-medium">AI Reasoning</Label>
                <div className="mt-2 p-3 bg-gray-50 rounded-md text-sm whitespace-pre-wrap">
                  {selectedReasoning.reasoning}
                </div>
              </div>
              
              {(() => {
                const validation = getValidation(selectedReasoning.fieldName);
                const isVerified = validation?.validationStatus === 'verified' || validation?.validationStatus === 'valid';
                
                return (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={() => {
                        handleFieldVerification(selectedReasoning.fieldName, !isVerified);
                        setSelectedReasoning(null);
                      }}
                      variant={isVerified ? "outline" : "default"}
                      className="flex items-center gap-2"
                    >
                      {isVerified ? (
                        <>
                          <X className="h-4 w-4" />
                          Mark as Unverified
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Mark as Verified
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => setSelectedReasoning(null)}
                      variant="outline"
                    >
                      Close
                    </Button>
                  </div>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Data Report Dialog */}
      <Dialog open={showReasoningDialog} onOpenChange={setShowReasoningDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              Request More Info Draft
            </DialogTitle>
            <DialogDescription>
              Email-ready report for requesting missing information from data providers
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            <Label htmlFor="report-text" className="text-sm font-medium">
              Report Content (ready to copy and paste into email)
            </Label>
            <textarea
              id="report-text"
              value={generateDataReport()}
              readOnly
              className="w-full h-80 mt-2 p-3 border rounded-md bg-gray-50 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex justify-between mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(generateDataReport());
                  toast({
                    title: "Copied to clipboard",
                    description: "Data report has been copied to your clipboard.",
                  });
                } catch (error) {
                  toast({
                    title: "Copy failed",
                    description: "Failed to copy to clipboard. Please select and copy the text manually.",
                    variant: "destructive"
                  });
                }
              }}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy to Clipboard
            </Button>
            <Button onClick={() => setShowReasoningDialog(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validation Processing Dialog */}
      <ValidationProcessingDialog
        open={showValidationDialog}
        processingStep={validationStep}
        processingProgress={validationProgress}
      />
    </div>
  );
}