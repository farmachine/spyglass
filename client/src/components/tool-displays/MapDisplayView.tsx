import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import L from "leaflet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, X, Target } from "lucide-react";
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

function createColoredIcon(color: string, size: [number, number] = [25, 41]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 41" width="${size[0]}" height="${size[1]}">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12.5" cy="12.5" r="5" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'custom-marker-icon',
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1] + 5],
  });
}

const SEARCHED_ICON = createColoredIcon("#4F63A4", [30, 49]);
const NEARBY_ICON = createColoredIcon("#6B7280", [25, 41]);
const SELECTED_ICON = createColoredIcon("#16a34a", [30, 49]);

const RADIUS_KM = 3;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function applyFilterMatch(value: string, search: string, operator: string, fuzziness: number): boolean {
  if (!value || !search) return false;
  const v = value.toString().toLowerCase().trim();
  const s = search.toString().toLowerCase().trim();

  let baseMatch = false;
  switch (operator) {
    case 'equals':
      baseMatch = v === s;
      break;
    case 'contains':
      baseMatch = v.includes(s);
      break;
    case 'startsWith':
      baseMatch = v.startsWith(s);
      break;
    case 'endsWith':
      baseMatch = v.endsWith(s);
      break;
    default:
      baseMatch = v === s;
  }

  if (baseMatch) return true;

  if (fuzziness > 0 && !baseMatch) {
    if (fuzziness <= 30) return v.includes(s) || s.includes(v);
    if (fuzziness <= 60) {
      const words = s.split(/\s+/);
      return words.some(w => v.includes(w));
    }
    return s.length >= 3 && v.includes(s.substring(0, 3));
  }

  return false;
}

