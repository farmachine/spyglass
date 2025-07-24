import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const createStepSchema = z.object({
  stepName: z.string().min(1, "Step name is required"),
  stepType: z.enum(["extract", "transform", "validate"]),
  description: z.string().optional(),
  isConditional: z.boolean().default(false),
  conditionLogic: z.string().optional(),
});

type CreateStepFormData = z.infer<typeof createStepSchema>;

interface CreateStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  stepCount: number;
}

export function CreateStepDialog({ open, onOpenChange, projectId, stepCount }: CreateStepDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConditional, setIsConditional] = useState(false);

  const form = useForm<CreateStepFormData>({
    resolver: zodResolver(createStepSchema),
    defaultValues: {
      stepName: "",
      stepType: "extract",
      description: "",
      isConditional: false,
      conditionLogic: "",
    },
  });

  const createStepMutation = useMutation({
    mutationFn: async (data: CreateStepFormData) => {
      return apiRequest(`/api/projects/${projectId}/extraction-steps`, {
        method: "POST",
        body: JSON.stringify({
          ...data,
          orderIndex: stepCount,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/extraction-steps`] });
      toast({
        title: "Step created",
        description: "The extraction step has been created successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create extraction step. Please try again.",
        variant: "destructive",
      });
      console.error("Create step error:", error);
    },
  });

  const onSubmit = (data: CreateStepFormData) => {
    createStepMutation.mutate(data);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setIsConditional(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Extraction Step</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stepName">Step Name</Label>
            <Input
              id="stepName"
              {...form.register("stepName")}
              placeholder="e.g., Extract Company Information"
            />
            {form.formState.errors.stepName && (
              <p className="text-sm text-red-600">{form.formState.errors.stepName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="stepType">Step Type</Label>
            <Select
              value={form.watch("stepType")}
              onValueChange={(value) => form.setValue("stepType", value as "extract" | "transform" | "validate")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select step type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="extract">Extract - Extract data from documents</SelectItem>
                <SelectItem value="transform">Transform - Process and modify data</SelectItem>
                <SelectItem value="validate">Validate - Verify and check data quality</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Describe what this step does..."
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isConditional"
              checked={isConditional}
              onCheckedChange={(checked) => {
                setIsConditional(checked);
                form.setValue("isConditional", checked);
              }}
            />
            <Label htmlFor="isConditional">Conditional step</Label>
          </div>

          {isConditional && (
            <div className="space-y-2">
              <Label htmlFor="conditionLogic">Condition Logic</Label>
              <Textarea
                id="conditionLogic"
                {...form.register("conditionLogic")}
                placeholder="e.g., Run only if previous step found more than 5 parties"
                rows={2}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createStepMutation.isPending}
            >
              {createStepMutation.isPending ? "Creating..." : "Create Step"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}