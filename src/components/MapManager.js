import L from 'leaflet';
import opBoundaryGeoJson from '../data/overlandParkBoundary.json';
import { OVERLAND_PARK_CENTER } from '../data/overlandParkData';

/**
 * MapManager - Leaflet Interactive Map for Overland Park, KS
 */
export class MapManager {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.onMapClickToAdd = options.onMapClickToAdd || null;
    this.onStopClick = options.onStopClick || null;
    this.isClickToAddActive = false;

    this.map = null;
    this.tileLayers = {};
    this.currentTileLayer = null;
    this.boundaryLayer = null;
    this.routePolyline = null;
    this.routeGlowLine = null;
    this.storeMarker = null;
    this.stopMarkers = [];
    this.truckMarker = null;

    this.initMap();
  }

  initMap() {
    // Center in Overland Park, KS
    this.map = L.map(this.containerId, {
      center: OVERLAND_PARK_CENTER,
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    // Custom positioned Zoom Control
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // High-resolution Tile Layers (100% free, no watermarks)
    this.tileLayers.light = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS'
    });

    this.tileLayers.dark = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Esri, HERE, Garmin, FAO, NOAA, USGS'
    });

    this.tileLayers.osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    });

    // Default to dark or theme preference
    const isDarkTheme = document.documentElement.getAttribute('data-theme') !== 'light';
    this.setTheme(isDarkTheme ? 'dark' : 'light');

    // Add Overland Park City Boundary Layer
    this.addCityBoundary();

    // Setup Map Click Listener
    this.map.on('click', (e) => {
      if (this.isClickToAddActive && this.onMapClickToAdd) {
        this.onMapClickToAdd(e.latlng.lat, e.latlng.lng);
      }
    });
  }

  setTheme(theme) {
    if (this.currentTileLayer) {
      this.map.removeLayer(this.currentTileLayer);
    }
    this.currentTileLayer = theme === 'dark' ? this.tileLayers.dark : this.tileLayers.light;
    this.currentTileLayer.addTo(this.map);

    if (this.boundaryLayer) {
      this.boundaryLayer.setStyle({
        color: theme === 'dark' ? '#10b981' : '#059669',
        fillColor: theme === 'dark' ? '#10b981' : '#10b981',
        opacity: theme === 'dark' ? 0.6 : 0.75,
        fillOpacity: theme === 'dark' ? 0.04 : 0.03
      });
    }
  }

  addCityBoundary() {
    if (!opBoundaryGeoJson) return;

    this.boundaryLayer = L.geoJSON(opBoundaryGeoJson, {
      style: {
        color: '#10b981',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#10b981',
        fillOpacity: 0.04,
        opacity: 0.7
      }
    }).addTo(this.map);
  }

  setClickToAddMode(active) {
    this.isClickToAddActive = active;
    const container = document.getElementById(this.containerId);
    if (active) {
      container.classList.add('cursor-crosshair');
    } else {
      container.classList.remove('cursor-crosshair');
    }
  }

  renderStoreMarker(store) {
    if (this.storeMarker) {
      this.map.removeLayer(this.storeMarker);
      this.storeMarker = null;
    }

    if (!store) return;

    const iconHtml = `
      <div class="store-pin-container">
        <div class="store-pin-pulse"></div>
        <div class="store-pin-badge">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
        <div class="store-pin-label">${store.name.split(' (')[0]}</div>
      </div>
    `;

    const icon = L.divIcon({
      html: iconHtml,
      className: 'store-custom-div-icon',
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    });

    this.storeMarker = L.marker([store.lat, store.lng], { icon, zIndexOffset: 900 })
      .addTo(this.map)
      .bindPopup(`
        <div class="custom-popup store-popup">
          <div class="popup-header">
            <span class="popup-tag store-tag">🏬 Distribution Hub</span>
            <h4 class="popup-title">${store.name}</h4>
          </div>
          <p class="popup-address">${store.address}</p>
          <div class="popup-desc">${store.description || 'Main grocery fulfillment depot'}</div>
        </div>
      `);
  }

  renderStopMarkers(stops) {
    // Clear existing stop markers
    this.stopMarkers.forEach(m => this.map.removeLayer(m));
    this.stopMarkers = [];

    stops.forEach((stop, index) => {
      const seqNum = stop.sequence || index + 1;
      const status = stop.status || 'pending';
      const isDelivered = status === 'delivered';
      const isInTransit = status === 'in-transit';

      const iconHtml = `
        <div class="stop-pin-container ${status} ${isDelivered ? 'is-delivered' : ''} ${isInTransit ? 'is-transit' : ''}" data-stop-id="${stop.id}">
          <div class="stop-pin-badge">
            ${isDelivered ? '✓' : seqNum}
          </div>
          <div class="stop-pin-info-pill">
            <span class="stop-bag-count">${stop.bags || 1} 🛍️</span>
            ${stop.isPerishable ? '<span class="stop-cold-icon">❄️</span>' : ''}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'stop-custom-div-icon',
        iconSize: [36, 42],
        iconAnchor: [18, 40],
        popupAnchor: [0, -38]
      });

      const marker = L.marker([stop.lat, stop.lng], { icon, zIndexOffset: 500 + seqNum })
        .addTo(this.map)
        .bindPopup(`
          <div class="custom-popup customer-popup">
            <div class="popup-header">
              <span class="popup-tag stop-tag">Stop #${seqNum} • ${isDelivered ? 'Delivered ✓' : 'Pending'}</span>
              <h4 class="popup-title">${stop.customerName}</h4>
            </div>
            <p class="popup-address">${stop.address}</p>
            <div class="popup-order-details">
              <div class="popup-stat-row">
                <span>📦 Packages:</span> <strong>${stop.bags} Grocery Bags</strong>
              </div>
              ${stop.phone ? `<div class="popup-stat-row"><span>📞 Phone:</span> <strong>${stop.phone}</strong></div>` : ''}
              ${stop.items && stop.items.length > 0 ? `
                <div class="popup-items-list">
                  <div class="popup-items-title">Grocery Items:</div>
                  <ul>${stop.items.map(it => `<li>${it}</li>`).join('')}</ul>
                </div>
              ` : ''}
              ${stop.notes ? `
                <div class="popup-note-box">
                  <strong>Notes:</strong> ${stop.notes}
                </div>
              ` : ''}
            </div>
          </div>
        `);

      marker.stopData = stop;
      this.stopMarkers.push(marker);
    });
  }

  updateStopStatus(stopId, status) {
    const marker = this.stopMarkers.find(m => m.stopData && m.stopData.id === stopId);
    if (marker) {
      marker.stopData.status = status;
      const el = marker.getElement();
      if (el) {
        const pinContainer = el.querySelector('.stop-pin-container');
        if (pinContainer) {
          pinContainer.classList.remove('pending', 'in-transit', 'delivered', 'is-delivered', 'is-transit');
          pinContainer.classList.add(status);
          if (status === 'delivered') {
            pinContainer.classList.add('is-delivered');
            const badge = pinContainer.querySelector('.stop-pin-badge');
            if (badge) badge.textContent = '✓';
          }
        }
      }
    }
  }

  renderRoutePolyline(coordinates) {
    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }
    if (this.routeGlowLine) {
      this.map.removeLayer(this.routeGlowLine);
      this.routeGlowLine = null;
    }

    if (!coordinates || coordinates.length < 2) return;

    // Convert coordinates from [lng, lat] to Leaflet [lat, lng]
    const latLngs = coordinates.map(c => [c[1], c[0]]);

    // Outer glow polyline
    this.routeGlowLine = L.polyline(latLngs, {
      color: '#10b981',
      weight: 9,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    // Core vibrant route polyline
    this.routePolyline = L.polyline(latLngs, {
      color: '#059669',
      weight: 4.5,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: null
    }).addTo(this.map);
  }

  renderTruckMarker(lat, lng, heading = 0, tooltipText = 'Delivery Van') {
    if (!this.truckMarker) {
      const truckHtml = `
        <div class="truck-marker-wrap" style="transform: rotate(${heading}deg);">
          <div class="truck-headlights"></div>
          <div class="truck-icon-body">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <!-- Grocery Van Body -->
              <rect x="1" y="5" width="15" height="13" rx="2" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
              <path d="M16 8h4.5l2.5 4.5V18h-7V8z" fill="#047857" stroke="#ffffff" stroke-width="1.5"/>
              <!-- Van Wheels -->
              <circle cx="6" cy="18" r="2.5" fill="#1e293b" stroke="#ffffff" stroke-width="1.2"/>
              <circle cx="18" cy="18" r="2.5" fill="#1e293b" stroke="#ffffff" stroke-width="1.2"/>
              <!-- Fresh Delivery Leaf Logo on Side -->
              <path d="M7 10c0-1.5 2-2.5 3-2.5 0 1.5-1 2.5-3 2.5z" fill="#a7f3d0"/>
            </svg>
          </div>
        </div>
      `;

      const icon = L.divIcon({
        html: truckHtml,
        className: 'truck-custom-div-icon',
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      this.truckMarker = L.marker([lat, lng], { icon, zIndexOffset: 1200 }).addTo(this.map);
      this.truckMarker.bindTooltip(tooltipText, {
        permanent: false,
        direction: 'top',
        className: 'truck-tooltip'
      });
    } else {
      this.truckMarker.setLatLng([lat, lng]);
      const el = this.truckMarker.getElement();
      if (el) {
        const wrap = el.querySelector('.truck-marker-wrap');
        if (wrap) {
          wrap.style.transform = `rotate(${heading}deg)`;
        }
      }
      this.truckMarker.setTooltipContent(tooltipText);
    }
  }

  removeTruckMarker() {
    if (this.truckMarker) {
      this.map.removeLayer(this.truckMarker);
      this.truckMarker = null;
    }
  }

  fitRouteBounds(store, stops) {
    const points = [];
    if (store) points.push([store.lat, store.lng]);
    if (stops && stops.length > 0) {
      stops.forEach(s => points.push([s.lat, s.lng]));
    }

    if (points.length === 1) {
      this.map.setView(points[0], 13);
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      this.map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 15,
        animate: true,
        duration: 0.8
      });
    }
  }

  highlightStop(stopId) {
    const marker = this.stopMarkers.find(m => m.stopData && m.stopData.id === stopId);
    if (marker) {
      marker.openPopup();
      this.map.panTo(marker.getLatLng(), { animate: true, duration: 0.5 });
    }
  }

  recenterOverlandPark() {
    this.map.setView(OVERLAND_PARK_CENTER, 12, { animate: true });
  }
}
