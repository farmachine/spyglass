import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ObjectCollection } from "@shared/schema";

const collectionFormSchema = z.object({
  collectionName: z.string().min(1, "List name is required"),
  description: z.string().min(1, "Description is required - this helps the AI understand what objects to extract"),
  orderIndex: z.number().default(0),
});

type CollectionForm = z.infer<typeof collectionFormSchema>;

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: CollectionForm) => Promise<void>;
  collection?: ObjectCollection | null;
  isLoading?: boolean;
}

export default function CollectionDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  collection, 
  isLoading = false 
}: CollectionDialogProps) {
  const form = useForm<CollectionForm>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: {
      collectionName: "",
      description: "",
      orderIndex: 0,
    },
  });

  // Reset form with new values when collection prop changes
  useEffect(() => {
    if (open) {
      form.reset({
        collectionName: collection?.collectionName || "",
        description: collection?.description || "",
        orderIndex: collection?.orderIndex || 0,
      });
    }
  }, [collection, open, form]);

  const handleSubmit = async (data: CollectionForm) => {
    try {
      await onSave(data);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in parent component
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {collection ? "Edit List" : "Create List"}
          </DialogTitle>
          <DialogDescription>
            Define a list type with properties that can create multiple records. The description helps the AI understand what objects to extract.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="collectionName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>List Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Employees, Assets, Contracts" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell the AI what objects to look for (e.g., 'Employee records with personal and job information listed in tables or sections')"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    This description guides the AI to identify and extract these objects
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className=""
              >
                {isLoading ? "Saving..." : collection ? "Update List" : "Create List"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}