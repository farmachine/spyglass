import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Settings, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

// Mock data for demonstration - will be replaced with actual API calls
const mockSteps = [
  {
    id: "step-1",
    stepName: "Basic Information Extraction",
    stepDescription: "Extract fundamental document details like parties, dates, and document types",
    stepNumber: 1,
    orderIndex: 0,
    fields: [
      { id: "field-1", fieldName: "Document Type", fieldType: "TEXT" },
      { id: "field-2", fieldName: "Contract Date", fieldType: "DATE" }
    ],
    collections: [
      { id: "coll-1", collectionName: "Parties", properties: ["Name", "Address"] }
    ]
  },
  {
    id: "step-2", 
    stepName: "Analysis and Validation",
    stepDescription: "Validate extracted data using {{Step1.DocumentType}} and cross-reference party information with {{Step1.Parties.Name}}",
    stepNumber: 2,
    orderIndex: 1,
    fields: [
      { id: "field-3", fieldName: "Risk Assessment", fieldType: "TEXT" },
      { id: "field-4", fieldName: "Compliance Status", fieldType: "TEXT" }
    ],
    collections: []
  }
];

const stepFormSchema = z.object({
  stepName: z.string().min(1, "Step name is required"),
  stepDescription: z.string().min(1, "Step description is required"),
});

type StepFormValues = z.infer<typeof stepFormSchema>;

interface ExtractionStepsManagerProps {
  projectId: string;
}

export function ExtractionStepsManager({ projectId }: ExtractionStepsManagerProps) {
  const [steps, setSteps] = useState(mockSteps);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set(["step-1"]));
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const form = useForm<StepFormValues>({
    resolver: zodResolver(stepFormSchema),
    defaultValues: {
      stepName: "",
      stepDescription: "",
    },
  });

  const toggleStepExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const onSubmit = (values: StepFormValues) => {
    // TODO: Implement API call to create step
    console.log("Creating step:", values);
    setIsCreateDialogOpen(false);
    form.reset();
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(steps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update step numbers and order indices
    const updatedItems = items.map((item, index) => ({
      ...item,
      stepNumber: index + 1,
      orderIndex: index,
    }));

    setSteps(updatedItems);
    // TODO: Implement API call to update step order
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Extraction Steps</h3>
          <p className="text-sm text-muted-foreground">
            Configure sequential processing steps for complex document analysis
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Step
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Extraction Step</DialogTitle>
              <DialogDescription>
                Add a new step to your extraction workflow. Steps are processed sequentially and can reference previous step results.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="stepName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Step Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Basic Information Extraction" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stepDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Step Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what this step extracts. Use {{PreviousStep.FieldName}} to reference previous results."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Use {"{{StepName.FieldName}}"} syntax to reference fields from previous steps
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Step</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="steps">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
              {steps.map((step, index) => (
                <Draggable key={step.id} draggableId={step.id} index={index}>
                  {(provided, snapshot) => (
                    <Card
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`${snapshot.isDragging ? 'shadow-lg' : ''}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab hover:cursor-grabbing"
                            >
                              <div className="flex flex-col space-y-1">
                                <div className="w-3 h-0.5 bg-gray-400 rounded"></div>
                                <div className="w-3 h-0.5 bg-gray-400 rounded"></div>
                                <div className="w-3 h-0.5 bg-gray-400 rounded"></div>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              Step {step.stepNumber}
                            </Badge>
                            <CardTitle className="text-base">{step.stepName}</CardTitle>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button variant="ghost" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleStepExpansion(step.id)}
                            >
                              {expandedSteps.has(step.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {step.stepDescription}
                        </p>
                      </CardHeader>

                      {expandedSteps.has(step.id) && (
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-sm font-medium mb-2">Schema Fields ({step.fields.length})</h4>
                              <div className="space-y-2">
                                {step.fields.map((field) => (
                                  <div key={field.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                    <span className="text-sm">{field.fieldName}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {field.fieldType}
                                    </Badge>
                                  </div>
                                ))}
                                {step.fields.length === 0 && (
                                  <p className="text-xs text-muted-foreground">No fields assigned to this step</p>
                                )}
                              </div>
                            </div>

                            <div>
                              <h4 className="text-sm font-medium mb-2">Collections ({step.collections.length})</h4>
                              <div className="space-y-2">
                                {step.collections.map((collection) => (
                                  <div key={collection.id} className="p-2 bg-gray-50 rounded-md">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm font-medium">{collection.collectionName}</span>
                                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                        Collection
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Properties: {collection.properties.join(", ")}
                                    </div>
                                  </div>
                                ))}
                                {step.collections.length === 0 && (
                                  <p className="text-xs text-muted-foreground">No collections assigned to this step</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {index < steps.length - 1 && (
                            <div className="flex items-center justify-center mt-4 pt-4 border-t">
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                <span>Results available for next step</span>
                                <ArrowRight className="h-4 w-4" />
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {steps.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Settings className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Extraction Steps</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first extraction step to begin configuring multi-step document processing
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Step
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}