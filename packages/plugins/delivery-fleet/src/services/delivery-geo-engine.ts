/**
 * @marketos/plugin-delivery-fleet
 * Delivery Geolocation & Proximity Engine
 *
 * Implements high-precision Haversine metric calculations, metropolitan sector mapping,
 * and delivery sanity boundaries for retail dispatch.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MetropolitanSector {
  id: string;
  name: string;
  detail: string;
  icon: string;
  coords: Coordinates;
  radiusKm?: number;
}

/**
 * Standard metropolitan perimeter boundary in km.
 * Distances exceeding this threshold indicate device is outside the local city coverage
 * (e.g. mobile IP routing through national transit gateways or overseas orders).
 */
export const METROPOLITAN_PERIMETER_MAX_KM = 35;

/**
 * Verified coordinates for Barquisimeto & Cabudare stores (fallback if not in DB row)
 */
export const STORE_DEFAULT_COORDINATES: Record<string, Coordinates> = {
  "NS-01": { lat: 10.054, lng: -69.298 }, // Calle 3 entre Carreras 1 y 2, Nueva Segovia, Barquisimeto
  "CBD-01": { lat: 10.029, lng: -69.261 }, // Cabudare Intercomunal
  "EST-01": { lat: 10.062, lng: -69.285 }, // Los Leones / Av. Lara
};

/**
 * Pre-defined metropolitan sectors for 1-touch zone selection without GPS latency
 */
export const BARQUISIMETO_METROPOLITAN_SECTORS: MetropolitanSector[] = [
  {
    id: "norte",
    name: "Zona Norte",
    detail: "El Cují / Tamaca / Carorita",
    icon: "🧭",
    coords: { lat: 10.140, lng: -69.312 }, // ~9.7 km de Sucursal Nueva Segovia
    radiusKm: 7,
  },
  {
    id: "este",
    name: "Este / Nueva Segovia",
    detail: "Nueva Segovia / Los Leones / Lara",
    icon: "🏢",
    coords: { lat: 10.058, lng: -69.295 }, // ~0.6 km de Sucursal Nueva Segovia
    radiusKm: 4,
  },
  {
    id: "centro",
    name: "Centro",
    detail: "Carrera 19 / Av. Vargas / 20",
    icon: "🏙️",
    coords: { lat: 10.068, lng: -69.317 }, // ~2.6 km de Sucursal Nueva Segovia
    radiusKm: 4,
  },
  {
    id: "oeste",
    name: "Oeste",
    detail: "Obelisco / Pedro León Torres",
    icon: "🌳",
    coords: { lat: 10.066, lng: -69.355 }, // ~6.4 km de Sucursal Nueva Segovia
    radiusKm: 5,
  },
  {
    id: "cabudare",
    name: "Cabudare",
    detail: "Valle Hondo / La Mora / Intercomunal",
    icon: "🛵",
    coords: { lat: 10.030, lng: -69.260 }, // ~5.0 km de Sucursal Nueva Segovia
    radiusKm: 6,
  },
];

/**
 * High-precision Haversine formula to compute great-circle distance between two GPS coordinates in km
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth mean radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Extracts valid latitude and longitude from a store entity or fallback store code
 */
export function resolveStoreCoordinates(store: {
  code?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
}): Coordinates | null {
  if (store.latitude && store.longitude) {
    const lat = Number(store.latitude);
    const lng = Number(store.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return { lat, lng };
    }
  }

  if (store.code && STORE_DEFAULT_COORDINATES[store.code]) {
    return STORE_DEFAULT_COORDINATES[store.code];
  }

  return null;
}

export interface StoreProximityResult<T> {
  nearestStore: T | null;
  minDistanceKm: number;
  allDistances: Record<string, number>;
  isWithinMetroPerimeter: boolean;
  proximityBadge: string;
}

/**
 * Evaluates distances from a customer's location to all active stores.
 * Enforces the 35km sanity threshold to avoid alarming out-of-town badges.
 */
export function calculateStoreProximities<
  T extends { id: string; code?: string; name: string }
>(stores: T[], userLat: number, userLng: number): StoreProximityResult<T> {
  const allDistances: Record<string, number> = {};
  let nearestStore: T | null = null;
  let minDistanceKm = Infinity;

  for (const store of stores) {
    const coords = resolveStoreCoordinates(store as any);
    if (!coords) continue;

    const dist = calculateDistanceKm(userLat, userLng, coords.lat, coords.lng);
    allDistances[store.id] = dist;

    if (dist < minDistanceKm) {
      minDistanceKm = dist;
      nearestStore = store;
    }
  }

  const isWithinMetroPerimeter = minDistanceKm <= METROPOLITAN_PERIMETER_MAX_KM;
  const proximityBadge = isWithinMetroPerimeter
    ? `📍 a ${minDistanceKm} km`
    : "📍 Despacho en Barquisimeto";

  return {
    nearestStore,
    minDistanceKm: minDistanceKm === Infinity ? 0 : minDistanceKm,
    allDistances,
    isWithinMetroPerimeter,
    proximityBadge,
  };
}

/**
 * Matches a coordinate pair to the closest Barquisimeto metropolitan sector
 */
export function matchNearestMetropolitanSector(
  userLat: number,
  userLng: number
): MetropolitanSector | null {
  let closestSector: MetropolitanSector | null = null;
  let minDistance = Infinity;

  for (const sector of BARQUISIMETO_METROPOLITAN_SECTORS) {
    const dist = calculateDistanceKm(
      userLat,
      userLng,
      sector.coords.lat,
      sector.coords.lng
    );
    if (dist < minDistance) {
      minDistance = dist;
      closestSector = sector;
    }
  }

  // If closest sector is within 15 km, return it as the active matched sector
  if (minDistance <= 15) {
    return closestSector;
  }

  return null;
}
