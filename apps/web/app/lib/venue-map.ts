export type MapCoordinates = { latitude: number; longitude: number };

function validMapCoordinates(latitude: number, longitude: number): MapCoordinates | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function findCoordinatePair(value: string | null | undefined): MapCoordinates | null {
  if (!value) return null;
  const pair = value.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!pair) return null;
  return validMapCoordinates(Number(pair[1]), Number(pair[2]));
}

/** Extracts visible point coordinates from full Google Maps or OpenStreetMap share URLs. */
export function extractMapCoordinates(url: string): MapCoordinates | null {
  const visiblePoint = url.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (visiblePoint) {
    const point = validMapCoordinates(Number(visiblePoint[1]), Number(visiblePoint[2]));
    if (point) return point;
  }

  const placePoint = url.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/);
  if (placePoint) {
    const point = validMapCoordinates(Number(placePoint[1]), Number(placePoint[2]));
    if (point) return point;
  }

  try {
    const parsed = new URL(url);
    const queryPoint = findCoordinatePair(parsed.searchParams.get("query"))
      ?? findCoordinatePair(parsed.searchParams.get("q"))
      ?? findCoordinatePair(parsed.searchParams.get("ll"))
      ?? findCoordinatePair(parsed.searchParams.get("center"))
      ?? findCoordinatePair(parsed.searchParams.get("destination"));
    if (queryPoint) return queryPoint;
  } catch {
    return null;
  }

  const openStreetMapPoint = url.match(/#map=\d+\/(-?\d{1,2}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)/);
  return openStreetMapPoint
    ? validMapCoordinates(Number(openStreetMapPoint[1]), Number(openStreetMapPoint[2]))
    : null;
}

export function mapProviderLabel(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("google")) return "Google Maps";
    if (host.includes("apple")) return "Apple Maps";
    if (host.includes("openstreetmap.org")) return "OpenStreetMap";
  } catch {
    return "serviço de mapas";
  }
  return "serviço de mapas";
}

export function openStreetMapEmbedUrl(latitude: number, longitude: number): string {
  const latitudeSpan = 0.006;
  const longitudeSpan = 0.009;
  const params = new URLSearchParams({
    bbox: `${longitude - longitudeSpan},${latitude - latitudeSpan},${longitude + longitudeSpan},${latitude + latitudeSpan}`,
    layer: "mapnik",
    marker: `${latitude},${longitude}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}

export function openStreetMapUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}
