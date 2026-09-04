// public/app.js
const map = L.map('map').setView([50.5, 9.0], 5); // Europe
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors',
}).addTo(map);

// Distinct colours for the "show all routes" mode (index 0 = nearest).
const ROUTE_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22', '#16a085', '#d35400', '#2c3e50'];

let markers = [];
let routeLayers = [];
let current = { origin: null, results: [] };
let routeCache = {}; // by result id → { geometry, distanceMeters, durationSeconds }
let activeIndex = 0;

const fmtKm = (m) => (m / 1000).toFixed(1) + ' km';
const fmtMin = (s) => Math.round(s / 60) + ' min';
const setStatus = (t) => { document.getElementById('status').textContent = t; };

function clearRoutes() {
  routeLayers.forEach((l) => map.removeLayer(l));
  routeLayers = [];
}
function clearMap() {
  markers.forEach((m) => map.removeLayer(m));
  markers = [];
  clearRoutes();
}

// Fetch (and cache) the road route from the current origin to a destination.
async function fetchRoute(dest) {
  if (routeCache[dest.id]) return routeCache[dest.id];
  const params = new URLSearchParams({
    fromLat: current.origin.lat, fromLon: current.origin.lon, toLat: dest.lat, toLon: dest.lon,
  });
  const res = await fetch('/api/route?' + params.toString());
  if (!res.ok) throw new Error('route failed');
  const route = await res.json();
  routeCache[dest.id] = route;
  return route;
}

function drawRoute(geometry, color, weight) {
  const layer = L.geoJSON(geometry, { style: { color, weight, opacity: 0.85 } }).addTo(map);
  routeLayers.push(layer);
  return layer;
}

function highlightActive() {
  document.querySelectorAll('#results li').forEach((li, i) => {
    li.classList.toggle('active', i === activeIndex);
  });
}

// Draw a single route to the result at `index` (default behaviour + on click).
async function showSingleRoute(index) {
  activeIndex = index;
  highlightActive();
  clearRoutes();
  const dest = current.results[index];
  if (!dest) return;
  setStatus(`Route zu ${dest.name} wird geladen…`);
  try {
    const route = await fetchRoute(dest);
    const layer = drawRoute(route.geometry, '#c0392b', 5);
    map.fitBounds(layer.getBounds().pad(0.2));
    setStatus(`Route zu ${dest.name}: ${fmtKm(route.distanceMeters)} · ${fmtMin(route.durationSeconds)}`);
  } catch {
    setStatus('Route konnte nicht geladen werden.');
  }
}

// Draw every result's route at once, each in its own colour.
async function showAllRoutes() {
  highlightActive();
  clearRoutes();
  setStatus('Alle Routen werden geladen…');
  const settled = await Promise.allSettled(current.results.map(fetchRoute));
  const drawn = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') {
      drawn.push(drawRoute(s.value.geometry, ROUTE_COLORS[i % ROUTE_COLORS.length], i === 0 ? 5 : 3));
    }
  });
  if (drawn.length) map.fitBounds(L.featureGroup(drawn).getBounds().pad(0.2));
  setStatus(`${drawn.length} von ${current.results.length} Routen angezeigt.`);
}

function refreshRoutes() {
  if (document.getElementById('allRoutes').checked) return showAllRoutes();
  return showSingleRoute(activeIndex);
}

function renderResults(data) {
  const list = document.getElementById('results');
  list.innerHTML = '';
  clearMap();
  current = { origin: data.origin, results: data.results };
  routeCache = {};
  activeIndex = 0;

  // Seed the cache with the #1 route the search already returned (saves one call).
  if (data.route && data.route.geometry) {
    routeCache[data.route.toId] = {
      geometry: data.route.geometry,
      distanceMeters: data.route.distanceMeters,
      durationSeconds: data.route.durationSeconds,
    };
  }

  const origin = L.marker([data.origin.lat, data.origin.lon]).addTo(map).bindPopup('Start: ' + data.origin.label);
  markers.push(origin);

  data.results.forEach((r, i) => {
    const marker = L.marker([r.lat, r.lon]).addTo(map)
      .bindPopup(`<b>${r.name}</b><br>${fmtKm(r.distanceMeters)} · ${fmtMin(r.durationSeconds)}`);
    markers.push(marker);

    const li = document.createElement('li');
    const badge = r.status === 'coming_soon' ? '<span class="badge">bald</span>' : '';
    const allEvs = r.openToAllEvs ? '<span class="badge badge-ev">alle EVs</span>' : '';
    li.innerHTML =
      `<div class="name">${i + 1}. ${r.name}${badge}${allEvs}</div>` +
      `<div class="meta">${fmtKm(r.distanceMeters)} · ${fmtMin(r.durationSeconds)} · ${r.address}</div>`;
    li.addEventListener('click', () => {
      marker.openPopup();
      // In "all routes" mode a click just focuses that destination without wiping the others.
      if (document.getElementById('allRoutes').checked) {
        activeIndex = i;
        highlightActive();
        map.setView([r.lat, r.lon], 11);
      } else {
        showSingleRoute(i);
      }
    });
    list.appendChild(li);
  });

  document.getElementById('stale-banner').classList.toggle('hidden', !data.meta.stale);
  refreshRoutes();
}

async function search(e) {
  e.preventDefault();
  const params = new URLSearchParams({
    address: document.getElementById('address').value,
    limit: document.getElementById('limit').value,
    sort: document.getElementById('sort').value,
    comingSoon: document.getElementById('comingSoon').checked,
    openToAllEvs: document.getElementById('openToAllEvs').checked,
  });
  setStatus('Suche…');
  try {
    const res = await fetch('/api/nearest?' + params.toString());
    if (res.status === 422) { setStatus('Adresse nicht gefunden.'); return; }
    if (!res.ok) { setStatus('Dienst momentan nicht verfügbar. Bitte später erneut versuchen.'); return; }
    const data = await res.json();
    if (data.results.length === 0) { setStatus('Keine Supercharger gefunden.'); return; }
    renderResults(data);
  } catch {
    setStatus('Netzwerkfehler.');
  }
}

document.getElementById('search-form').addEventListener('submit', search);
// Toggling "show all routes" re-draws immediately using the cache (no new search needed).
document.getElementById('allRoutes').addEventListener('change', () => {
  if (current.results.length) refreshRoutes();
});
