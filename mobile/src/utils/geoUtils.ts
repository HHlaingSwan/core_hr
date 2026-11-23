import * as Location from "expo-location";

export interface OfficeLocation {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

// 4 Official Corporate Offices for Geofencing
// Authoritative calculation and geofence is validated by backend on port 5432 / 5050.
export const CORPORATE_OFFICES: OfficeLocation[] = [
  {
    name: "Yangon HQ - M Tower",
    latitude: 16.8236,
    longitude: 96.1309,
    radiusMeters: 300, // 300m perimeter
  },
  {
    name: "Mandalay Office - 73rd Street",
    latitude: 21.975,
    longitude: 96.0836,
    radiusMeters: 250, // 250m perimeter
  },
  {
    name: "Naypyitaw Call Center",
    latitude: 19.8355,
    longitude: 96.1965,
    radiusMeters: 300, // 300m perimeter
  },
  {
    name: "Operation & Development Office",
    latitude: 16.872,
    longitude: 96.1265,
    radiusMeters: 250, // 250m perimeter
  },
];

export const DEFAULT_OFFICE: OfficeLocation = CORPORATE_OFFICES[0];

export interface GeofenceResult {
  isInside: boolean;
  distanceMeters: number;
  formattedDistance: string;
  officeName: string;
}

/**
 * Calculates distance in meters between two geographical points using the Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Human-readable distance formatter
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Validates whether coordinates fall inside a specific office geofence
 */
export function checkGeofence(
  lat: number,
  lon: number,
  office: OfficeLocation = DEFAULT_OFFICE
): GeofenceResult {
  const distance = calculateDistanceMeters(
    lat,
    lon,
    office.latitude,
    office.longitude
  );

  return {
    isInside: distance <= office.radiusMeters,
    distanceMeters: distance,
    formattedDistance: formatDistance(distance),
    officeName: office.name,
  };
}

/**
 * Validates whether coordinates fall inside ANY of the corporate offices.
 * If inside, returns that office; if outside all, returns closest office and distance.
 */
export function checkMultiOfficeGeofence(
  lat: number,
  lon: number,
  offices: OfficeLocation[] = CORPORATE_OFFICES
): GeofenceResult {
  // Check if inside any registered office
  for (const office of offices) {
    const distance = calculateDistanceMeters(
      lat,
      lon,
      office.latitude,
      office.longitude
    );
    if (distance <= office.radiusMeters) {
      return {
        isInside: true,
        distanceMeters: distance,
        formattedDistance: formatDistance(distance),
        officeName: office.name,
      };
    }
  }

  // If outside all, find closest office
  let closestOffice = offices[0];
  let minDistance = calculateDistanceMeters(
    lat,
    lon,
    offices[0].latitude,
    offices[0].longitude
  );

  for (let i = 1; i < offices.length; i++) {
    const dist = calculateDistanceMeters(
      lat,
      lon,
      offices[i].latitude,
      offices[i].longitude
    );
    if (dist < minDistance) {
      minDistance = dist;
      closestOffice = offices[i];
    }
  }

  return {
    isInside: false,
    distanceMeters: minDistance,
    formattedDistance: formatDistance(minDistance),
    officeName: closestOffice.name,
  };
}

export interface LocationPunchResult {
  permissionStatus: "granted" | "denied" | "undetermined" | "error";
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  } | null;
  geofence: GeofenceResult | null;
  locationLabel: string;
  verificationStatus: "verified" | "remote" | "unverified";
  error?: string;
}

/**
 * Requests native permission and acquires location, checking against all 2 offices
 */
export async function acquirePunchLocation(
  offices: OfficeLocation[] = CORPORATE_OFFICES
): Promise<LocationPunchResult> {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();

    if (status !== "granted") {
      const permissionResponse = await Location.requestForegroundPermissionsAsync();
      status = permissionResponse.status;
    }

    if (status !== "granted") {
      return {
        permissionStatus: "denied",
        coords: null,
        geofence: null,
        locationLabel: "Location Denied",
        verificationStatus: "unverified",
        error: "Location permission not granted",
      };
    }

    // High accuracy with fallback timeout
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Location request timed out")), 8000)
      ),
    ]);

    if (!location) {
      return {
        permissionStatus: "granted",
        coords: null,
        geofence: null,
        locationLabel: "GPS Timeout",
        verificationStatus: "unverified",
        error: "Could not obtain GPS fix",
      };
    }

    const { latitude, longitude, accuracy } = location.coords;
    const geofence = checkMultiOfficeGeofence(latitude, longitude, offices);

    return {
      permissionStatus: "granted",
      coords: { latitude, longitude, accuracy },
      geofence,
      locationLabel: geofence.isInside
        ? geofence.officeName
        : `Off-Site (${geofence.formattedDistance})`,
      verificationStatus: geofence.isInside ? "verified" : "remote",
    };
  } catch (err: any) {
    return {
      permissionStatus: "error",
      coords: null,
      geofence: null,
      locationLabel: "Location Unavailable",
      verificationStatus: "unverified",
      error: err?.message || "Unknown location error",
    };
  }
}
