import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import L from "leaflet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, X, Target, Loader2 } from "lucide-react";
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

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeAddress(city: string, street?: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `${city}|${street || ''}`.toLowerCase().trim();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) || null;

  try {
    const params = new URLSearchParams({ format: 'json', limit: '1' });
    if (street) {
      params.set('street', street);
      params.set('city', city);
    } else {
      params.set('q', city);
    }

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const results = await response.json();
    if (results && results.length > 0) {
      const coords = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
      geocodeCache.set(cacheKey, coords);
      return coords;
    }

    if (street) {
      const fallback = await geocodeAddress(city);
      geocodeCache.set(cacheKey, fallback);
      return fallback;
    }

    geocodeCache.set(cacheKey, null);
    return null;
  } catch {
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState(0);
  const [geocodingTotal, setGeocodingTotal] = useState(0);
  const [geocodingLabel, setGeocodingLabel] = useState("");
  const [geocodedPoints, setGeocodedPoints] = useState<Map<number, { lat: number; lng: number }>>(new Map());
  const [mapReady, setMapReady] = useState(false);
  const geocodingAbortRef = useRef(false);
  const finalPointsRef = useRef<Map<number, { lat: number; lng: number }>>(new Map());

  const safeData = Array.isArray(datasourceData) ? datasourceData : [];
  const columns = useMemo(() => {
    if (safeData.length === 0) return [];
    return Object.keys(safeData[0]);
  }, [safeData]);

  const getDisplayName = (col: string) => columnMappings[col] || col;

  const hasNativeLatLng = useMemo(() => {
    if (!mapConfig || safeData.length === 0) return false;
    const sample = safeData[0];
    const lat = parseFloat(sample[mapConfig.latField]);
    const lng = parseFloat(sample[mapConfig.lngField]);
    return !isNaN(lat) && !isNaN(lng);
  }, [safeData, mapConfig]);

  const addressColumns = useMemo(() => {
    if (!initialFilters || initialFilters.length === 0) return null;
    return {
      cityColumn: initialFilters[0]?.column,
      streetColumn: initialFilters.length > 1 ? initialFilters[1]?.column : undefined,
    };
  }, [initialFilters]);

  const resolvedInputValues = useMemo(() => {
    if (!initialFilters || !currentInputValues) return currentInputValues || {};

    const resolved = { ...currentInputValues };

    for (const filter of initialFilters) {
      if (filter.inputField && resolved[filter.inputField]) continue;

      const colDisplayName = columnMappings[filter.column] || filter.column;
      const colLower = colDisplayName.toLowerCase();

      for (const [key, val] of Object.entries(currentInputValues)) {
        if (!val) continue;
        const keyLower = key.toLowerCase();
        const parts = key.split('.');
        const fieldName = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : keyLower;

        if (fieldName === colLower || keyLower.endsWith(`.${colLower}`)) {
          if (!filter.inputField) {
            filter.inputField = key;
          }
          break;
        }
      }
    }

    return resolved;
  }, [initialFilters, currentInputValues, columnMappings]);

  const allValidPoints = useMemo(() => {
    if (!mapConfig) return [];
    if (hasNativeLatLng) {
      return safeData.filter((record) => {
        const lat = parseFloat(record[mapConfig.latField]);
        const lng = parseFloat(record[mapConfig.lngField]);
        return !isNaN(lat) && !isNaN(lng);
      });
    }
    return safeData.filter((_, idx) => geocodedPoints.has(idx));
  }, [safeData, mapConfig, hasNativeLatLng, geocodedPoints]);

  const getRecordCoords = useCallback((record: any, recordIdx?: number): { lat: number; lng: number } | null => {
    if (hasNativeLatLng && mapConfig) {
      const lat = parseFloat(record[mapConfig.latField]);
      const lng = parseFloat(record[mapConfig.lngField]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
    if (recordIdx !== undefined && geocodedPoints.has(recordIdx)) {
      return geocodedPoints.get(recordIdx)!;
    }
    const idx = safeData.indexOf(record);
    if (idx >= 0 && geocodedPoints.has(idx)) {
      return geocodedPoints.get(idx)!;
    }
    return null;
  }, [hasNativeLatLng, mapConfig, geocodedPoints, safeData]);

  const searchedRecord = useMemo(() => {
    if (!initialFilters || initialFilters.length === 0 || !resolvedInputValues) return null;

    let bestMatch: any = null;
    let bestScore = 0;

    const searchPool = hasNativeLatLng ? allValidPoints : safeData;

    for (const record of searchPool) {
      let matchCount = 0;
      for (const filter of initialFilters) {
        const recordVal = record[filter.column];
        const searchVal = resolvedInputValues[filter.inputField] || "";
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
  }, [hasNativeLatLng ? allValidPoints : safeData, initialFilters, resolvedInputValues]);

  useEffect(() => {
    if (!isOpen || hasNativeLatLng || !addressColumns || safeData.length === 0) return;

    geocodingAbortRef.current = false;
    finalPointsRef.current = new Map();

    const doGeocode = async () => {
      setIsGeocoding(true);
      setMapReady(false);
      const newCoords = new Map<number, { lat: number; lng: number }>();

      if (searchedRecord) {
        const idx = safeData.indexOf(searchedRecord);
        const city = searchedRecord[addressColumns.cityColumn] || "";
        const street = addressColumns.streetColumn ? searchedRecord[addressColumns.streetColumn] || "" : "";
        setGeocodingLabel("Locating searched record...");
        setGeocodingProgress(0);
        setGeocodingTotal(1);

        const coords = await geocodeAddress(city, street || undefined);
        if (coords && idx >= 0) {
          newCoords.set(idx, coords);
        }

        if (geocodingAbortRef.current) { setIsGeocoding(false); return; }

        const sameCityRecords: { idx: number; record: any }[] = [];
        const searchedCity = city.toLowerCase().trim();
        for (let i = 0; i < safeData.length; i++) {
          if (i === idx) continue;
          const recCity = (safeData[i][addressColumns.cityColumn] || "").toString().toLowerCase().trim();
          if (recCity === searchedCity) {
            sameCityRecords.push({ idx: i, record: safeData[i] });
          }
        }

        const uniqueAddresses = new Map<string, number[]>();
        for (const { idx: rIdx, record } of sameCityRecords) {
          const street2 = addressColumns.streetColumn ? (record[addressColumns.streetColumn] || "").toString().toLowerCase().trim() : "";
          const key = `${searchedCity}|${street2}`;
          if (!uniqueAddresses.has(key)) {
            uniqueAddresses.set(key, []);
          }
          uniqueAddresses.get(key)!.push(rIdx);
        }

        const MAX_GEOCODE = 30;
        const totalToGeocode = Math.min(uniqueAddresses.size, MAX_GEOCODE);
        setGeocodingLabel("Locating nearby records...");
        setGeocodingTotal(totalToGeocode);
        setGeocodingProgress(0);

        let geocoded = 0;
        const addressEntries = Array.from(uniqueAddresses.entries());
        for (const [addressKey, indices] of addressEntries) {
          if (geocodingAbortRef.current || geocoded >= MAX_GEOCODE) break;

          const [, streetPart] = addressKey.split('|');
          await delay(1100);
          const addrCoords = await geocodeAddress(searchedCity, streetPart || undefined);

          if (addrCoords) {
            for (const rIdx of indices) {
              const jitter = (Math.random() - 0.5) * 0.0002;
              newCoords.set(rIdx, { lat: addrCoords.lat + jitter, lng: addrCoords.lng + jitter });
            }
          }

          geocoded++;
          setGeocodingProgress(geocoded);
        }
      } else {
        const searchCity = resolvedInputValues ? Object.values(resolvedInputValues).find(v => v) : null;

        if (searchCity && addressColumns.cityColumn) {
          setGeocodingLabel("Searching for matching records...");

          const matchingRecords: { idx: number; record: any }[] = [];
          const cityLower = searchCity.toString().toLowerCase().trim();
          for (let i = 0; i < safeData.length; i++) {
            const recCity = (safeData[i][addressColumns.cityColumn] || "").toString().toLowerCase().trim();
            if (recCity.includes(cityLower) || cityLower.includes(recCity)) {
              matchingRecords.push({ idx: i, record: safeData[i] });
            }
          }

          const MAX_GEOCODE = 25;
          const uniqueAddresses = new Map<string, number[]>();
          for (const { idx: rIdx, record } of matchingRecords) {
            const recCity = (record[addressColumns.cityColumn] || "").toString().toLowerCase().trim();
            const street = addressColumns.streetColumn ? (record[addressColumns.streetColumn] || "").toString().toLowerCase().trim() : "";
            const key = `${recCity}|${street}`;
            if (!uniqueAddresses.has(key)) uniqueAddresses.set(key, []);
            uniqueAddresses.get(key)!.push(rIdx);
          }

          const totalToGeocode = Math.min(uniqueAddresses.size, MAX_GEOCODE);
          setGeocodingLabel("Locating records...");
          setGeocodingTotal(totalToGeocode);
          setGeocodingProgress(0);

          let geocoded = 0;
          const addrEntries2 = Array.from(uniqueAddresses.entries());
          for (const [addressKey, indices] of addrEntries2) {
            if (geocodingAbortRef.current || geocoded >= MAX_GEOCODE) break;

            const [cityPart, streetPart] = addressKey.split('|');
            if (geocoded > 0) await delay(1100);
            const addrCoords = await geocodeAddress(cityPart, streetPart || undefined);

            if (addrCoords) {
              for (const rIdx of indices) {
                const jitter = (Math.random() - 0.5) * 0.0002;
                newCoords.set(rIdx, { lat: addrCoords.lat + jitter, lng: addrCoords.lng + jitter });
              }
            }

            geocoded++;
            setGeocodingProgress(geocoded);
          }
        }
      }

      finalPointsRef.current = newCoords;
      setGeocodedPoints(new Map(newCoords));
      setIsGeocoding(false);
      setGeocodingLabel("");
    };

    doGeocode();

    return () => {
      geocodingAbortRef.current = true;
    };
  }, [isOpen, hasNativeLatLng, addressColumns, searchedRecord, safeData]);

  const nearbyRecords = useMemo(() => {
    if (!searchedRecord) return allValidPoints;

    const centerCoords = getRecordCoords(searchedRecord);
    if (!centerCoords) return allValidPoints;

    return allValidPoints.filter((record) => {
      if (record === searchedRecord) return false;
      const coords = getRecordCoords(record);
      if (!coords) return false;
      const dist = haversineDistance(centerCoords.lat, centerCoords.lng, coords.lat, coords.lng);
      return dist <= RADIUS_KM;
    });
  }, [allValidPoints, searchedRecord, getRecordCoords]);

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
      setGeocodedPoints(new Map());
      setMapReady(false);
      return;
    }
  }, [isOpen]);

  const shouldShowMap = hasNativeLatLng || (!isGeocoding && geocodedPoints.size > 0);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || !mapConfig || !shouldShowMap) return;

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (radiusCircleRef.current) {
        radiusCircleRef.current = null;
      }

      const defaultCenter: [number, number] = mapConfig.defaultCenter || [51.1657, 10.4515];
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

      if (searchedRecord) {
        const coords = getRecordCoords(searchedRecord);
        if (coords) {
          const circle = L.circle([coords.lat, coords.lng], {
            radius: RADIUS_KM * 1000,
            color: '#4F63A4',
            fillColor: '#4F63A4',
            fillOpacity: 0.06,
            weight: 1.5,
            dashArray: '6, 4',
          }).addTo(map);
          radiusCircleRef.current = circle;

          const searchedMarker = L.marker([coords.lat, coords.lng], { icon: SEARCHED_ICON, zIndexOffset: 1000 }).addTo(map);
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
          bounds.push([coords.lat, coords.lng]);
        }
      }

      filteredNearby.forEach((record) => {
        const coords = getRecordCoords(record);
        if (!coords) return;

        const marker = L.marker([coords.lat, coords.lng], { icon: NEARBY_ICON }).addTo(map);
        (marker as any)._recordData = record;

        const label = mapConfig.labelField ? record[mapConfig.labelField] : "";
        let popupContent = "";
        if (label) popupContent += `<strong>${label}</strong>`;
        const displayFields = mapConfig.popupFields && mapConfig.popupFields.length > 0
          ? mapConfig.popupFields
          : columns.slice(0, 5);
        popupContent += "<div style='margin-top:4px;font-size:12px;'>";
        displayFields.forEach((field: string) => {
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
        bounds.push([coords.lat, coords.lng]);
      });

      markersRef.current = markers;

      if (bounds.length > 0) {
        map.fitBounds(L.latLngBounds(bounds as L.LatLngExpression[]), { padding: [50, 50] });
      }

      setTimeout(() => {
        map.invalidateSize();
        setMapReady(true);
      }, 200);
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
  }, [isOpen, searchedRecord, filteredNearby, mapConfig, handleSelectRecord, columns, getRecordCoords, shouldShowMap]);

  if (!mapConfig) return null;

  const totalNearby = nearbyRecords.length;
  const progressPercent = geocodingTotal > 0 ? Math.round((geocodingProgress / geocodingTotal) * 100) : 0;

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
          {!isGeocoding && mapReady && (
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
          )}

          <div className="flex-1 relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div
              ref={mapContainerRef}
              className="absolute inset-0 transition-opacity duration-500"
              style={{ opacity: mapReady && !isGeocoding ? 1 : 0, zIndex: 1 }}
            />

            {(isGeocoding || !mapReady) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center gap-4 w-full max-w-md">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-gray-700" />
                    <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-[#4F63A4] animate-spin" />
                    <MapPin className="absolute inset-0 m-auto h-6 w-6 text-[#4F63A4]" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {geocodingLabel || "Preparing map..."}
                    </p>
                    {geocodingTotal > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {geocodingProgress} of {geocodingTotal} locations found
                      </p>
                    )}
                  </div>
                  <div className="w-full space-y-2 px-8">
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#4F63A4] rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${isGeocoding ? progressPercent : 95}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedRecord && !isGeocoding && mapReady && (
            <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200 truncate">
                    Selected: {getDisplayName(outputColumn)} = "{selectedValue || "(no value)"}"
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Input
                    value={selectedValue}
                    onChange={(e) => setSelectedValue(e.target.value)}
                    className="h-8 w-48 text-sm"
                    placeholder="Value to use..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
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
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1">
                {columns.filter(col => col !== outputColumn).map((col) => {
                  const val = selectedRecord[col];
                  if (val === null || val === undefined || val === '') return null;
                  return (
                    <div key={col} className="text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{getDisplayName(col)}:</span>{' '}
                      {val.toString().length > 50 ? val.toString().substring(0, 50) + '...' : val.toString()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
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
