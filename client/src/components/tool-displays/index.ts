export type { ToolDisplayConfig, ToolDisplayComponentProps } from './ToolDisplayRegistry';
export { getDisplayComponent, registerDisplayType } from './ToolDisplayRegistry';
import { registerDisplayType } from './ToolDisplayRegistry';
import { TableDisplayView } from './TableDisplayView';
import { MapDisplayView } from './MapDisplayView';

registerDisplayType('table', TableDisplayView);
registerDisplayType('map', MapDisplayView);
