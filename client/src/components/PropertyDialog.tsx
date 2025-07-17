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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { CollectionProperty } from "@shared/schema";

const propertyTypes = ["TEXT", "NUMBER", "DATE", "BOOLEAN"] as const;

const propertyFormSchema = z.object({
  propertyName: z.string().min(1, "Property name is required"),
  propertyType: z.enum(propertyTypes),
  description: z.string().min(1, "Description is required - this helps the AI understand what to extract"),
  autoVerificationConfidence: z.number().min(0).max(100).default(80),
  orderIndex: z.number().default(0),
});

type PropertyForm = z.infer<typeof propertyFormSchema>;

interface PropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: PropertyForm) => Promise<void>;
  property?: CollectionProperty | null;
  isLoading?: boolean;
  collectionName?: string;
}

export default function PropertyDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  property, 
  isLoading = false,
  collectionName = "Collection"
}: PropertyDialogProps) {
  const form = useForm<PropertyForm>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: {
      propertyName: "",
      propertyType: "TEXT",
      description: "",
      autoVerificationConfidence: 80,
      orderIndex: 0,
    },
  });

  // Reset form with new values when property prop changes
  useEffect(() => {
    if (open) {
      form.reset({
        propertyName: property?.propertyName || "",
        propertyType: (property?.propertyType as typeof propertyTypes[number]) || "TEXT",
        description: property?.description || "",
        autoVerificationConfidence: property?.autoVerificationConfidence || 80,
        orderIndex: property?.orderIndex || 0,
      });
    }
  }, [property, open, form]);

  const handleSubmit = async (data: PropertyForm) => {
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
            {property ? "Edit Property" : "Add Property"}
          </DialogTitle>
          <DialogDescription>
            Add a property to the "{collectionName}" collection. The description helps the AI understand what data to extract for this property.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="propertyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Name, Salary, Date of Birth" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="propertyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select property type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TEXT">Text</SelectItem>
                      <SelectItem value="NUMBER">Number</SelectItem>
                      <SelectItem value="DATE">Date</SelectItem>
                      <SelectItem value="BOOLEAN">Boolean</SelectItem>
                    </SelectContent>
                  </Select>
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
                      placeholder="Tell the AI what to look for (e.g., 'The employee's full name as listed in the document' or 'Annual salary amount in dollars')"
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    This description guides the AI during data extraction
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="autoVerificationConfidence"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Auto Verification Confidence Level (%)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min={0} 
                      max={100} 
                      placeholder="80"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : '')}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    Fields with confidence at or above this threshold will be automatically verified after extraction
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
                {isLoading ? "Saving..." : property ? "Update Property" : "Add Property"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}