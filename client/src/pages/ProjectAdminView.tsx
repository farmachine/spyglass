import { useParams } from "wouter";
import ProjectAdmin from "./ProjectAdmin";

export default function ProjectAdminView() {
  const { id } = useParams<{ id: string }>();
  
  if (!id) {
    return <div>Project ID is required</div>;
  }
  
  return <ProjectAdmin projectId={id} />;
}