<script>
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  // dots for rounded areas (about 10 km); bigger dot = more trips. Blue = from home, orange = from somewhere else.
  let { points = [] } = $props();
  let el, map;
  $effect(() => {
    if (!el) return;
    if (!map) {
      map = L.map(el, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap' }).addTo(map);
    }
    map.eachLayer((l) => { if (!(l instanceof L.TileLayer)) map.removeLayer(l); });
    const pts = points.filter((p) => Number.isFinite(+p.lat) && Number.isFinite(+p.lng));
    pts.forEach((p) => L.circleMarker([+p.lat, +p.lng], { radius: 6 + Math.min(18, Math.sqrt(p.n) * 3), color: '#fff', weight: 2, fillColor: p.away ? '#e07a1f' : '#1f5fd1', fillOpacity: 0.75 })
      .bindTooltip(`${p.n} trip${p.n === 1 ? '' : 's'}${p.away ? ' (some away from home)' : ''}`).addTo(map));
    if (pts.length) map.fitBounds(L.latLngBounds(pts.map((p) => [+p.lat, +p.lng])), { padding: [30, 30], maxZoom: 10 });
    else map.setView([39.5, -98.35], 3);
  });
</script>
<div class="map" style="height:320px" bind:this={el}></div>