export function MapDisplayView(props: ToolDisplayComponentProps) {
  const {
    isOpen,
    onClose,
    onSelect,
    datasourceData,
    columnMappings,
    initialFilters,
    outputColumn,
    currentInputValues,
    displayConfig,
  } = props;

  const mapConfig = displayConfig.mapConfig;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const radiusCircleRef = useRef<L.Circle | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [selectedValue, setSelectedValue] = useState("");

  const safeData = Array.isArray(datasourceData) ? datasourceData : [];
  const columns = useMemo(() => {
    if (safeData.length === 0) return [];
    return Object.keys(safeData[0]);
  }, [safeData]);

  const getDisplayName = (col: string) => columnMappings[col] || col;

  const allValidPoints = useMemo(() => {
    if (!mapConfig) return [];
    return safeData.filter((record) => {
      const lat = parseFloat(record[mapConfig.latField]);
      const lng = parseFloat(record[mapConfig.lngField]);
      return !isNaN(lat) && !isNaN(lng);
    });
  }, [safeData, mapConfig]);

  const searchedRecord = useMemo(() => {
    if (!initialFilters || initialFilters.length === 0 || !currentInputValues) return null;

    let bestMatch: any = null;
    let bestScore = 0;

    for (const record of allValidPoints) {
      let matchCount = 0;
      for (const filter of initialFilters) {
        const recordVal = record[filter.column];
        const searchVal = currentInputValues[filter.inputField] || "";
        if (searchVal && recordVal && applyFilterMatch(recordVal.toString(), searchVal, filter.operator || 'equals', filter.fuzziness ?? 0)) {
          matchCount++;
        }
      }
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestMatch = record;
      }
    }

    return bestScore > 0 ? bestMatch : null;
  }, [allValidPoints, initialFilters, currentInputValues]);

  const nearbyRecords = useMemo(() => {
    if (!searchedRecord || !mapConfig) return allValidPoints;

    const centerLat = parseFloat(searchedRecord[mapConfig.latField]);
    const centerLng = parseFloat(searchedRecord[mapConfig.lngField]);

    if (isNaN(centerLat) || isNaN(centerLng)) return allValidPoints;

    return allValidPoints.filter((record) => {
      if (record === searchedRecord) return false;
      const lat = parseFloat(record[mapConfig.latField]);
      const lng = parseFloat(record[mapConfig.lngField]);
      const dist = haversineDistance(centerLat, centerLng, lat, lng);
      return dist <= RADIUS_KM;
    });
  }, [allValidPoints, searchedRecord, mapConfig]);

  const filteredNearby = useMemo(() => {
    if (!searchTerm.trim()) return nearbyRecords;
    const lower = searchTerm.toLowerCase();
    return nearbyRecords.filter((record) =>
      columns.some((col) => {
        const val = record[col];
        return val && val.toString().toLowerCase().includes(lower);
      })
    );
  }, [nearbyRecords, searchTerm, columns]);

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
      if (radiusCircleRef.current) {
        radiusCircleRef.current = null;
      }

      const defaultCenter: [number, number] = mapConfig.defaultCenter || [51.505, -0.09];
      const defaultZoom = mapConfig.defaultZoom || 12;

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

      if (searchedRecord) {
        const sLat = parseFloat(searchedRecord[mapConfig.latField]);
        const sLng = parseFloat(searchedRecord[mapConfig.lngField]);

        const circle = L.circle([sLat, sLng], {
          radius: RADIUS_KM * 1000,
          color: '#4F63A4',
          fillColor: '#4F63A4',
          fillOpacity: 0.06,
          weight: 1.5,
          dashArray: '6, 4',
        }).addTo(map);
        radiusCircleRef.current = circle;

        const searchedMarker = L.marker([sLat, sLng], { icon: SEARCHED_ICON, zIndexOffset: 1000 }).addTo(map);
        const label = mapConfig.labelField ? searchedRecord[mapConfig.labelField] : "";
        let popupContent = `<div style="font-size:13px;"><strong style="color:#4F63A4;">Searched Record</strong>`;
        if (label) popupContent += `<br/><strong>${label}</strong>`;
        columns.slice(0, 6).forEach((col) => {
          const val = searchedRecord[col] ?? "";
          if (val) popupContent += `<br/><span style="color:#666;">${getDisplayName(col)}:</span> ${val}`;
        });
        popupContent += `</div>`;
        searchedMarker.bindPopup(popupContent);
        searchedMarker.on("click", () => {
          markers.forEach((m) => {
            const rd = (m as any)._recordData;
            if (rd === searchedRecord) {
              m.setIcon(SELECTED_ICON);
            } else {
              m.setIcon(NEARBY_ICON);
            }
          });
          searchedMarker.setIcon(SELECTED_ICON);
          handleSelectRecord(searchedRecord);
        });
        markers.push(searchedMarker);
        (searchedMarker as any)._recordData = searchedRecord;
        bounds.push([sLat, sLng]);
      }

      filteredNearby.forEach((record) => {
        const lat = parseFloat(record[mapConfig.latField]);
        const lng = parseFloat(record[mapConfig.lngField]);

        const marker = L.marker([lat, lng], { icon: NEARBY_ICON }).addTo(map);
        (marker as any)._recordData = record;

        const label = mapConfig.labelField ? record[mapConfig.labelField] : "";
        let popupContent = "";
        if (label) popupContent += `<strong>${label}</strong>`;
        const displayFields = mapConfig.popupFields && mapConfig.popupFields.length > 0
          ? mapConfig.popupFields
          : columns.slice(0, 5);
        popupContent += "<div style='margin-top:4px;font-size:12px;'>";
        displayFields.forEach((field) => {
          const displayName = getDisplayName(field);
          const val = record[field] ?? "";
          if (val) popupContent += `<div><b>${displayName}:</b> ${val}</div>`;
        });
        popupContent += "</div>";
        if (popupContent) marker.bindPopup(popupContent);

        marker.on("click", () => {
          markers.forEach((m) => {
            const rd = (m as any)._recordData;
            if (rd === searchedRecord) {
              m.setIcon(SEARCHED_ICON);
            } else {
              m.setIcon(NEARBY_ICON);
            }
          });
          marker.setIcon(SELECTED_ICON);
          handleSelectRecord(record);
        });

        markers.push(marker);
        bounds.push([lat, lng]);
      });

      markersRef.current = markers;

      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds as L.LatLngExpression[]), { padding: [50, 50] });
      }

      setTimeout(() => map.invalidateSize(), 100);
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      radiusCircleRef.current = null;
      markersRef.current = [];
    };
  }, [isOpen, searchedRecord, filteredNearby, mapConfig, handleSelectRecord, columns]);

  if (!mapConfig) return null;

  const totalNearby = nearbyRecords.length;
  const totalShown = filteredNearby.length + (searchedRecord ? 1 : 0);

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
                placeholder="Filter nearby records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md whitespace-nowrap">
              {searchedRecord && (
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4F63A4] inline-block" />
                  Searched
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-500 inline-block" />
                {totalNearby} nearby ({RADIUS_KM}km)
              </span>
            </div>
          </div>

          {!searchedRecord && initialFilters && initialFilters.length > 0 && (
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
              No exact match found for the search criteria. Showing all {allValidPoints.length} records from the data source. Select any record from the map.
            </div>
          )}

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
                  <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Selected: {getDisplayName(outputColumn)} = "{selectedValue}"
                  </span>
                  {selectedRecord === searchedRecord && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-[#4F63A4] text-white rounded-full">Searched Record</span>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedRecord(null);
                    setSelectedValue("");
                    markersRef.current.forEach((m) => {
                      const rd = (m as any)._recordData;
                      if (rd === searchedRecord) {
                        m.setIcon(SEARCHED_ICON);
                      } else {
                        m.setIcon(NEARBY_ICON);
                      }
                    });
                  }}
                  className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                {columns.slice(0, 8).map((col) => {
                  const val = selectedRecord[col];
                  if (!val) return null;
                  return (
                    <div key={col} className="text-xs">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">{getDisplayName(col)}:</span>{" "}
                      <span className="text-blue-800 dark:text-blue-200">{val}</span>
                    </div>
                  );
                })}
              </div>
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
