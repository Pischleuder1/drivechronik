// src/routing/providers/ors.js
export function createOrsProvider({ apiKey, baseUrl, fetchImpl = fetch }) {
  async function call(url, opts) {
    const res = await fetchImpl(url, opts);
    if (!res.ok) throw new Error(`ORS request failed: ${res.status}`);
    return res.json();
  }
  const jsonPost = (body) => ({
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return {
    async geocode(address) {
      const url = `${baseUrl}/geocode/search?api_key=${encodeURIComponent(apiKey)}&size=1&text=${encodeURIComponent(address)}`;
      const data = await call(url);
      const f = data.features?.[0];
      if (!f) return null;
      const [lon, lat] = f.geometry.coordinates;
      return { lat, lon, label: f.properties?.label ?? address };
    },
    async matrix(origin, destinations) {
      const locations = [[origin.lon, origin.lat], ...destinations.map((d) => [d.lon, d.lat])];
      const body = {
        locations,
        sources: [0],
        destinations: destinations.map((_, i) => i + 1),
        metrics: ['distance', 'duration'],
      };
      const data = await call(`${baseUrl}/v2/matrix/driving-car`, jsonPost(body));
      const distances = data.distances[0];
      const durations = data.durations[0];
      return distances.map((dist, i) => ({
        distanceMeters: dist,
        durationSeconds: durations[i],
      }));
    },
    async route(origin, destination) {
      const body = { coordinates: [[origin.lon, origin.lat], [destination.lon, destination.lat]] };
      const data = await call(`${baseUrl}/v2/directions/driving-car/geojson`, jsonPost(body));
      const f = data.features[0];
      return {
        geometry: f.geometry,
        distanceMeters: f.properties.summary.distance,
        durationSeconds: f.properties.summary.duration,
      };
    },
  };
}
