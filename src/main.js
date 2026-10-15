import './style.css';
import { GROCERY_STORES, PRESET_SCENARIOS, OVERLAND_PARK_CENTER } from './data/overlandParkData.js';
import { calculateOptimizedRoute, generateGoogleMapsUrl } from './services/router.js';
import { searchAddress, reverseGeocode } from './services/geocoding.js';
import { MapManager } from './components/MapManager.js';
import { RouteSimulator } from './components/Simulator.js';
import { db } from './services/db.js';
import { CustomerPortal } from './components/CustomerPortal.js';
import { MerchantPortal } from './components/MerchantPortal.js';
import confetti from 'canvas-confetti';

// Application State
const state = {
  currentView: 'customer', // 'customer' | 'merchant' | 'driver'
  currentStore: GROCERY_STORES[0],
  stops: JSON.parse(JSON.stringify(PRESET_SCENARIOS[0].stops)),
  isRoundTrip: true,
  routeData: null,
  isClickToAddActive: false,
  pendingMapAddCoords: null
};

// UI Elements Map
const els = {
  // Views
  customerView: document.getElementById('customerView'),
  merchantView: document.getElementById('merchantView'),
  driverView: document.getElementById('driverView'),

  // Role Navigation
  navRoleCustomer: document.getElementById('navRoleCustomer'),
  navRoleMerchant: document.getElementById('navRoleMerchant'),
  navRoleDriver: document.getElementById('navRoleDriver'),
  merchantNavBadge: document.getElementById('merchantNavBadge'),
  driverNavBadge: document.getElementById('driverNavBadge'),

  // Ecosystem Bar
  ecosystemSyncBar: document.getElementById('ecosystemSyncBar'),
  ecosystemLiveMessage: document.getElementById('ecosystemLiveMessage'),
  chipStepCustomer: document.getElementById('chipStepCustomer'),
  chipStepMerchant: document.getElementById('chipStepMerchant'),
  chipStepDriver: document.getElementById('chipStepDriver'),

  // Tour & Reset
  openGuidedTourBtn: document.getElementById('openGuidedTourBtn'),
  resetDatabaseBtn: document.getElementById('resetDatabaseBtn'),
  guidedTourModal: document.getElementById('guidedTourModal'),
  closeTourModalBtn: document.getElementById('closeTourModalBtn'),
  dismissTourModalBtn: document.getElementById('dismissTourModalBtn'),
  tourGoCustomerBtn: document.getElementById('tourGoCustomerBtn'),
  tourGoMerchantBtn: document.getElementById('tourGoMerchantBtn'),
  tourGoDriverBtn: document.getElementById('tourGoDriverBtn'),
  btnRunAutomatedDemo: document.getElementById('btnRunAutomatedDemo'),

  // Driver Dispatch Queue Section
  driverDispatchSection: document.getElementById('driverDispatchSection'),
  dispatchQueueCount: document.getElementById('dispatchQueueCount'),
  btnLoadAllDispatchOrders: document.getElementById('btnLoadAllDispatchOrders'),
  driverDispatchListContainer: document.getElementById('driverDispatchListContainer'),

  // Store Controls
  storeSelect: document.getElementById('storeSelect'),
  storeAddressHint: document.getElementById('storeAddressHint'),
  scenarioSelector: document.getElementById('scenarioSelector'),
  modeRoundTrip: document.getElementById('modeRoundTrip'),
  modeOneWay: document.getElementById('modeOneWay'),
  addressSearchInput: document.getElementById('addressSearchInput'),
  searchDropdown: document.getElementById('searchDropdown'),
  quickAddBtn: document.getElementById('quickAddBtn'),
  stopsListContainer: document.getElementById('stopsListContainer'),
  stopCountDisplay: document.getElementById('stopCountDisplay'),
  stopsCountBadge: document.getElementById('stopsCountBadge'),
  clearAllStopsBtn: document.getElementById('clearAllStopsBtn'),
  optimizeRouteBtn: document.getElementById('optimizeRouteBtn'),
  simulateRunBtn: document.getElementById('simulateRunBtn'),

  // Metrics
  metricDistance: document.getElementById('metricDistance'),
  metricDuration: document.getElementById('metricDuration'),
  metricFuelCost: document.getElementById('metricFuelCost'),
  metricBagsCount: document.getElementById('metricBagsCount'),
  savingsCallout: document.getElementById('savingsCallout'),
  savingsMiles: document.getElementById('savingsMiles'),
  savingsMins: document.getElementById('savingsMins'),

  // Simulation HUD
  simHudCard: document.getElementById('simHudCard'),
  simHudText: document.getElementById('simHudText'),
  simProgressBar: document.getElementById('simProgressBar'),
  simPlayPauseBtn: document.getElementById('simPlayPauseBtn'),
  simSpeedSelect: document.getElementById('simSpeedSelect'),
  simResetBtn: document.getElementById('simResetBtn'),
  liveToastBar: document.getElementById('liveToastBar'),
  toastMessage: document.getElementById('toastMessage'),
  toastIcon: document.getElementById('toastIcon'),

  // Controls & Modals
  toggleClickAddBtn: document.getElementById('toggleClickAddBtn'),
  clickModeBanner: document.getElementById('clickModeBanner'),
  cancelClickModeBtn: document.getElementById('cancelClickModeBtn'),
  openAddModalBtn: document.getElementById('openAddModalBtn'),
  addStopModal: document.getElementById('addStopModal'),
  closeAddModalBtn: document.getElementById('closeAddModalBtn'),
  cancelAddModalBtn: document.getElementById('cancelAddModalBtn'),
  addStopForm: document.getElementById('addStopForm'),
  modalCustomerName: document.getElementById('modalCustomerName'),
  modalAddress: document.getElementById('modalAddress'),
  modalBags: document.getElementById('modalBags'),
  modalPhone: document.getElementById('modalPhone'),
  modalItems: document.getElementById('modalItems'),
  modalNotes: document.getElementById('modalNotes'),
  modalPerishable: document.getElementById('modalPerishable'),

  // Manifest Modal
  manifestModal: document.getElementById('manifestModal'),
  openManifestBtn: document.getElementById('openManifestBtn'),
  headerManifestBtn: document.getElementById('headerManifestBtn'),
  closeManifestModalBtn: document.getElementById('closeManifestModalBtn'),
  dismissManifestModalBtn: document.getElementById('dismissManifestModalBtn'),
  doPrintManifestBtn: document.getElementById('doPrintManifestBtn'),
  manifestTableBody: document.getElementById('manifestTableBody'),
  manifestHubText: document.getElementById('manifestHubText'),
  manifestSummaryStats: document.getElementById('manifestSummaryStats'),
  manifestDateText: document.getElementById('manifestDateText'),

  // Tabs
  tabBtnRoute: document.getElementById('tabBtnRoute'),
  tabBtnDirections: document.getElementById('tabBtnDirections'),
  tabBtnAnalytics: document.getElementById('tabBtnAnalytics'),
  paneRoute: document.getElementById('paneRoute'),
  paneDirections: document.getElementById('paneDirections'),
  paneAnalytics: document.getElementById('paneAnalytics'),
  directionsList: document.getElementById('directionsList'),

  // Fleet Analytics Table
  statHubName: document.getElementById('statHubName'),
  statStopsCount: document.getElementById('statStopsCount'),
  statTotalBags: document.getElementById('statTotalBags'),
  statTotalMiles: document.getElementById('statTotalMiles'),
  statDriveTime: document.getElementById('statDriveTime'),
  statDropoffTime: document.getElementById('statDropoffTime'),
  statCo2: document.getElementById('statCo2'),

  // Header and Map Controls
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  exportGoogleMapsBtn: document.getElementById('exportGoogleMapsBtn'),
  recenterMapBtn: document.getElementById('recenterMapBtn'),
  fitRouteBtn: document.getElementById('fitRouteBtn')
};

