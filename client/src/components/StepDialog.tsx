import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const stepSchema = z.object({
  name: z.string().min(1, "Step name is required"),
  description: z.string().min(1, "Step description is required"),
});

type StepFormData = z.infer<typeof stepSchema>;

interface StepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (stepData: StepFormData) => void;
  step?: any | null;
}

export default function StepDialog({ open, onOpenChange, onSave, step }: StepDialogProps) {
  const { toast } = useToast();
  const form = useForm<StepFormData>({
    resolver: zodResolver(stepSchema),
    defaultValues: {
      name: step?.name || "",
      description: step?.description || "",
    },
  });

  const handleSubmit = (data: StepFormData) => {
    onSave(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{step ? "Edit Step" : "Add Extraction Step"}</DialogTitle>
          <DialogDescription>
            Create a processing step that can reference fields from previous steps using @FieldName syntax.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Step Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Basic Information, Validation, Analysis"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A short name to identify this extraction step
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Step Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this step extracts. Use @FieldName to reference fields from previous steps."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Explain the purpose of this step and what data it should extract
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {step ? "Update Step" : "Add Step"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}