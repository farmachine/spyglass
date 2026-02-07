import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import L from "leaflet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, X } from "lucide-react";
import type { ToolDisplayComponentProps } from "./ToolDisplayRegistry";

const LEAFLET_CSS_ID = "leaflet-css-cdn";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

function ensureLeafletCSS() {
  if (document.getElementById(LEAFLET_CSS_ID)) return;
  const link = document.createElement("link");
  link.id = LEAFLET_CSS_ID;
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS_URL;
  document.head.appendChild(link);
}

const DEFAULT_ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const SELECTED_ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [30, 49],
  iconAnchor: [15, 49],
  popupAnchor: [1, -40],
  shadowSize: [49, 49],
  className: "leaflet-selected-marker",
});

export function MapDisplayView(props: ToolDisplayComponentProps) {
  const {
    isOpen,
    onClose,
    onSelect,
    datasourceData,
    columnMappings,
    outputColumn,
    displayConfig,
  } = props;

  const mapConfig = displayConfig.mapConfig;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [selectedValue, setSelectedValue] = useState("");

  const safeData = Array.isArray(datasourceData) ? datasourceData : [];
  const columns = useMemo(() => {
    if (safeData.length === 0) return [];
    return Object.keys(safeData[0]);
  }, [safeData]);

  const getDisplayName = (col: string) => columnMappings[col] || col;

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return safeData;
    const lower = searchTerm.toLowerCase();
    return safeData.filter((record) =>
      columns.some((col) => {
        const val = record[col];
        return val && val.toString().toLowerCase().includes(lower);
      })
    );
  }, [safeData, searchTerm, columns]);

  const validPoints = useMemo(() => {
    if (!mapConfig) return [];
    return filteredData.filter((record) => {
      const lat = parseFloat(record[mapConfig.latField]);
      const lng = parseFloat(record[mapConfig.lngField]);
      return !isNaN(lat) && !isNaN(lng);
    });
  }, [filteredData, mapConfig]);

  const handleSelectRecord = useCallback(
    (record: any) => {
      setSelectedRecord(record);
      const value = record[outputColumn];
      setSelectedValue(value ? value.toString() : "");
    },
    [outputColumn]
  );

  const handleUpdate = () => {
    if (selectedValue) {
      onSelect(selectedValue);
      onClose();
    }
  };

  useEffect(() => {
    ensureLeafletCSS();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSelectedRecord(null);
      setSelectedValue("");
      setSearchTerm("");
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || !mapConfig) return;

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const defaultCenter: [number, number] = mapConfig.defaultCenter || [51.505, -0.09];
      const defaultZoom = mapConfig.defaultZoom || 6;

      const map = L.map(mapContainerRef.current!, {
        center: defaultCenter,
        zoom: defaultZoom,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;

      const markers: L.Marker[] = [];
      const bounds: L.LatLngExpression[] = [];

      validPoints.forEach((record) => {
        const lat = parseFloat(record[mapConfig.latField]);
        const lng = parseFloat(record[mapConfig.lngField]);

        const marker = L.marker([lat, lng], { icon: DEFAULT_ICON }).addTo(map);

        const label = mapConfig.labelField ? record[mapConfig.labelField] : "";
        const popupFields = mapConfig.popupFields || [];
        let popupContent = "";
        if (label) {
          popupContent += `<strong>${label}</strong>`;
        }
        if (popupFields.length > 0) {
          popupContent += "<div style='margin-top:4px;font-size:12px;'>";
          popupFields.forEach((field) => {
            const displayName = getDisplayName(field);
            const val = record[field] ?? "";
            popupContent += `<div><b>${displayName}:</b> ${val}</div>`;
          });
          popupContent += "</div>";
        }
        if (popupContent) {
          marker.bindPopup(popupContent);
        }

        marker.on("click", () => {
          markers.forEach((m) => m.setIcon(DEFAULT_ICON));
          marker.setIcon(SELECTED_ICON);
          handleSelectRecord(record);
        });

        markers.push(marker);
        bounds.push([lat, lng]);
      });

      markersRef.current = markers;

      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds as L.LatLngExpression[]), { padding: [40, 40] });
      }

      setTimeout(() => map.invalidateSize(), 100);
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersRef.current = [];
    };
  }, [isOpen, validPoints, mapConfig, handleSelectRecord]);

  if (!mapConfig) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#4F63A4]" />
            Map View - Select Location
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md whitespace-nowrap">
              {validPoints.length} locations
            </span>
          </div>

          <div className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden relative">
            <div
              ref={mapContainerRef}
              className="w-full h-full"
              style={{ minHeight: "300px" }}
            />
          </div>

          {selectedRecord && (
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Selected: {getDisplayName(outputColumn)} = "{selectedValue}"
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedRecord(null);
                    setSelectedValue("");
                    markersRef.current.forEach((m) => m.setIcon(DEFAULT_ICON));
                  }}
                  className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {displayConfig.mapConfig?.popupFields && displayConfig.mapConfig.popupFields.length > 0 && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {displayConfig.mapConfig.popupFields.map((field) => (
                    <div key={field} className="text-xs">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">{getDisplayName(field)}:</span>{" "}
                      <span className="text-blue-800 dark:text-blue-200">{selectedRecord[field] ?? ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={!selectedValue}
            className="bg-[#4F63A4] hover:bg-[#3d4f8a] text-white"
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
