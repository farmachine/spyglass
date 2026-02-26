import { getDisplayComponent } from './tool-displays';
import type { ToolDisplayConfig } from './tool-displays';

interface ToolResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: string, selectedRecord?: any) => Promise<void> | void;
  datasourceData: any[];
  columnMappings: Record<string, string>;
  initialFilters: Array<{column: string; operator: string; inputField: string; fuzziness: number}>;
  outputColumn: string;
  currentInputValues: Record<string, string>;
  displayConfig: ToolDisplayConfig;
  categoryColumn?: string;
  categoryFilterByValue?: string;
}

export function ToolResultModal(props: ToolResultModalProps) {
  const { displayConfig, ...rest } = props;
  if (!displayConfig || displayConfig.modalType === 'none') return null;

  const DisplayComponent = getDisplayComponent(displayConfig.modalType);
  if (!DisplayComponent) return null;

  return <DisplayComponent {...rest} displayConfig={displayConfig} />;
}