// Initialize Map Manager for Driver App
const mapManager = new MapManager('map', {
  onMapClickToAdd: async (lat, lng) => {
    showToast('🔍 Identifying street address in Overland Park...', '📍');
    const geo = await reverseGeocode(lat, lng);
    state.pendingMapAddCoords = { lat, lng };

    els.modalAddress.value = geo.fullAddress || geo.shortAddress;
    els.modalCustomerName.value = `Overland Park Resident (${geo.shortAddress.split(',')[0]})`;
    els.modalBags.value = 3;
    openAddModal();
  }
});

// Initialize Route Simulator
const simulator = new RouteSimulator(mapManager, {
  onProgressUpdate: (progress) => {
    const percent = Math.min(100, Math.round(progress * 100));
    els.simProgressBar.style.width = `${percent}%`;
    els.simHudText.textContent = `Delivering in Overland Park (${percent}%)`;
  },
  onStopDelivered: (stop) => {
    showToast(`Delivered to ${stop.customerName}! (${stop.bags} bags)`, '✅');
    updateStopCardStatus(stop.id, 'delivered');
    if (stop.orderId) {
      db.updateOrderStatus(stop.orderId, 'delivered', 'FreshRoute Driver delivered package to front porch.');
    }
  },
  onComplete: () => {
    showToast('🎉 Delivery Run Complete! All groceries delivered!', '🏆');
    els.simHudText.textContent = 'All Deliveries Completed! ✓';
    els.simPlayPauseBtn.textContent = '▶️ Replay';
    try {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    } catch (e) {}
  }
});

// Initialize Sub-Portals
let customerPortal = null;
let merchantPortal = null;

/**
 * Initialize Entire Application
 */
function init() {
  // Initialize Customer Portal
  customerPortal = new CustomerPortal(els.customerView, {
    showToast: (msg, icon) => showToast(msg, icon),
    onViewOrderInMerchant: (order) => {
      switchView('merchant');
      if (merchantPortal) {
        merchantPortal.selectedStoreId = order.storeId;
        merchantPortal.render();
      }
    },
    onViewOrderInDriver: (order) => {
      switchView('driver');
      addOrderToDriverRoute(order);
    }
  });

  // Initialize Merchant Portal
  merchantPortal = new MerchantPortal(els.merchantView, {
    showToast: (msg, icon) => showToast(msg, icon),
    onViewInDriver: (order) => {
      switchView('driver');
      addOrderToDriverRoute(order);
    }
  });

  // Setup Driver Views & Initial Data
  populateStoreSelect();
  renderStopList();
  renderDriverDispatchPool();
  updateRoleBadges();
  setupEventListeners();

  // Load and optimize the initial scenario for driver map
  mapManager.renderStoreMarker(state.currentStore);
  mapManager.renderStopMarkers(state.stops);
  mapManager.fitRouteBounds(state.currentStore, state.stops);
  optimizeAndDisplayRoute();

  // Subscribe to DB reactive updates
  db.subscribe((type, payload) => {
    updateRoleBadges();
    renderDriverDispatchPool();

    if (type === 'order:created') {
      updateLiveTicker(`🛒 Customer ${payload.order.customer.name} ordered from ${payload.order.storeName}!`);
    } else if (type === 'order:status_changed') {
      if (payload.status === 'ready_for_dispatch') {
        updateLiveTicker(`📦 Order ${payload.order.orderNumber} is packed & ready for driver pickup at ${payload.order.storeName}!`);
      } else if (payload.status === 'delivered') {
        updateLiveTicker(`✅ Order ${payload.order.orderNumber} delivered to ${payload.order.customer.name}!`);
      } else if (payload.status === 'in_transit') {
        updateLiveTicker(`🚚 Driver picked up Order ${payload.order.orderNumber} and is en route!`);
      }
    } else if (type === 'product:updated') {
      updateLiveTicker(`🏷️ Price updated for ${payload.product.name} to $${payload.product.price.toFixed(2)}`);
    } else if (type === 'product:added') {
      updateLiveTicker(`✨ New product "${payload.product.name}" added to catalog!`);
    } else if (type === 'db:reset') {
      showToast('Database reset to fresh state!', '🔄');
      updateLiveTicker('🔄 FreshRoute database refreshed with pristine demo data.');
      if (customerPortal) customerPortal.render();
      if (merchantPortal) merchantPortal.render();
      renderDriverDispatchPool();
    }
  });

  // Set default view (Customer Shop)
  switchView('customer');
}

