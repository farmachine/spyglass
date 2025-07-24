import DefineDataSimple from "@/components/DefineDataSimple";
import type { ProjectWithDetails } from "@shared/schema";

interface DefineDataProps {
  project: ProjectWithDetails;
}

export default function DefineData({ project }: DefineDataProps) {
  // Use the simplified component to avoid complexity
  return <DefineDataSimple project={project} />;
}