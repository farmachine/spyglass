import type { ComponentType } from "react";

export interface ToolDisplayConfig {
  modalType: 'none' | 'table' | 'map';
  modalSize?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  tableConfig?: {
    searchable?: boolean;
    selectable?: boolean;
    maxRows?: number;
  };
  mapConfig?: {
    latField: string;
    lngField: string;
    labelField?: string;
    popupFields?: string[];
    defaultZoom?: number;
    defaultCenter?: [number, number];
  };
}

export interface ToolDisplayComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
  datasourceData: any[];
  columnMappings: Record<string, string>;
  initialFilters: Array<{column: string; operator: string; inputField: string; fuzziness: number}>;
  outputColumn: string;
  currentInputValues: Record<string, string>;
  displayConfig: ToolDisplayConfig;
  categoryColumn?: string;
}

const displayRegistry: Record<string, ComponentType<ToolDisplayComponentProps>> = {};

export function registerDisplayType(type: string, component: ComponentType<ToolDisplayComponentProps>) {
  displayRegistry[type] = component;
}

export function getDisplayComponent(type: string): ComponentType<ToolDisplayComponentProps> | null {
  return displayRegistry[type] || null;
}
