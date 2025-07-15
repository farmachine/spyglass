import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertKnowledgeDocumentSchema } from "@shared/schema";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { KnowledgeDocument } from "@shared/schema";

const knowledgeDocumentFormSchema = insertKnowledgeDocumentSchema.omit({ projectId: true }).extend({
  description: z.string().min(1, "Description is required to guide AI extraction"),
});

type KnowledgeDocumentForm = z.infer<typeof knowledgeDocumentFormSchema>;

interface KnowledgeDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: KnowledgeDocumentForm) => Promise<void>;
  document?: KnowledgeDocument | null;
  isLoading?: boolean;
}

const FILE_TYPES = [
  { value: "pdf", label: "PDF Document" },
  { value: "docx", label: "Word Document" },
  { value: "txt", label: "Text File" },
  { value: "xlsx", label: "Excel Spreadsheet" },
  { value: "csv", label: "CSV File" },
];

export default function KnowledgeDocumentDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  document,
  isLoading = false 
}: KnowledgeDocumentDialogProps) {
  const form = useForm<KnowledgeDocumentForm>({
    resolver: zodResolver(knowledgeDocumentFormSchema),
    defaultValues: {
      fileName: document?.fileName || "",
      fileType: document?.fileType || "pdf",
      fileSize: document?.fileSize || 0,
      description: document?.description || "",
    },
  });

  const handleSubmit = async (data: KnowledgeDocumentForm) => {
    try {
      await onSave(data);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save knowledge document:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {document ? "Edit Knowledge Document" : "Add Knowledge Document"}
          </DialogTitle>
          <DialogDescription>
            Add reference documents to improve AI extraction accuracy. These documents provide context and examples for better data extraction.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fileName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>File Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="document.pdf"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fileType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>File Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select file type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FILE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="fileSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File Size (bytes)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
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
                  <FormLabel>AI Guidance Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe how this document should guide AI extraction. Example: 'This policy document contains standard formats for employee information, use it to understand proper data structure for personnel records.'"
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-gray-500">
                    Required. This description tells the AI how to use this document during extraction.
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
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : document ? "Update Document" : "Add Document"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}