import { DatabaseLookupModal } from "@/components/DatabaseLookupModal";
import type { ToolDisplayComponentProps } from "./ToolDisplayRegistry";

export function TableDisplayView(props: ToolDisplayComponentProps) {
  const { displayConfig, ...rest } = props;
  return <DatabaseLookupModal {...rest} />;
}
