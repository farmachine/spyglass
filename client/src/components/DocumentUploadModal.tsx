import AddDocumentsModal from "./AddDocumentsModal";

interface DocumentUploadModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  projectId: string;
  onSuccess: () => void;
}

export default function DocumentUploadModal(props: DocumentUploadModalProps) {
  return (
    <AddDocumentsModal 
      {...props} 
      mode="upload" 
    />
  );
}