/**
 * Switch Active Platform Role View
 */
function switchView(viewName) {
  state.currentView = viewName;

  // Toggle active button states
  els.navRoleCustomer.classList.toggle('active', viewName === 'customer');
  els.navRoleCustomer.setAttribute('aria-selected', viewName === 'customer');

  els.navRoleMerchant.classList.toggle('active', viewName === 'merchant');
  els.navRoleMerchant.setAttribute('aria-selected', viewName === 'merchant');

  els.navRoleDriver.classList.toggle('active', viewName === 'driver');
  els.navRoleDriver.setAttribute('aria-selected', viewName === 'driver');

  // Toggle panel visibility
  els.customerView.style.display = viewName === 'customer' ? 'block' : 'none';
  els.merchantView.style.display = viewName === 'merchant' ? 'block' : 'none';
  els.driverView.style.display = viewName === 'driver' ? 'flex' : 'none';

  // Specific view entry hooks
  if (viewName === 'driver') {
    setTimeout(() => {
      mapManager.map.invalidateSize();
      mapManager.fitRouteBounds(state.currentStore, state.stops);
    }, 100);
    renderDriverDispatchPool();
  } else if (viewName === 'merchant') {
    if (merchantPortal) {
      merchantPortal.render();
    }
  } else if (viewName === 'customer') {
    if (customerPortal) {
      customerPortal.updateCartBadges();
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Update Header Role Count Badges
 */
function updateRoleBadges() {
  const activeMerchantOrders = db.getOrders().filter(o => ['received', 'preparing'].includes(o.status));
  const readyDriverOrders = db.getOrders({ status: 'ready_for_dispatch' });

  if (els.merchantNavBadge) {
    els.merchantNavBadge.textContent = activeMerchantOrders.length;
    els.merchantNavBadge.style.display = activeMerchantOrders.length > 0 ? 'inline-flex' : 'none';
  }

  if (els.driverNavBadge) {
    els.driverNavBadge.textContent = readyDriverOrders.length;
    els.driverNavBadge.style.display = readyDriverOrders.length > 0 ? 'inline-flex' : 'none';
  }
}

/**
 * Update Live Ecosystem Ticker Bar
 */
function updateLiveTicker(msg) {
  if (els.ecosystemLiveMessage) {
    els.ecosystemLiveMessage.innerHTML = `<span>⚡</span> ${escapeHtml(msg)}`;
  }
}

/**
 * Render Merchant Ready-for-Pickup Queue in Driver Sidebar
 */
function renderDriverDispatchPool() {
  if (!els.driverDispatchListContainer) return;

  const readyOrders = db.getOrders({ status: 'ready_for_dispatch' });
  if (els.dispatchQueueCount) {
    els.dispatchQueueCount.textContent = readyOrders.length;
  }

  if (readyOrders.length === 0) {
    els.driverDispatchListContainer.innerHTML = `
      <div style="font-size: 0.75rem; color: var(--text-muted); padding: 0.4rem 0;">
        No merchant orders currently staged for pickup. Check <strong>Merchant Studio</strong> to pack an order!
      </div>
    `;
    if (els.btnLoadAllDispatchOrders) {
      els.btnLoadAllDispatchOrders.disabled = true;
    }
    return;
  }

  if (els.btnLoadAllDispatchOrders) {
    els.btnLoadAllDispatchOrders.disabled = false;
  }

  els.driverDispatchListContainer.innerHTML = readyOrders.map(order => `
    <div class="dispatch-order-item" data-order-id="${order.id}">
      <div class="dispatch-order-row-top">
        <strong>${order.orderNumber} • ${escapeHtml(order.customer.name)}</strong>
        <span class="tag-badge tag-bags">${order.bagsCount} Bags</span>
      </div>
      <div style="font-size: 0.74rem; color: var(--text-secondary);">
        🏬 Hub: ${escapeHtml(order.storeName.split(' (')[0])} ➔ 📍 ${escapeHtml(order.customer.address.split(',')[0])}
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.2rem;">
        <span style="font-size: 0.72rem; color: var(--accent-primary); font-weight: 700;">
          $${order.total.toFixed(2)} ${order.hasPerishable ? '• ❄️ Chilled' : ''}
        </span>
        <button class="btn btn-sm btn-primary btn-add-dispatch-stop" data-order-id="${order.id}" style="padding: 0.2rem 0.6rem; font-size: 0.72rem;">
          + Add to Route
        </button>
      </div>
    </div>
  `).join('');

  // Attach individual "Add to Route" clicks
  els.driverDispatchListContainer.querySelectorAll('.btn-add-dispatch-stop').forEach(btn => {
    btn.addEventListener('click', () => {
      const orderId = btn.getAttribute('data-order-id');
      const order = db.getOrder(orderId);
      if (order) {
        addOrderToDriverRoute(order);
      }
    });
  });
}

/**
 * Add a Merchant Staged Order to Active Driver Route
 */
function addOrderToDriverRoute(order) {
  // Check if store matches, if not switch depot
  const store = GROCERY_STORES.find(s => s.id === order.storeId);
  if (store && state.currentStore.id !== store.id) {
    state.currentStore = store;
    els.storeSelect.value = store.id;
    updateStoreHint();
  }

  // Check if already in stops
  const alreadyIn = state.stops.some(s => s.orderId === order.id);
  if (alreadyIn) {
    showToast(`Order ${order.orderNumber} is already in the route!`, 'ℹ️');
    return;
  }

  // Create new route stop from DB order
  const newStop = {
    id: `stop-order-${order.id}`,
    orderId: order.id,
    customerName: order.customer.name,
    phone: order.customer.phone,
    address: order.customer.address,
    lat: order.customer.lat,
    lng: order.customer.lng,
    bags: order.bagsCount,
    items: order.items.map(it => `${it.quantity}x ${it.name}`),
    isPerishable: order.hasPerishable,
    notes: order.customer.notes || `FreshRoute Order ${order.orderNumber}`,
    status: 'pending'
  };

  state.stops.unshift(newStop);
  resequenceStops();
  renderStopList();

  // Transition order in DB to in_transit
  db.updateOrderStatus(order.id, 'in_transit', 'FreshRoute Driver picked up package & added to navigation route.');

  showToast(`Added Order ${order.orderNumber} to delivery itinerary!`, '🚚');
  renderDriverDispatchPool();
  optimizeAndDisplayRoute();
}

/**
 * Populate Store Select Dropdown
 */
function populateStoreSelect() {
  els.storeSelect.innerHTML = GROCERY_STORES.map(s => `
    <option value="${s.id}">${s.name}</option>
  `).join('');

  updateStoreHint();
}

function updateStoreHint() {
  if (state.currentStore) {
    els.storeAddressHint.querySelector('span').textContent = state.currentStore.address;
  }
}

/**
 * Render Stop List in Sidebar
 */
function renderStopList() {
  els.stopCountDisplay.textContent = state.stops.length;
  els.stopsCountBadge.textContent = state.stops.length;

  if (state.stops.length === 0) {
    els.stopsListContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
        No delivery stops added yet.<br>
        Load ready merchant orders or click on the map to add one!
      </div>
    `;
    return;
  }

  els.stopsListContainer.innerHTML = state.stops.map((stop, idx) => {
    const isDelivered = stop.status === 'delivered';
    const seq = stop.sequence || idx + 1;

    return `
      <div class="stop-card-item ${isDelivered ? 'delivered' : ''}" data-stop-id="${stop.id}">
        <div class="stop-seq-badge">${isDelivered ? '✓' : seq}</div>
        <div class="stop-info-main">
          <div class="stop-customer-name">
            ${escapeHtml(stop.customerName)}
            ${stop.orderId ? '<span class="tag-badge tag-bags" style="margin-left: 0.4rem; font-size: 0.68rem;">Shop Order</span>' : ''}
          </div>
          <div class="stop-address-text" title="${escapeHtml(stop.address)}">
            ${escapeHtml(stop.address)}
          </div>
          <div class="stop-meta-tags">
            <span class="tag-badge tag-bags">${stop.bags || 1} Bags</span>
            ${stop.isPerishable ? '<span class="tag-badge tag-cold">❄️ Cold-Chain</span>' : ''}
            ${stop.notes ? `<span class="tag-badge" style="background: rgba(255,255,255,0.06); font-size: 0.7rem;">📝 Note</span>` : ''}
          </div>
        </div>
        <div class="stop-actions">
          ${!isDelivered ? `
            <button class="btn-deliver-stop btn-mark-delivered" data-id="${stop.id}" title="Confirm drop-off delivery">
              ✓ Deliver
            </button>
          ` : `
            <span style="font-size: 0.72rem; color: var(--accent-primary); font-weight: 700;">Delivered</span>
          `}
          <button class="stop-action-btn btn-move-up" data-idx="${idx}" title="Move Up" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="stop-action-btn btn-move-down" data-idx="${idx}" title="Move Down" ${idx === state.stops.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="stop-action-btn btn-delete" data-id="${stop.id}" title="Remove Stop">✕</button>
        </div>
      </div>
    `;
  }).join('');

  // Attach card click highlight
  els.stopsListContainer.querySelectorAll('.stop-card-item').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const stopId = card.getAttribute('data-stop-id');
      mapManager.highlightStop(stopId);
    });
  });

  // Attach Mark Delivered buttons
  els.stopsListContainer.querySelectorAll('.btn-mark-delivered').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const stop = state.stops.find(s => s.id === id);
      if (stop) {
        stop.status = 'delivered';
        updateStopCardStatus(id, 'delivered');
        showToast(`Delivered to ${stop.customerName}! (${stop.bags} bags)`, '✅');
        if (stop.orderId) {
          db.updateOrderStatus(stop.orderId, 'delivered', 'FreshRoute Driver confirmed doorstep drop-off.');
        }

        // Check if all stops delivered
        const allDone = state.stops.every(s => s.status === 'delivered');
        if (allDone) {
          try {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          } catch (err) {}
          showToast('🎉 All route deliveries completed successfully!', '🏆');
        }
      }
    });
  });

  // Attach Move & Delete button handlers
  els.stopsListContainer.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      deleteStop(id);
    });
  });

  els.stopsListContainer.querySelectorAll('.btn-move-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (idx > 0) {
        const temp = state.stops[idx];
        state.stops[idx] = state.stops[idx - 1];
        state.stops[idx - 1] = temp;
        resequenceStops();
        renderStopList();
        optimizeAndDisplayRoute();
      }
    });
  });

  els.stopsListContainer.querySelectorAll('.btn-move-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (idx < state.stops.length - 1) {
        const temp = state.stops[idx];
        state.stops[idx] = state.stops[idx + 1];
        state.stops[idx + 1] = temp;
        resequenceStops();
        renderStopList();
        optimizeAndDisplayRoute();
      }
    });
  });
}

function resequenceStops() {
  state.stops.forEach((s, i) => {
    s.sequence = i + 1;
  });
}

function updateStopCardStatus(stopId, status) {
  const card = els.stopsListContainer.querySelector(`[data-stop-id="${stopId}"]`);
  if (card) {
    if (status === 'delivered') {
      card.classList.add('delivered');
      const badge = card.querySelector('.stop-seq-badge');
      if (badge) badge.textContent = '✓';
    }
  }
}

/**
 * Optimize Route and Update Map + Panels
 */
async function optimizeAndDisplayRoute() {
  if (state.stops.length === 0) {
    mapManager.renderRoutePolyline([]);
    updateMetricsEmpty();
    return;
  }

  showToast('⚡ Calculating optimal road route in Overland Park...', '🗺️');
  els.optimizeRouteBtn.disabled = true;
  els.optimizeRouteBtn.innerHTML = '<span>⏳</span> Optimizing...';

  try {
    const result = await calculateOptimizedRoute(state.currentStore, state.stops, state.isRoundTrip);

    if (result && result.success) {
      state.routeData = result;

      // Update state stops to the optimal sequence
      if (result.optimizedStops && result.optimizedStops.length > 0) {
        state.stops = result.optimizedStops;
        renderStopList();
      }

      // Render on map
      mapManager.renderStoreMarker(state.currentStore);
      mapManager.renderStopMarkers(state.stops);
      mapManager.renderRoutePolyline(result.coordinates);
      mapManager.fitRouteBounds(state.currentStore, state.stops);

      // Load into simulator
      simulator.setRoute(result.coordinates, state.stops, state.currentStore);

      // Update metrics
      updateMetrics(result);

      // Render Turn-by-Turn directions
      renderDirections(result.instructions);

      // Update fleet stats
      updateFleetStats(result);

      // Update Google Maps Link
      updateGoogleMapsUrl();

      showToast(`✨ Route ready! ${result.totalMiles} mi • ${result.totalDurationFormatted}`, '🚀');
    }
  } catch (err) {
    console.error('Error optimizing route:', err);
    showToast('Notice: Route rendered using Overland Park direct paths.', 'ℹ️');
  } finally {
    els.optimizeRouteBtn.disabled = false;
    els.optimizeRouteBtn.innerHTML = '<span aria-hidden="true">⚡</span> Optimize Route Order';
  }
}

/**
 * Update Metrics Panel
 */
function updateMetrics(result) {
  els.metricDistance.textContent = `${result.totalMiles} mi`;
  els.metricDuration.textContent = result.totalDurationFormatted;

  // Kansas average fuel cost ($3.15/gal, 22 MPG)
  const fuelCost = ((result.totalMiles / 22) * 3.15).toFixed(2);
  els.metricFuelCost.textContent = `$${fuelCost}`;

  const totalBags = state.stops.reduce((acc, s) => acc + (s.bags || 1), 0);
  els.metricBagsCount.textContent = `${totalBags} Bags`;

  if (result.savings && result.savings.milesSaved > 0.2) {
    els.savingsCallout.style.display = 'flex';
    els.savingsMiles.textContent = result.savings.milesSaved;
    els.savingsMins.textContent = result.savings.minutesSaved;
  } else {
    els.savingsCallout.style.display = 'none';
  }
}

function updateMetricsEmpty() {
  els.metricDistance.textContent = '0.0 mi';
  els.metricDuration.textContent = '0 min';
  els.metricFuelCost.textContent = '$0.00';
  els.metricBagsCount.textContent = '0 Bags';
  els.savingsCallout.style.display = 'none';
  els.directionsList.innerHTML = `<p class="text-muted" style="font-size: 0.85rem; padding: 1rem 0;">Add delivery stops to generate directions.</p>`;
}

/**
 * Render Directions List (Turn-by-Turn)
 */
function renderDirections(instructions) {
  if (!instructions || instructions.length === 0) {
    els.directionsList.innerHTML = `<p class="text-muted" style="font-size: 0.85rem; padding: 1rem 0;">No road instructions available for this route.</p>`;
    return;
  }

  els.directionsList.innerHTML = instructions.map(inst => {
    if (inst.type === 'leg_header') {
      return `
        <div class="direction-item leg-header">
          <span class="direction-icon" aria-hidden="true">📍</span>
          <span class="direction-text"><strong>${escapeHtml(inst.text)}</strong></span>
          <span class="direction-dist">${inst.distanceMiles} mi • ${inst.durationMinutes}m</span>
        </div>
      `;
    }
    return `
      <div class="direction-item">
        <span class="direction-icon" aria-hidden="true">↳</span>
        <span class="direction-text">${escapeHtml(inst.text)}</span>
        <span class="direction-dist">${inst.distanceMiles} mi</span>
      </div>
    `;
  }).join('');
}

/**
 * Update Fleet & Analytics Tab
 */
function updateFleetStats(result) {
  const totalBags = state.stops.reduce((acc, s) => acc + (s.bags || 1), 0);
  const dropoffMinutes = state.stops.length * 4;

  els.statHubName.textContent = state.currentStore.name;
  els.statStopsCount.textContent = `${state.stops.length} Overland Park Homes`;
  els.statTotalBags.textContent = `${totalBags} Bags`;
  els.statTotalMiles.textContent = `${result.totalMiles} Miles`;
  els.statDriveTime.textContent = result.totalDurationFormatted;
  els.statDropoffTime.textContent = `~${dropoffMinutes} mins (4 min/doorstep)`;

  const co2Lbs = (result.totalMiles * 0.89).toFixed(1);
  els.statCo2.textContent = `${co2Lbs} lbs CO₂`;
}

/**
 * Update Google Maps Navigation URL
 */
function updateGoogleMapsUrl() {
  const url = generateGoogleMapsUrl(state.currentStore, state.stops, state.isRoundTrip);
  els.exportGoogleMapsBtn.onclick = () => {
    window.open(url, '_blank');
  };
}

/**
 * Render Manifest Modal Table
 */
function renderManifest() {
  const totalBags = state.stops.reduce((acc, s) => acc + (s.bags || 1), 0);
  els.manifestHubText.textContent = `Hub: ${state.currentStore.name}`;
  els.manifestSummaryStats.textContent = `${state.stops.length} Stops • ${totalBags} Bags • ${state.routeData ? state.routeData.totalMiles : 0} Miles`;
  els.manifestDateText.textContent = `Date: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  els.manifestTableBody.innerHTML = state.stops.map((stop, idx) => {
    const isDelivered = stop.status === 'delivered';
    return `
      <tr>
        <td style="font-weight: 700;">#${stop.sequence || idx + 1}</td>
        <td>
          <strong>${escapeHtml(stop.customerName)}</strong>
          ${stop.phone ? `<div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(stop.phone)}</div>` : ''}
        </td>
        <td>${escapeHtml(stop.address)}</td>
        <td><strong>${stop.bags || 1} Bags</strong> ${stop.isPerishable ? '❄️' : ''}</td>
        <td>
          ${stop.items && stop.items.length > 0 ? `<div style="font-size: 0.75rem;">${escapeHtml(stop.items.join(', '))}</div>` : ''}
          ${stop.notes ? `<div style="font-size: 0.72rem; color: var(--accent-warning);">Note: ${escapeHtml(stop.notes)}</div>` : ''}
        </td>
        <td style="text-align: center;">
          <input type="checkbox" ${isDelivered ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Delete Stop
 */
function deleteStop(id) {
  state.stops = state.stops.filter(s => s.id !== id);
  resequenceStops();
  renderStopList();
  optimizeAndDisplayRoute();
}

/**
 * Setup All Event Listeners
 */
function setupEventListeners() {
  // Role Switcher Click Listeners
  els.navRoleCustomer.addEventListener('click', () => switchView('customer'));
  els.navRoleMerchant.addEventListener('click', () => switchView('merchant'));
  els.navRoleDriver.addEventListener('click', () => switchView('driver'));

  // Quick Ecosystem Step Chips
  els.chipStepCustomer.addEventListener('click', () => switchView('customer'));
  els.chipStepMerchant.addEventListener('click', () => switchView('merchant'));
  els.chipStepDriver.addEventListener('click', () => switchView('driver'));

  // Reset Database Button
  els.resetDatabaseBtn.addEventListener('click', () => {
    if (confirm('Reset store catalog, active orders, and test data to default values?')) {
      db.resetDemoData();
    }
  });

  // Guided Tour Modal Listeners
  els.openGuidedTourBtn.addEventListener('click', () => {
    els.guidedTourModal.classList.add('active');
    document.body.classList.add('modal-open');
  });

  const closeTour = () => {
    els.guidedTourModal.classList.remove('active');
    document.body.classList.remove('modal-open');
  };

  els.closeTourModalBtn.addEventListener('click', closeTour);
  els.dismissTourModalBtn.addEventListener('click', closeTour);

  els.tourGoCustomerBtn.addEventListener('click', () => {
    closeTour();
    switchView('customer');
  });

  els.tourGoMerchantBtn.addEventListener('click', () => {
    closeTour();
    switchView('merchant');
  });

  els.tourGoDriverBtn.addEventListener('click', () => {
    closeTour();
    switchView('driver');
  });

  // 1-Click Interactive Ecosystem Demo
  els.btnRunAutomatedDemo.addEventListener('click', () => {
    closeTour();
    runAutomatedDemo();
  });

  // Driver Dispatch Pool: Load All Orders
  els.btnLoadAllDispatchOrders.addEventListener('click', () => {
    const readyOrders = db.getOrders({ status: 'ready_for_dispatch' });
    if (readyOrders.length === 0) return;

    readyOrders.forEach(o => addOrderToDriverRoute(o));
    showToast(`Loaded ${readyOrders.length} merchant order(s) into driver route!`, '⚡');
  });

  // Store Selector Change
  els.storeSelect.addEventListener('change', (e) => {
    const selected = GROCERY_STORES.find(s => s.id === e.target.value);
    if (selected) {
      state.currentStore = selected;
      updateStoreHint();
      mapManager.renderStoreMarker(state.currentStore);
      optimizeAndDisplayRoute();
    }
  });

  // Scenario Loading Helper
  function loadScenario(scenarioId) {
    simulator.stop();
    els.simHudCard.style.display = 'none';

    if (scenarioId === 'custom_empty') {
      state.stops = [];
      renderStopList();
      optimizeAndDisplayRoute();
      showToast('Cleared stops. Ready for custom addresses!', '📝');
      return;
    }

    const scenario = PRESET_SCENARIOS.find(s => s.id === scenarioId);
    if (scenario) {
      const store = GROCERY_STORES.find(st => st.id === scenario.storeId);
      if (store) {
        state.currentStore = store;
        els.storeSelect.value = store.id;
        updateStoreHint();
      }
      state.stops = JSON.parse(JSON.stringify(scenario.stops));
      renderStopList();
      optimizeAndDisplayRoute();
      showToast(`Loaded ${scenario.name}!`, '🌟');
    }
  }

  // Scenario Selector Change
  if (els.scenarioSelector) {
    els.scenarioSelector.addEventListener('change', (e) => {
      loadScenario(e.target.value);
    });
  }

  // Scenario Chips in Sidebar Tab 1
  document.querySelectorAll('.scenario-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const scenarioId = chip.getAttribute('data-scenario');
      if (els.scenarioSelector) {
        els.scenarioSelector.value = scenarioId;
      }
      loadScenario(scenarioId);
    });
  });

  // Route Mode Toggles
  els.modeRoundTrip.addEventListener('click', () => {
    if (!state.isRoundTrip) {
      state.isRoundTrip = true;
      els.modeRoundTrip.classList.add('active');
      els.modeOneWay.classList.remove('active');
      els.modeRoundTrip.setAttribute('aria-checked', 'true');
      els.modeOneWay.setAttribute('aria-checked', 'false');
      optimizeAndDisplayRoute();
    }
  });

  els.modeOneWay.addEventListener('click', () => {
    if (state.isRoundTrip) {
      state.isRoundTrip = false;
      els.modeOneWay.classList.add('active');
      els.modeRoundTrip.classList.remove('active');
      els.modeOneWay.setAttribute('aria-checked', 'true');
      els.modeRoundTrip.setAttribute('aria-checked', 'false');
      optimizeAndDisplayRoute();
    }
  });

  // Clear All Stops
  els.clearAllStopsBtn.addEventListener('click', () => {
    if (state.stops.length === 0) return;
    if (confirm('Clear all stops from the current delivery route?')) {
      state.stops = [];
      renderStopList();
      optimizeAndDisplayRoute();
    }
  });

  // Optimize Button
  els.optimizeRouteBtn.addEventListener('click', () => {
    optimizeAndDisplayRoute();
  });

  // Simulation Trigger Button
  els.simulateRunBtn.addEventListener('click', () => {
    if (state.stops.length === 0) {
      showToast('Add at least one delivery stop to simulate!', '⚠️');
      return;
    }
    startSimulation();
  });

  // Simulation Controls in HUD
  els.simPlayPauseBtn.addEventListener('click', () => {
    if (simulator.isRunning) {
      simulator.pause();
      els.simPlayPauseBtn.textContent = '▶️ Resume';
    } else {
      simulator.start();
      els.simPlayPauseBtn.textContent = '⏸️ Pause';
    }
  });

  els.simSpeedSelect.addEventListener('change', (e) => {
    simulator.setSpeed(parseFloat(e.target.value));
  });

  els.simResetBtn.addEventListener('click', () => {
    simulator.stop();
    els.simHudCard.style.display = 'none';
    els.simPlayPauseBtn.textContent = '⏸️ Pause';
    mapManager.removeTruckMarker();
  });

  // Click-to-Add Stop Toggle
  els.toggleClickAddBtn.addEventListener('click', () => {
    state.isClickToAddActive = !state.isClickToAddActive;
    mapManager.setClickToAddMode(state.isClickToAddActive);
    els.toggleClickAddBtn.classList.toggle('active', state.isClickToAddActive);
    els.toggleClickAddBtn.setAttribute('aria-pressed', state.isClickToAddActive);
    els.clickModeBanner.style.display = state.isClickToAddActive ? 'flex' : 'none';

    if (state.isClickToAddActive) {
      showToast('Click anywhere in Overland Park to drop a delivery stop pin!', '📍');
      if (state.currentView !== 'driver') {
        switchView('driver');
      }
    }
  });

  els.cancelClickModeBtn.addEventListener('click', () => {
    state.isClickToAddActive = false;
    mapManager.setClickToAddMode(false);
    els.toggleClickAddBtn.classList.remove('active');
    els.toggleClickAddBtn.setAttribute('aria-pressed', 'false');
    els.clickModeBanner.style.display = 'none';
  });

  // Modal Controls
  els.openAddModalBtn.addEventListener('click', () => openAddModal());
  els.closeAddModalBtn.addEventListener('click', () => closeAddModal());
  els.cancelAddModalBtn.addEventListener('click', () => closeAddModal());

  // Add Stop Form Submit
  els.addStopForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = els.modalCustomerName.value.trim();
    const address = els.modalAddress.value.trim();
    const bags = parseInt(els.modalBags.value, 10) || 1;
    const phone = els.modalPhone.value.trim();
    const notes = els.modalNotes.value.trim();
    const isPerishable = els.modalPerishable.checked;
    const itemsRaw = els.modalItems.value.trim();
    const items = itemsRaw ? itemsRaw.split(',').map(s => s.trim()) : [];

    let lat, lng;

    if (state.pendingMapAddCoords) {
      lat = state.pendingMapAddCoords.lat;
      lng = state.pendingMapAddCoords.lng;
      state.pendingMapAddCoords = null;
    } else {
      showToast(`Geocoding "${address}" in Overland Park...`, '🔍');
      const geocoded = await searchAddress(address);
      if (geocoded && geocoded.length > 0) {
        lat = geocoded[0].lat;
        lng = geocoded[0].lng;
      } else {
        showToast('Address outside Overland Park boundary. Using city center.', '⚠️');
        lat = OVERLAND_PARK_CENTER[0];
        lng = OVERLAND_PARK_CENTER[1];
      }
    }

    const newStop = {
      id: `stop-${Date.now()}`,
      customerName: name,
      address,
      phone,
      lat,
      lng,
      bags,
      items,
      isPerishable,
      notes,
      status: 'pending'
    };

    state.stops.push(newStop);
    resequenceStops();
    renderStopList();
    closeAddModal();
    optimizeAndDisplayRoute();
    showToast(`Added ${name} to delivery itinerary!`, '📍');
  });

  // Address Autocomplete Search
  let searchTimeout = null;
  els.addressSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    clearTimeout(searchTimeout);

    if (q.length < 3) {
      els.searchDropdown.style.display = 'none';
      return;
    }

    searchTimeout = setTimeout(async () => {
      const results = await searchAddress(q);
      renderSearchDropdown(results);
    }, 300);
  });

  // Quick Add Address Button
  els.quickAddBtn.addEventListener('click', async () => {
    const query = els.addressSearchInput.value.trim();
    if (!query) return;

    showToast(`Locating "${query}" in Overland Park...`, '🔍');
    const results = await searchAddress(query);
    if (results.length > 0) {
      addStopFromGeocode(results[0]);
      els.addressSearchInput.value = '';
      els.searchDropdown.style.display = 'none';
    } else {
      showToast('Address not found. Please try another Overland Park street.', '⚠️');
    }
  });

  // Quick Neighborhood Chips
  document.querySelectorAll('.quick-chip[data-addr]').forEach(chip => {
    chip.addEventListener('click', async () => {
      const addr = chip.getAttribute('data-addr');
      els.addressSearchInput.value = addr;
      showToast(`Locating ${addr.split(',')[0]}...`, '🔍');
      const results = await searchAddress(addr);
      if (results.length > 0) {
        addStopFromGeocode(results[0]);
      }
    });
  });

  // Sidebar Tab Switching
  els.tabBtnRoute.addEventListener('click', () => switchSidebarTab('route'));
  els.tabBtnDirections.addEventListener('click', () => switchSidebarTab('directions'));
  els.tabBtnAnalytics.addEventListener('click', () => switchSidebarTab('analytics'));

  // Manifest Modal Controls
  const openManifest = () => {
    renderManifest();
    els.manifestModal.classList.add('active');
    document.body.classList.add('modal-open');
  };
  const closeManifest = () => {
    els.manifestModal.classList.remove('active');
    document.body.classList.remove('modal-open');
  };

  els.openManifestBtn.addEventListener('click', openManifest);
  if (els.headerManifestBtn) els.headerManifestBtn.addEventListener('click', openManifest);
  els.closeManifestModalBtn.addEventListener('click', closeManifest);
  els.dismissManifestModalBtn.addEventListener('click', closeManifest);

  els.doPrintManifestBtn.addEventListener('click', () => {
    window.print();
  });

  // Map Recenter & Fit Controls
  els.recenterMapBtn.addEventListener('click', () => {
    mapManager.recenter();
  });

  els.fitRouteBtn.addEventListener('click', () => {
    mapManager.fitRouteBounds(state.currentStore, state.stops);
  });

  // Theme Toggle (Dark / Light)
  els.themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    els.themeToggleBtn.textContent = nextTheme === 'dark' ? '🌙' : '☀️';
    mapManager.setTheme(nextTheme);
    showToast(`Switched to ${nextTheme} mode`, '🎨');
  });
}

/**
 * 1-Click Interactive Ecosystem Flow Demonstration
 */
async function runAutomatedDemo() {
  showToast('🎬 Starting 3-sided FreshRoute ecosystem demo flow!', '✨');

  // Step 1: Customer Shop
  switchView('customer');
  showToast('Step 1: Customer placing order from Whole Foods Overland Park...', '🛒');
  await new Promise(r => setTimeout(r, 1500));

  const demoOrder = db.createOrder({
    storeId: 'whole_foods',
    customer: {
      name: 'Michael & Jenny Scott',
      phone: '(913) 555-0899',
      address: '8001 Conser St, Overland Park, KS 66204',
      lat: 38.9832,
      lng: -94.6698,
      notes: 'Porch cooler box beside front door.'
    },
    items: [
      { id: 'wf-prod-1', name: 'Organic Honeycrisp Apples', price: 3.99, quantity: 2, isPerishable: false },
      { id: 'wf-dai-1', name: 'Whole Grass-Fed Milk', price: 4.89, quantity: 1, isPerishable: true },
      { id: 'wf-bak-1', name: 'Artisan Country Sourdough Loaf', price: 5.99, quantity: 1, isPerishable: false }
    ],
    subtotal: 18.86,
    deliveryFee: 0,
    tip: 4.00,
    total: 22.86
  });

  showToast(`Order ${demoOrder.orderNumber} placed by customer!`, '🎉');
  await new Promise(r => setTimeout(r, 1800));

  // Step 2: Merchant Studio
  switchView('merchant');
  showToast('Step 2: Merchant Studio received order! Packing items & checking off list...', '🏬');
  await new Promise(r => setTimeout(r, 1600));

  db.updateOrderStatus(demoOrder.id, 'preparing', 'Merchant packing items');
  await new Promise(r => setTimeout(r, 1200));

  db.toggleOrderItemPacked(demoOrder.id, 0);
  db.toggleOrderItemPacked(demoOrder.id, 1);
  db.toggleOrderItemPacked(demoOrder.id, 2);
  db.updateOrderStatus(demoOrder.id, 'ready_for_dispatch', 'All items packed! Merchant requested driver.');
  showToast(`Merchant marked ${demoOrder.orderNumber} packed and requested driver!`, '📦');
  await new Promise(r => setTimeout(r, 2000));

  // Step 3: Driver Maps
  switchView('driver');
  showToast('Step 3: Driver Maps received package! Loading into Overland Park route...', '🚚');
  await new Promise(r => setTimeout(r, 1200));

  addOrderToDriverRoute(demoOrder);
  await new Promise(r => setTimeout(r, 1500));

  showToast('Optimizing TSP road network & starting GPS vehicle simulation!', '⚡');
  startSimulation();
}

/**
 * Start Route Simulation
 */
function startSimulation() {
  els.simHudCard.style.display = 'flex';
  els.simPlayPauseBtn.textContent = '⏸️ Pause';
  els.simProgressBar.style.width = '0%';
  simulator.start();
  showToast('🚚 FreshRoute Delivery Agent departed store hub in Overland Park!', '💨');
}

/**
 * Render Search Dropdown Results
 */
function renderSearchDropdown(results) {
  if (!results || results.length === 0) {
    els.searchDropdown.style.display = 'none';
    return;
  }

  els.searchDropdown.innerHTML = results.map(item => `
    <div class="search-result-item" data-lat="${item.lat}" data-lng="${item.lng}" data-address="${escapeHtml(item.displayName)}">
      <div class="result-title">${escapeHtml(item.shortAddress)}</div>
      <div class="result-subtitle">${escapeHtml(item.fullAddress)}</div>
    </div>
  `).join('');

  els.searchDropdown.style.display = 'block';

  els.searchDropdown.querySelectorAll('.search-result-item').forEach(el => {
    el.addEventListener('click', () => {
      const lat = parseFloat(el.getAttribute('data-lat'));
      const lng = parseFloat(el.getAttribute('data-lng'));
      const address = el.getAttribute('data-address');
      const short = el.querySelector('.result-title').textContent;

      addStopFromGeocode({ lat, lng, fullAddress: address, shortAddress: short });
      els.addressSearchInput.value = '';
      els.searchDropdown.style.display = 'none';
    });
  });
}

function addStopFromGeocode(geo) {
  const newStop = {
    id: `stop-${Date.now()}`,
    customerName: `Customer (${geo.shortAddress.split(',')[0]})`,
    address: geo.fullAddress || geo.shortAddress,
    lat: geo.lat,
    lng: geo.lng,
    bags: Math.floor(Math.random() * 3) + 2,
    items: ['Fresh Organic Produce', 'Bakery Bread', 'Dairy'],
    isPerishable: Math.random() > 0.4,
    notes: 'Please leave on porch.',
    status: 'pending'
  };

  state.stops.push(newStop);
  resequenceStops();
  renderStopList();
  optimizeAndDisplayRoute();
  showToast(`Added ${newStop.customerName} to route!`, '📍');
}

/**
 * Switch Sidebar Tab
 */
function switchSidebarTab(tabName) {
  els.tabBtnRoute.classList.toggle('active', tabName === 'route');
  els.tabBtnDirections.classList.toggle('active', tabName === 'directions');
  els.tabBtnAnalytics.classList.toggle('active', tabName === 'analytics');

  els.tabBtnRoute.setAttribute('aria-selected', tabName === 'route');
  els.tabBtnDirections.setAttribute('aria-selected', tabName === 'directions');
  els.tabBtnAnalytics.setAttribute('aria-selected', tabName === 'analytics');

  els.paneRoute.classList.toggle('active', tabName === 'route');
  els.paneDirections.classList.toggle('active', tabName === 'directions');
  els.paneAnalytics.classList.toggle('active', tabName === 'analytics');
}

/**
 * Modal Helpers
 */
function openAddModal() {
  els.addStopModal.classList.add('active');
  document.body.classList.add('modal-open');
}

function closeAddModal() {
  els.addStopModal.classList.remove('active');
  document.body.classList.remove('modal-open');
  state.pendingMapAddCoords = null;
}

/**
 * Toast Notifications
 */
let toastTimeout = null;
function showToast(message, icon = '📦') {
  if (!els.liveToastBar) return;
  els.toastMessage.textContent = message;
  els.toastIcon.textContent = icon;
  els.liveToastBar.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    els.liveToastBar.classList.remove('show');
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start application on DOM Ready
document.addEventListener('DOMContentLoaded', init);
