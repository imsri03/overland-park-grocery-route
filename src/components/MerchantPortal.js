/**
 * MerchantPortal.js - FreshRoute Merchant Studio & Order Fulfillment Hub
 * Allows Overland Park grocery merchants to see incoming customer orders ("who ordered what"),
 * pack groceries with an itemized checklist, request FreshRoute driver pickup, and manage
 * store inventory products and prices in real-time.
 */

import { db } from '../services/db.js';

export class MerchantPortal {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.onViewInDriver = options.onViewInDriver || null;
    this.showToast = options.showToast || console.log;

    this.selectedStoreId = 'royal_spices';
    this.activeTab = 'orders'; // 'orders' | 'inventory'
    this.orderStatusFilter = 'all'; // 'all' | 'received' | 'preparing' | 'ready_for_dispatch' | 'completed'
    this.inventoryCategoryFilter = 'all';
    this.inventorySearchQuery = '';

    this.init();
  }

  init() {
    this.render();
    this.setupListeners();

    // Subscribe to DB events for incoming orders and status updates
    this.unsubscribe = db.subscribe((type, payload) => {
      if (type.startsWith('order:')) {
        this.renderOrdersQueue();
        this.renderStatsHeader();
      } else if (type.startsWith('product:')) {
        if (this.activeTab === 'inventory') {
          this.renderInventoryTable();
        }
      }
    });
  }

  setupListeners() {
    // Delegated click handler
    this.container.addEventListener('click', (e) => {
      // Store selector button
      const storeBtn = e.target.closest('.merchant-store-select-btn');
      if (storeBtn) {
        this.selectedStoreId = storeBtn.dataset.storeId;
        this.render();
        return;
      }

      // Tab switcher
      const tabBtn = e.target.closest('.merchant-main-tab');
      if (tabBtn) {
        this.activeTab = tabBtn.dataset.tab;
        this.render();
        return;
      }

      // Order status filter pill
      const filterPill = e.target.closest('.order-filter-pill');
      if (filterPill) {
        this.orderStatusFilter = filterPill.dataset.filter;
        this.renderOrdersQueue();
        return;
      }

      // Order Actions: Start Packing
      const startPackBtn = e.target.closest('.btn-start-packing');
      if (startPackBtn) {
        const orderId = startPackBtn.dataset.orderId;
        this.handleStartPacking(orderId);
        return;
      }

      // Order Actions: Request Driver Dispatch
      const requestDriverBtn = e.target.closest('.btn-request-driver');
      if (requestDriverBtn) {
        const orderId = requestDriverBtn.dataset.orderId;
        this.handleRequestDriver(orderId);
        return;
      }

      // Bag count adjustment
      const bagPlus = e.target.closest('.bag-count-plus');
      if (bagPlus) {
        const orderId = bagPlus.dataset.orderId;
        this.handleAdjustBags(orderId, 1);
        return;
      }

      const bagMinus = e.target.closest('.bag-count-minus');
      if (bagMinus) {
        const orderId = bagMinus.dataset.orderId;
        this.handleAdjustBags(orderId, -1);
        return;
      }

      // Jump to Driver map
      const jumpDriverBtn = e.target.closest('.btn-jump-driver');
      if (jumpDriverBtn) {
        const orderId = jumpDriverBtn.dataset.orderId;
        const order = db.getOrder(orderId);
        if (this.onViewInDriver && order) {
          this.onViewInDriver(order);
        }
        return;
      }

      // Open Add Product Modal
      if (e.target.closest('#btnOpenAddProductModal')) {
        this.openAddProductModal();
        return;
      }

      // Close Add Product Modal
      if (e.target.closest('#btnCloseAddProductModal') || e.target.closest('#btnCancelAddProduct')) {
        this.closeAddProductModal();
        return;
      }

      // Toggle Product In-Stock
      const stockToggle = e.target.closest('.product-stock-toggle');
      if (stockToggle) {
        const prodId = stockToggle.dataset.prodId;
        this.handleToggleProductStock(prodId);
        return;
      }

      // Edit Product Price prompt
      const editPriceBtn = e.target.closest('.btn-edit-price');
      if (editPriceBtn) {
        const prodId = editPriceBtn.dataset.prodId;
        this.handleEditProductPrice(prodId);
        return;
      }
    });

    // Inventory search & category filter inputs
    this.container.addEventListener('input', (e) => {
      if (e.target.id === 'merchantInventorySearch') {
        this.inventorySearchQuery = e.target.value.toLowerCase().trim();
        this.renderInventoryTable();
      }
    });

    this.container.addEventListener('change', (e) => {
      const checkItemBox = e.target.closest('.pack-item-checkbox');
      if (checkItemBox) {
        const orderId = checkItemBox.dataset.orderId;
        const itemIdx = parseInt(checkItemBox.dataset.itemIdx, 10);
        this.handleToggleItemPacked(orderId, itemIdx);
        return;
      }

      if (e.target.id === 'merchantCategorySelect') {
        this.inventoryCategoryFilter = e.target.value;
        this.renderInventoryTable();
      }
    });

    // Add Product Form submit
    this.container.addEventListener('submit', (e) => {
      if (e.target.id === 'merchantAddProductForm') {
        e.preventDefault();
        this.handleAddProductSubmit();
      }
    });
  }

  // --- ACTIONS ---

  handleStartPacking(orderId) {
    db.updateOrderStatus(orderId, 'preparing', 'Merchant staff started picking groceries.');
    this.showToast('Started packing order! Check off items as you bag them.', '📦');
  }

  handleRequestDriver(orderId) {
    const order = db.getOrder(orderId);
    if (!order) return;

    db.updateOrderStatus(orderId, 'ready_for_dispatch', `Merchant completed packing ${order.bagsCount} bags. FreshRoute Driver requested!`);
    this.showToast(`Order ${order.orderNumber} is marked packed! Dispatched to FreshRoute Driver queue.`, '🚚');
  }

  handleToggleItemPacked(orderId, itemIdx) {
    db.toggleOrderItemPacked(orderId, itemIdx);
  }

  handleAdjustBags(orderId, delta) {
    const order = db.getOrder(orderId);
    if (!order) return;
    const newCount = Math.max(1, order.bagsCount + delta);
    db.setOrderBagCount(orderId, newCount);
  }

  handleToggleProductStock(prodId) {
    const inventory = db.getStoreInventory(this.selectedStoreId);
    const product = inventory.find(p => p.id === prodId);
    if (!product) return;

    db.updateProduct(this.selectedStoreId, prodId, { inStock: !product.inStock });
    this.showToast(`Updated stock status for ${product.name}`, '🔄');
  }

  handleEditProductPrice(prodId) {
    const inventory = db.getStoreInventory(this.selectedStoreId);
    const product = inventory.find(p => p.id === prodId);
    if (!product) return;

    const newPriceStr = prompt(`Update price for "${product.name}":`, product.price.toFixed(2));
    if (newPriceStr !== null) {
      const parsed = parseFloat(newPriceStr);
      if (!isNaN(parsed) && parsed >= 0) {
        db.updateProduct(this.selectedStoreId, prodId, { price: parsed });
        this.showToast(`Price for ${product.name} updated to $${parsed.toFixed(2)}`, '🏷️');
      } else {
        alert('Please enter a valid price (e.g. 4.99)');
      }
    }
  }

  openAddProductModal() {
    const modal = this.container.querySelector('#merchantAddProductModal');
    if (modal) {
      modal.classList.add('active');
      document.body.classList.add('modal-open');
    }
  }

  closeAddProductModal() {
    const modal = this.container.querySelector('#merchantAddProductModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
  }

  handleAddProductSubmit() {
    const name = this.container.querySelector('#newProdName').value.trim();
    const category = this.container.querySelector('#newProdCategory').value;
    const price = parseFloat(this.container.querySelector('#newProdPrice').value) || 2.99;
    const unit = this.container.querySelector('#newProdUnit').value.trim() || '1 item';
    const stock = parseInt(this.container.querySelector('#newProdStock').value, 10) || 25;
    const emoji = this.container.querySelector('#newProdEmoji').value.trim() || '🛒';
    const badge = this.container.querySelector('#newProdBadge').value.trim() || 'Local KS';
    const isPerishable = this.container.querySelector('#newProdPerishable').checked;
    const description = this.container.querySelector('#newProdDesc').value.trim();

    if (!name) return;

    db.addProduct(this.selectedStoreId, {
      name,
      category,
      price,
      unit,
      stock,
      emoji,
      badge,
      isPerishable,
      description
    });

    this.closeAddProductModal();
    this.showToast(`Added "${name}" to store inventory database!`, '✨');
    this.renderInventoryTable();
  }

  // --- RENDERING ---

  render() {
    const allStores = db.getStores();
    // Fall back to the first available store if the selected id is missing
    // (e.g. cached data from an older store list). Never crash on a stale id.
    let store = db.getStore(this.selectedStoreId);
    if (!store && allStores.length > 0) {
      this.selectedStoreId = allStores[0].id;
      store = allStores[0];
    }
    if (!store) {
      this.container.innerHTML = `
        <div class="merchant-portal-container animate-fade-in">
          <p style="padding: 2rem; text-align: center; color: var(--text-muted);">No stores available.</p>
        </div>`;
      return;
    }

    this.container.innerHTML = `
      <div class="merchant-portal-container animate-fade-in">
        <!-- Top Bar: Store Switcher & Metrics -->
        <div class="merchant-header-bar" style="--store-color: ${store.color}">
          <div class="merchant-store-info">
            <div class="merchant-store-avatar" style="background-color: ${store.color}20; color: ${store.color};">
              ${this.getStoreEmoji(store.id)}
            </div>
            <div>
              <div class="merchant-tag">🏬 Merchant Management Studio</div>
              <h2 class="merchant-store-name">${store.name}</h2>
              <div class="merchant-address">📍 ${store.address}</div>
            </div>
          </div>

          <!-- Switch Store Dropdown / Pills -->
          <div class="merchant-store-switcher">
            <label class="switcher-label">Store Location:</label>
            <div class="switcher-pills">
              ${allStores.map(s => `
                <button 
                  class="merchant-store-select-btn ${s.id === this.selectedStoreId ? 'active' : ''}" 
                  data-store-id="${s.id}"
                  title="${s.name}"
                >
                  <span>${this.getStoreEmoji(s.id)}</span> ${s.brand}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Metric KPI Cards -->
        <div id="merchantStatsHeader" class="merchant-metrics-grid">
          <!-- Rendered by renderStatsHeader() -->
        </div>

        <!-- Navigation Tabs -->
        <div class="merchant-tabs-row" role="tablist">
          <button 
            class="merchant-main-tab ${this.activeTab === 'orders' ? 'active' : ''}" 
            data-tab="orders"
            role="tab"
            aria-selected="${this.activeTab === 'orders'}"
          >
            <span>📦 Live Orders & Packing Station</span>
            <span id="merchantPendingOrdersBadge" class="tab-badge">0</span>
          </button>
          <button 
            class="merchant-main-tab ${this.activeTab === 'inventory' ? 'active' : ''}" 
            data-tab="inventory"
            role="tab"
            aria-selected="${this.activeTab === 'inventory'}"
          >
            <span>📋 Store Inventory & Pricing Database</span>
          </button>
        </div>

        <!-- Tab Panes -->
        <div class="merchant-pane-body">
          ${this.activeTab === 'orders' ? `
            <!-- ORDERS VIEW -->
            <div class="orders-view-pane">
              <div class="orders-toolbar">
                <div class="orders-filter-chips" role="radiogroup" aria-label="Filter Orders">
                  <button class="order-filter-pill ${this.orderStatusFilter === 'all' ? 'active' : ''}" data-filter="all">All Orders</button>
                  <button class="order-filter-pill ${this.orderStatusFilter === 'received' ? 'active' : ''}" data-filter="received">🔔 New (Received)</button>
                  <button class="order-filter-pill ${this.orderStatusFilter === 'preparing' ? 'active' : ''}" data-filter="preparing">⏳ In Packing</button>
                  <button class="order-filter-pill ${this.orderStatusFilter === 'ready_for_dispatch' ? 'active' : ''}" data-filter="ready_for_dispatch">🚚 Ready for Driver</button>
                  <button class="order-filter-pill ${this.orderStatusFilter === 'completed' ? 'active' : ''}" data-filter="completed">✅ Completed</button>
                </div>
                <div class="orders-notice-hint">
                  <span class="live-dot"></span> Live order sync connected
                </div>
              </div>

              <div id="merchantOrdersQueueContainer" class="orders-queue-grid">
                <!-- Dynamically rendered -->
              </div>
            </div>
          ` : `
            <!-- INVENTORY DATABASE VIEW -->
            <div class="inventory-view-pane">
              <div class="inventory-toolbar">
                <div class="inventory-search-box">
                  <span aria-hidden="true">🔍</span>
                  <input 
                    type="text" 
                    id="merchantInventorySearch" 
                    class="form-input" 
                    placeholder="Search product inventory or SKU..."
                    value="${this.inventorySearchQuery}"
                  />
                </div>

                <div class="inventory-category-box">
                  <select id="merchantCategorySelect" class="form-select">
                    <option value="all">All Departments</option>
                    <option value="produce">Fresh Produce</option>
                    <option value="bakery">Bakery & Bread</option>
                    <option value="dairy">Dairy & Eggs</option>
                    <option value="meat">Meat & Seafood</option>
                    <option value="pantry">Pantry Staples</option>
                    <option value="beverages">Beverages</option>
                    <option value="snacks">Snacks & Treats</option>
                    <option value="frozen">Frozen Foods</option>
                  </select>
                </div>

                <button id="btnOpenAddProductModal" class="btn btn-primary btn-sm">
                  <span>➕ Add New Product</span>
                </button>
              </div>

              <div id="merchantInventoryTableContainer" class="inventory-table-wrap">
                <!-- Dynamically rendered -->
              </div>
            </div>
          `}
        </div>

        ${this.renderAddProductModalHtml()}
      </div>
    `;

    this.renderStatsHeader();
    if (this.activeTab === 'orders') {
      this.renderOrdersQueue();
    } else {
      this.renderInventoryTable();
    }
  }

  renderStatsHeader() {
    const statsContainer = this.container.querySelector('#merchantStatsHeader');
    if (!statsContainer) return;

    const orders = db.getOrders({ storeId: this.selectedStoreId });
    const pendingOrders = orders.filter(o => ['received', 'preparing'].includes(o.status));
    const readyOrders = orders.filter(o => o.status === 'ready_for_dispatch');
    const completedOrders = orders.filter(o => o.status === 'delivered');
    const grossSales = orders.reduce((sum, o) => sum + o.subtotal, 0);

    const badgeEl = this.container.querySelector('#merchantPendingOrdersBadge');
    if (badgeEl) {
      badgeEl.textContent = pendingOrders.length + readyOrders.length;
    }

    statsContainer.innerHTML = `
      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Active Orders Today</span>
          <span class="metric-badge active-tag">Live</span>
        </div>
        <div class="metric-number">${pendingOrders.length + readyOrders.length}</div>
        <div class="metric-sub">${pendingOrders.length} in packing • ${readyOrders.length} awaiting pickup</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Ready for Driver</span>
          <span class="metric-badge dispatch-tag">Dispatched</span>
        </div>
        <div class="metric-number">${readyOrders.length}</div>
        <div class="metric-sub">Packed and staged for FreshRoute driver</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Completed Deliveries</span>
          <span class="metric-badge success-tag">Success</span>
        </div>
        <div class="metric-number">${completedOrders.length}</div>
        <div class="metric-sub">Delivered to Overland Park doorsteps</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <span class="metric-title">Store Gross Revenue</span>
          <span class="metric-badge revenue-tag">Sales</span>
        </div>
        <div class="metric-number">$${grossSales.toFixed(2)}</div>
        <div class="metric-sub">Direct grocery orders via FreshRoute</div>
      </div>
    `;
  }

  renderOrdersQueue() {
    const container = this.container.querySelector('#merchantOrdersQueueContainer');
    if (!container) return;

    let orders = db.getOrders({ storeId: this.selectedStoreId });

    if (this.orderStatusFilter === 'received') {
      orders = orders.filter(o => o.status === 'received');
    } else if (this.orderStatusFilter === 'preparing') {
      orders = orders.filter(o => o.status === 'preparing');
    } else if (this.orderStatusFilter === 'ready_for_dispatch') {
      orders = orders.filter(o => o.status === 'ready_for_dispatch');
    } else if (this.orderStatusFilter === 'completed') {
      orders = orders.filter(o => ['in_transit', 'delivered'].includes(o.status));
    }

    // Highlight active filter pill
    const pills = this.container.querySelectorAll('.order-filter-pill');
    pills.forEach(p => {
      p.classList.toggle('active', p.dataset.filter === this.orderStatusFilter);
    });

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-orders-card">
          <div class="empty-icon">🛒</div>
          <h4>No orders in this view</h4>
          <p>No orders currently match the "${this.orderStatusFilter}" filter. Place a new order in the Customer Shop tab to see it appear here immediately!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => this.renderOrderCard(order)).join('');
  }

  renderOrderCard(order) {
    const totalItemsCount = order.items.reduce((s, it) => s + it.quantity, 0);
    const packedCount = order.items.filter(it => it.packed).length;
    const allPacked = packedCount === order.items.length;
    const progressPercent = Math.round((packedCount / order.items.length) * 100);

    const statusBadgeMap = {
      received: { label: '🔔 New Order Placed', class: 'badge-received' },
      preparing: { label: '⏳ Staff Packing Bags', class: 'badge-preparing' },
      ready_for_dispatch: { label: '🚚 Staged for Driver', class: 'badge-ready' },
      in_transit: { label: '🚗 Driver En Route', class: 'badge-transit' },
      delivered: { label: '✅ Delivered to Customer', class: 'badge-delivered' }
    };

    const statusInfo = statusBadgeMap[order.status] || { label: order.status, class: '' };

    return `
      <article class="merchant-order-card ${order.status === 'received' ? 'pulse-attention' : ''}">
        <!-- Order Card Header -->
        <div class="order-card-top">
          <div class="order-meta-info">
            <span class="order-id-tag">${order.orderNumber}</span>
            <span class="order-time-text">⏱️ ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            ${order.deliverySlot ? `<span class="order-slot-tag" title="Delivery batch">🛵 ${order.deliverySlot.deliveryLabel}</span>` : ''}
          </div>
          <span class="order-status-badge ${statusInfo.class}">${statusInfo.label}</span>
        </div>

        <!-- Customer & Delivery Info ("Who ordered what") -->
        <div class="order-customer-box">
          <div class="customer-name-row">
            <strong>👤 ${order.customer.name}</strong>
            <span class="customer-phone">${order.customer.phone}</span>
          </div>
          <div class="customer-address-row">
            📍 ${order.customer.address}
          </div>
          ${order.customer.notes ? `
            <div class="customer-notes-callout">
              📝 <em>"${order.customer.notes}"</em>
            </div>
          ` : ''}
        </div>

        <!-- Perishable Notice if applicable -->
        ${order.hasPerishable ? `
          <div class="perishable-warning-pill">
            <span>❄️</span>
            <span><strong>Chilled Items Inside:</strong> Pack with insulated foil liners & ice packs.</span>
          </div>
        ` : ''}

        <!-- Itemized Packing Checklist -->
        <div class="packing-checklist-section">
          <div class="checklist-header">
            <span class="checklist-title">Itemized Grocery Packing Checklist:</span>
            <span class="checklist-counter">${packedCount} / ${order.items.length} items packed (${progressPercent}%)</span>
          </div>

          <div class="checklist-progress-bar">
            <div class="checklist-progress-fill" style="width: ${progressPercent}%"></div>
          </div>

          <div class="checklist-items-list">
            ${order.items.map((it, idx) => `
              <label class="packing-item-row ${it.packed ? 'packed' : ''}">
                <input 
                  type="checkbox" 
                  class="pack-item-checkbox" 
                  data-order-id="${order.id}" 
                  data-item-idx="${idx}"
                  ${it.packed ? 'checked' : ''}
                />
                <span class="item-name-text">
                  <strong>${it.quantity}x</strong> ${it.name}
                  ${it.isPerishable ? '<span class="item-perish-badge">❄️ Cold</span>' : ''}
                </span>
                <span class="item-cost-text">$${(it.price * it.quantity).toFixed(2)}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Packaging & Bag Configuration -->
        <div class="packaging-config-row">
          <div class="bag-counter-wrap">
            <span class="bag-label">🛍️ Insulated Bags:</span>
            <div class="bag-stepper">
              <button class="bag-btn bag-count-minus" data-order-id="${order.id}">−</button>
              <span class="bag-val">${order.bagsCount}</span>
              <button class="bag-btn bag-count-plus" data-order-id="${order.id}">+</button>
            </div>
          </div>
          <div class="order-total-badge">
            Subtotal: <strong>$${order.subtotal.toFixed(2)}</strong>
          </div>
        </div>

        <!-- Workflow Action Buttons -->
        <div class="order-card-actions">
          ${order.status === 'received' ? `
            <button class="btn btn-primary w-full btn-start-packing" data-order-id="${order.id}">
              <span>📦 Accept & Start Packing</span>
            </button>
          ` : (order.status === 'preparing' || order.status === 'packed') ? `
            <button class="btn btn-accent w-full btn-request-driver" data-order-id="${order.id}">
              <span>🚀 Mark Packed & Request FreshRoute Driver</span>
            </button>
          ` : order.status === 'ready_for_dispatch' ? `
            <div class="awaiting-driver-banner">
              <span>⏳ Ready for pickup! FreshRoute Driver notified.</span>
              <button class="btn btn-secondary btn-sm btn-jump-driver" data-order-id="${order.id}">
                <span>View on Driver Map →</span>
              </button>
            </div>
          ` : order.status === 'in_transit' ? `
            <div class="en-route-banner">
              <span>🚚 Driver picked up this package & is en route!</span>
            </div>
          ` : `
            <div class="delivered-banner">
              <span>✅ Successfully delivered to customer!</span>
            </div>
          `}
        </div>
      </article>
    `;
  }

  renderInventoryTable() {
    const container = this.container.querySelector('#merchantInventoryTableContainer');
    if (!container) return;

    let items = db.getStoreInventory(this.selectedStoreId);

    if (this.inventoryCategoryFilter !== 'all') {
      items = items.filter(it => it.category === this.inventoryCategoryFilter);
    }

    if (this.inventorySearchQuery) {
      items = items.filter(it => 
        it.name.toLowerCase().includes(this.inventorySearchQuery) ||
        (it.badge && it.badge.toLowerCase().includes(this.inventorySearchQuery))
      );
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-inventory-message">
          <p>No products match "${this.inventorySearchQuery || this.inventoryCategoryFilter}".</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="merchant-inventory-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Department</th>
            <th>Unit Price</th>
            <th>Stock Count</th>
            <th>Cold Chain</th>
            <th>Availability</th>
            <th>Quick Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr class="${!item.inStock ? 'row-out-stock' : ''}">
              <td>
                <div class="table-product-cell">
                  <span class="cell-emoji">${item.emoji || '🛒'}</span>
                  <div>
                    <strong>${item.name}</strong>
                    ${item.badge ? `<span class="cell-badge">${item.badge}</span>` : ''}
                    <div class="cell-unit">${item.unit}</div>
                  </div>
                </div>
              </td>
              <td><span class="cat-tag">${item.category}</span></td>
              <td>
                <span class="price-val">$${item.price.toFixed(2)}</span>
              </td>
              <td>
                <span class="stock-val ${item.stock < 10 ? 'low-stock' : ''}">${item.stock} in stock</span>
              </td>
              <td>
                ${item.isPerishable ? '<span class="cell-perish">❄️ Perishable</span>' : '<span class="cell-ambient">Ambient</span>'}
              </td>
              <td>
                <button 
                  class="btn btn-sm product-stock-toggle ${item.inStock ? 'btn-in-stock' : 'btn-out-stock'}" 
                  data-prod-id="${item.id}"
                >
                  ${item.inStock ? '● In Stock' : '✕ Out of Stock'}
                </button>
              </td>
              <td>
                <button class="btn btn-sm btn-outline btn-edit-price" data-prod-id="${item.id}" title="Update item price in database">
                  <span>✏️ Edit Price</span>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  renderAddProductModalHtml() {
    return `
      <!-- Add New Product to Inventory Modal -->
      <div id="merchantAddProductModal" class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Add Product to Store Database</h3>
              <p class="modal-subtitle">Will immediately appear in Customer Storefront</p>
            </div>
            <button id="btnCloseAddProductModal" class="btn btn-icon btn-sm">✕</button>
          </div>

          <form id="merchantAddProductForm" class="modal-body">
            <div class="form-row-2">
              <div class="form-group">
                <label for="newProdName" class="form-label">Product Name</label>
                <input type="text" id="newProdName" class="form-input" placeholder="e.g. Organic Blackberries" required />
              </div>
              <div class="form-group">
                <label for="newProdCategory" class="form-label">Department / Category</label>
                <select id="newProdCategory" class="form-select">
                  <option value="produce">Fresh Produce</option>
                  <option value="bakery">Bakery & Bread</option>
                  <option value="dairy">Dairy & Eggs</option>
                  <option value="meat">Meat & Seafood</option>
                  <option value="pantry">Pantry Staples</option>
                  <option value="beverages">Beverages</option>
                  <option value="snacks">Snacks & Treats</option>
                  <option value="frozen">Frozen Foods</option>
                </select>
              </div>
            </div>

            <div class="form-row-3">
              <div class="form-group">
                <label for="newProdPrice" class="form-label">Price ($)</label>
                <input type="number" step="0.01" id="newProdPrice" class="form-input" placeholder="4.99" required />
              </div>
              <div class="form-group">
                <label for="newProdUnit" class="form-label">Unit / Packaging</label>
                <input type="text" id="newProdUnit" class="form-input" placeholder="6 oz clamshell" required />
              </div>
              <div class="form-group">
                <label for="newProdStock" class="form-label">Initial Stock</label>
                <input type="number" id="newProdStock" class="form-input" value="30" required />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label for="newProdEmoji" class="form-label">Product Emoji</label>
                <input type="text" id="newProdEmoji" class="form-input" value="🫐" />
              </div>
              <div class="form-group">
                <label for="newProdBadge" class="form-label">Badge / Tag (e.g. Organic, Sale)</label>
                <input type="text" id="newProdBadge" class="form-input" value="Organic" />
              </div>
            </div>

            <div class="form-group">
              <label for="newProdDesc" class="form-label">Description</label>
              <textarea id="newProdDesc" class="form-input" rows="2" placeholder="Freshly harvested berries..."></textarea>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="newProdPerishable" checked />
                <span>❄️ Requires Cold-Chain Storage & Insulated Bag</span>
              </label>
            </div>

            <div class="modal-footer">
              <button type="button" id="btnCancelAddProduct" class="btn btn-outline">Cancel</button>
              <button type="submit" class="btn btn-primary">
                <span>Save to Store Inventory</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  getStoreEmoji(storeId) {
    switch (storeId) {
      case 'royal_spices': return '🌾';
      case 'reliance_mart': return '🍚';
      case 'kc_indian_mart': return '🌶️';
      case 'taj_groceries': return '🫓';
      case 'tt_asian_grocery': return '🍬';
      default: return '🏬';
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
