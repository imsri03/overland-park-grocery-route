/**
 * CustomerPortal.js - FreshRoute Customer Marketplace & Ordering Interface
 * Allows Overland Park customers to choose nearby grocery stores, browse inventory,
 * build cart, checkout with local delivery address, and track delivery in real time.
 */

import { db } from '../services/db.js';
import { PRESET_CUSTOMER_ADDRESSES } from '../data/inventoryData.js';
import confetti from 'canvas-confetti';

export class CustomerPortal {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.onViewOrderInDriver = options.onViewOrderInDriver || null;
    this.onViewOrderInMerchant = options.onViewOrderInMerchant || null;
    this.showToast = options.showToast || console.log;

    this.selectedStore = null;
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.cart = []; // [{ item, quantity }]
    this.activeTrackingOrder = null;

    this.init();
  }

  init() {
    this.render();
    this.setupListeners();

    // Subscribe to DB updates for live order tracking or inventory changes
    this.unsubscribe = db.subscribe((type, payload) => {
      if (type === 'order:status_changed' && this.activeTrackingOrder) {
        if (this.activeTrackingOrder.id === payload.orderId) {
          this.activeTrackingOrder = payload.order;
          this.updateTrackingModalContent();
        }
      } else if (type === 'product:updated' || type === 'product:added') {
        if (this.selectedStore) {
          this.renderStoreCatalog();
        }
      }
    });
  }

  setupListeners() {
    // Delegated click listeners
    this.container.addEventListener('click', (e) => {
      // Store card click
      const storeCard = e.target.closest('.customer-store-card');
      if (storeCard && !e.target.closest('.btn-store-action')) {
        const storeId = storeCard.dataset.storeId;
        this.selectStore(storeId);
        return;
      }

      // Enter store button
      const enterStoreBtn = e.target.closest('.btn-enter-store');
      if (enterStoreBtn) {
        const storeId = enterStoreBtn.dataset.storeId;
        this.selectStore(storeId);
        return;
      }

      // Back to store picker
      if (e.target.closest('#btnBackToStores')) {
        this.selectedStore = null;
        this.render();
        return;
      }

      // Add to cart button
      const addBtn = e.target.closest('.btn-add-cart');
      if (addBtn) {
        const itemId = addBtn.dataset.itemId;
        this.addToCart(itemId);
        return;
      }

      // Quantity adjustments in catalog or cart
      const qtyPlusBtn = e.target.closest('.qty-btn-plus');
      if (qtyPlusBtn) {
        const itemId = qtyPlusBtn.dataset.itemId;
        this.updateCartQuantity(itemId, 1);
        return;
      }

      const qtyMinusBtn = e.target.closest('.qty-btn-minus');
      if (qtyMinusBtn) {
        const itemId = qtyMinusBtn.dataset.itemId;
        this.updateCartQuantity(itemId, -1);
        return;
      }

      // Category filter pill
      const catPill = e.target.closest('.cat-pill');
      if (catPill) {
        this.selectedCategory = catPill.dataset.cat;
        this.renderStoreCatalog();
        return;
      }

      // Open cart drawer
      if (e.target.closest('#btnOpenCartDrawer') || e.target.closest('.floating-cart-bar')) {
        this.toggleCartDrawer(true);
        return;
      }

      // Close cart drawer
      if (e.target.closest('#btnCloseCartDrawer') || e.target.closest('.cart-drawer-backdrop')) {
        this.toggleCartDrawer(false);
        return;
      }

      // Open checkout modal
      if (e.target.closest('#btnProceedCheckout')) {
        this.openCheckoutModal();
        return;
      }

      // Close checkout modal
      if (e.target.closest('#btnCloseCheckoutModal') || e.target.closest('#btnCancelCheckout')) {
        this.closeCheckoutModal();
        return;
      }

      // Close tracking modal
      if (e.target.closest('#btnCloseTrackingModal')) {
        this.closeTrackingModal();
        return;
      }

      // Preset address select chip
      const presetChip = e.target.closest('.preset-address-chip');
      if (presetChip) {
        const index = parseInt(presetChip.dataset.index, 10);
        this.applyPresetAddress(index);
        return;
      }

      // Quick jump to Merchant portal from Tracking modal
      if (e.target.closest('#btnJumpToMerchant')) {
        this.closeTrackingModal();
        if (this.onViewOrderInMerchant && this.activeTrackingOrder) {
          this.onViewOrderInMerchant(this.activeTrackingOrder);
        }
        return;
      }

      // Quick jump to Driver portal from Tracking modal
      if (e.target.closest('#btnJumpToDriver')) {
        this.closeTrackingModal();
        if (this.onViewOrderInDriver && this.activeTrackingOrder) {
          this.onViewOrderInDriver(this.activeTrackingOrder);
        }
        return;
      }
    });

    // Search and filter inputs
    this.container.addEventListener('input', (e) => {
      if (e.target.id === 'catalogSearchInput') {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderCatalogProductsList();
      }
    });

    // Tip selection
    this.container.addEventListener('change', (e) => {
      if (e.target.name === 'driverTipOption') {
        this.renderCartSummary();
      }
    });

    // Checkout form submit
    this.container.addEventListener('submit', (e) => {
      if (e.target.id === 'customerCheckoutForm') {
        e.preventDefault();
        this.handleCheckoutSubmit();
      }
    });
  }

  selectStore(storeId) {
    this.selectedStore = db.getStore(storeId);
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.renderStoreCatalog();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  addToCart(itemId) {
    if (!this.selectedStore) return;
    const inventory = db.getStoreInventory(this.selectedStore.id);
    const item = inventory.find(p => p.id === itemId);
    if (!item) return;

    const existing = this.cart.find(c => c.item.id === itemId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({ item, quantity: 1 });
    }

    this.showToast(`Added ${item.name} to FreshRoute cart!`, '🛒');
    this.renderCatalogProductsList();
    this.updateCartBadges();
    this.renderCartDrawerContent();
  }

  updateCartQuantity(itemId, delta) {
    const idx = this.cart.findIndex(c => c.item.id === itemId);
    if (idx === -1) return;

    this.cart[idx].quantity += delta;
    if (this.cart[idx].quantity <= 0) {
      this.cart.splice(idx, 1);
    }

    this.renderCatalogProductsList();
    this.updateCartBadges();
    this.renderCartDrawerContent();
  }

  getCartSubtotal() {
    return this.cart.reduce((sum, entry) => sum + (entry.item.price * entry.quantity), 0);
  }

  getSelectedTip() {
    const checked = this.container.querySelector('input[name="driverTipOption"]:checked');
    if (!checked) return 3.50;
    return parseFloat(checked.value) || 0;
  }

  updateCartBadges() {
    const totalCount = this.cart.reduce((sum, c) => sum + c.quantity, 0);
    const subtotal = this.getCartSubtotal();

    const badgeEls = this.container.querySelectorAll('.cart-count-badge');
    badgeEls.forEach(el => {
      el.textContent = totalCount;
      el.style.display = totalCount > 0 ? 'inline-flex' : 'none';
    });

    const floatingBar = this.container.querySelector('#customerFloatingCart');
    if (floatingBar) {
      if (totalCount > 0 && this.selectedStore) {
        floatingBar.classList.add('visible');
        floatingBar.querySelector('.floating-cart-total').textContent = `$${subtotal.toFixed(2)}`;
        floatingBar.querySelector('.floating-cart-items-text').textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;
      } else {
        floatingBar.classList.remove('visible');
      }
    }
  }

  toggleCartDrawer(open) {
    const drawer = this.container.querySelector('#customerCartDrawer');
    if (!drawer) return;
    if (open) {
      this.renderCartDrawerContent();
      drawer.classList.add('open');
      document.body.classList.add('modal-open');
    } else {
      drawer.classList.remove('open');
      document.body.classList.remove('modal-open');
    }
  }

  openCheckoutModal() {
    if (this.cart.length === 0) {
      alert('Your cart is empty! Add some groceries first.');
      return;
    }
    this.toggleCartDrawer(false);
    const modal = this.container.querySelector('#customerCheckoutModal');
    if (modal) {
      this.populateCheckoutForm();
      modal.classList.add('active');
      document.body.classList.add('modal-open');
    }
  }

  closeCheckoutModal() {
    const modal = this.container.querySelector('#customerCheckoutModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
  }

  populateCheckoutForm() {
    const subtotal = this.getCartSubtotal();
    const tip = this.getSelectedTip();
    const total = subtotal + tip;

    const subtotalEl = this.container.querySelector('#checkoutModalSubtotal');
    const totalEl = this.container.querySelector('#checkoutModalTotal');
    const storeNameEl = this.container.querySelector('#checkoutModalStoreName');

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;
    if (storeNameEl && this.selectedStore) storeNameEl.textContent = this.selectedStore.name;

    // Default to first preset if empty
    const nameInput = this.container.querySelector('#checkoutCustomerName');
    const addrInput = this.container.querySelector('#checkoutCustomerAddress');
    const phoneInput = this.container.querySelector('#checkoutCustomerPhone');
    const notesInput = this.container.querySelector('#checkoutCustomerNotes');

    if (nameInput && !nameInput.value) nameInput.value = PRESET_CUSTOMER_ADDRESSES[0].name.split(' (')[0];
    if (addrInput && !addrInput.value) {
      addrInput.value = PRESET_CUSTOMER_ADDRESSES[0].address;
      addrInput.dataset.lat = PRESET_CUSTOMER_ADDRESSES[0].lat;
      addrInput.dataset.lng = PRESET_CUSTOMER_ADDRESSES[0].lng;
    }
    if (phoneInput && !phoneInput.value) phoneInput.value = PRESET_CUSTOMER_ADDRESSES[0].phone;
    if (notesInput && !notesInput.value) notesInput.value = PRESET_CUSTOMER_ADDRESSES[0].notes;
  }

  applyPresetAddress(index) {
    const preset = PRESET_CUSTOMER_ADDRESSES[index];
    if (!preset) return;

    const nameInput = this.container.querySelector('#checkoutCustomerName');
    const addrInput = this.container.querySelector('#checkoutCustomerAddress');
    const phoneInput = this.container.querySelector('#checkoutCustomerPhone');
    const notesInput = this.container.querySelector('#checkoutCustomerNotes');

    if (nameInput) nameInput.value = preset.name.split(' (')[0];
    if (addrInput) {
      addrInput.value = preset.address;
      addrInput.dataset.lat = preset.lat;
      addrInput.dataset.lng = preset.lng;
    }
    if (phoneInput) phoneInput.value = preset.phone;
    if (notesInput) notesInput.value = preset.notes;

    // Highlight selected chip
    const chips = this.container.querySelectorAll('.preset-address-chip');
    chips.forEach((c, idx) => {
      c.classList.toggle('active', idx === index);
    });
  }

  handleCheckoutSubmit() {
    const name = this.container.querySelector('#checkoutCustomerName').value.trim();
    const address = this.container.querySelector('#checkoutCustomerAddress').value.trim();
    const phone = this.container.querySelector('#checkoutCustomerPhone').value.trim();
    const notes = this.container.querySelector('#checkoutCustomerNotes').value.trim();
    const addrInput = this.container.querySelector('#checkoutCustomerAddress');

    let lat = parseFloat(addrInput.dataset.lat) || 38.9832;
    let lng = parseFloat(addrInput.dataset.lng) || -94.6698;

    const subtotal = this.getCartSubtotal();
    const tip = this.getSelectedTip();
    const total = subtotal + tip;

    const orderData = {
      storeId: this.selectedStore.id,
      customer: {
        name: name || 'Overland Park Resident',
        phone: phone || '(913) 555-0100',
        address: address || '8001 Conser St, Overland Park, KS 66204',
        lat,
        lng,
        notes
      },
      items: this.cart.map(c => ({
        id: c.item.id,
        name: c.item.name,
        price: c.item.price,
        quantity: c.quantity,
        isPerishable: c.item.isPerishable
      })),
      subtotal,
      deliveryFee: 0,
      tip,
      total
    };

    const newOrder = db.createOrder(orderData);
    this.closeCheckoutModal();

    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // Confetti fallback
    }

    this.showToast(`Order ${newOrder.orderNumber} placed successfully!`, '🎉');

    // Clear cart
    this.cart = [];
    this.updateCartBadges();
    this.renderCatalogProductsList();

    // Open live tracking modal
    this.openTrackingModal(newOrder);
  }

  openTrackingModal(order) {
    this.activeTrackingOrder = order;
    const modal = this.container.querySelector('#customerTrackingModal');
    if (modal) {
      this.updateTrackingModalContent();
      modal.classList.add('active');
      document.body.classList.add('modal-open');
    }
  }

  closeTrackingModal() {
    const modal = this.container.querySelector('#customerTrackingModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
  }

  updateTrackingModalContent() {
    if (!this.activeTrackingOrder) return;
    const order = this.activeTrackingOrder;

    const numberEl = this.container.querySelector('#trackOrderNumber');
    const storeEl = this.container.querySelector('#trackStoreName');
    const addrEl = this.container.querySelector('#trackCustomerAddress');
    const totalEl = this.container.querySelector('#trackTotalAmount');
    const statusPill = this.container.querySelector('#trackStatusPill');
    const timelineContainer = this.container.querySelector('#trackTimelineSteps');
    const itemsListContainer = this.container.querySelector('#trackItemsSummaryList');

    if (numberEl) numberEl.textContent = order.orderNumber;
    if (storeEl) storeEl.textContent = order.storeName;
    if (addrEl) addrEl.textContent = order.customer.address;
    if (totalEl) totalEl.textContent = `$${order.total.toFixed(2)}`;

    // Status mapping & step indicators
    const statusMap = {
      received: { label: 'Order Received', icon: '📝', stepIndex: 1, class: 'status-received' },
      preparing: { label: 'Merchant Packing', icon: '🏬', stepIndex: 2, class: 'status-preparing' },
      packed: { label: 'Packed & Ready', icon: '📦', stepIndex: 3, class: 'status-packed' },
      ready_for_dispatch: { label: 'Awaiting Driver', icon: '⏳', stepIndex: 3, class: 'status-dispatch' },
      in_transit: { label: 'Driver En Route', icon: '🚚', stepIndex: 4, class: 'status-transit' },
      delivered: { label: 'Delivered!', icon: '✅', stepIndex: 5, class: 'status-delivered' }
    };

    const currentInfo = statusMap[order.status] || { label: order.status, icon: '📦', stepIndex: 1 };
    if (statusPill) {
      statusPill.innerHTML = `<span>${currentInfo.icon}</span> ${currentInfo.label}`;
      statusPill.className = `status-pill ${currentInfo.class || ''}`;
    }

    // Step progress
    const steps = [
      { num: 1, title: 'Received', desc: 'Order sent to store' },
      { num: 2, title: 'Preparing', desc: 'Picking fresh groceries' },
      { num: 3, title: 'Packed', desc: `${order.bagsCount} bags bagged & tagged` },
      { num: 4, title: 'Out for Delivery', desc: 'FreshRoute driver en route' },
      { num: 5, title: 'Delivered', desc: 'At your doorstep' }
    ];

    if (timelineContainer) {
      timelineContainer.innerHTML = steps.map(s => {
        const isDone = s.num < currentInfo.stepIndex;
        const isCurrent = s.num === currentInfo.stepIndex;
        const statusClass = isDone ? 'step-done' : (isCurrent ? 'step-current' : 'step-pending');
        return `
          <div class="tracking-step ${statusClass}">
            <div class="step-bullet">${isDone ? '✓' : s.num}</div>
            <div class="step-text">
              <div class="step-title">${s.title}</div>
              <div class="step-desc">${s.desc}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    if (itemsListContainer) {
      itemsListContainer.innerHTML = order.items.map(it => `
        <div class="track-item-row">
          <span class="track-item-name">${it.quantity}x ${it.name}</span>
          <span class="track-item-price">$${(it.price * it.quantity).toFixed(2)}</span>
        </div>
      `).join('');
    }
  }

  // --- RENDERING ---

  render() {
    if (this.selectedStore) {
      this.renderStoreCatalog();
    } else {
      this.renderStorePicker();
    }
  }

  renderStorePicker() {
    const stores = db.getStores();

    this.container.innerHTML = `
      <div class="customer-view-container animate-fade-in">
        <!-- Hero Header -->
        <div class="customer-hero">
          <div class="hero-badge">
            <span class="live-dot"></span> Overland Park Local Grocery Delivery
          </div>
          <h2 class="hero-title">Select a Store Near You in Overland Park</h2>
          <p class="hero-subtitle">
            Order fresh produce, bakery, meats, and pantry essentials from top Overland Park grocers.
            Delivered directly to your door with real-time temperature tracking.
          </p>
          
          <div class="hero-stats-row">
            <div class="hero-stat-pill">
              <span class="stat-icon">🏬</span>
              <span><strong>6 Local Hubs</strong> in OP & Johnson Co.</span>
            </div>
            <div class="hero-stat-pill">
              <span class="stat-icon">⚡</span>
              <span><strong>25-35 Min</strong> Average Delivery Time</span>
            </div>
            <div class="hero-stat-pill">
              <span class="stat-icon">❄️</span>
              <span><strong>Insulated Bags</strong> for Cold Goods</span>
            </div>
          </div>
        </div>

        <!-- Stores Grid -->
        <div class="stores-section">
          <div class="stores-section-header">
            <h3 class="section-title">Available Overland Park Store Depots</h3>
            <span class="stores-count-tag">${stores.length} Stores Available</span>
          </div>

          <div class="stores-grid">
            ${stores.map(store => this.renderStoreCard(store)).join('')}
          </div>
        </div>

        ${this.renderCustomerModalsHtml()}
      </div>
    `;
  }

  renderStoreCard(store) {
    return `
      <article class="customer-store-card" data-store-id="${store.id}" style="--brand-color: ${store.color}">
        <div class="store-card-header">
          <div class="store-brand-avatar" style="background-color: ${store.color}15; color: ${store.color}; border-color: ${store.color}35;">
            ${this.getStoreEmoji(store.id)}
          </div>
          <div class="store-badge-tag">${store.categoryTag}</div>
        </div>

        <div class="store-card-body">
          <h4 class="store-title">${store.name}</h4>
          <p class="store-tagline">${store.tagline}</p>
          <div class="store-address-line">
            <span aria-hidden="true">📍</span> ${store.address}
          </div>

          <div class="store-metrics-row">
            <div class="store-metric-item">
              <span class="metric-star">★</span> <strong>${store.rating}</strong>
              <span class="metric-muted">(${store.reviews})</span>
            </div>
            <div class="store-metric-divider">•</div>
            <div class="store-metric-item">
              <span>⏱️ ${store.estDeliveryMins}</span>
            </div>
            <div class="store-metric-divider">•</div>
            <div class="store-metric-item">
              <span class="metric-free">Free Delivery</span>
            </div>
          </div>
        </div>

        <div class="store-card-footer">
          <button class="btn btn-primary btn-enter-store w-full" data-store-id="${store.id}">
            <span>Shop Groceries</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </article>
    `;
  }

  renderStoreCatalog() {
    if (!this.selectedStore) return;
    const store = this.selectedStore;
    const inventory = db.getStoreInventory(store.id);

    const categories = [
      { id: 'all', label: 'All Items', icon: '🛒' },
      { id: 'produce', label: 'Fresh Produce', icon: '🥦' },
      { id: 'bakery', label: 'Bakery & Bread', icon: '🥖' },
      { id: 'dairy', label: 'Dairy & Eggs', icon: '🥛' },
      { id: 'meat', label: 'Meat & Seafood', icon: '🥩' },
      { id: 'pantry', label: 'Pantry Staples', icon: '🥫' },
      { id: 'beverages', label: 'Beverages', icon: '🧃' },
      { id: 'snacks', label: 'Snacks & Treats', icon: '🍿' },
      { id: 'frozen', label: 'Frozen Foods', icon: '🍦' }
    ];

    this.container.innerHTML = `
      <div class="customer-catalog-view animate-fade-in">
        <!-- Store Banner Header -->
        <div class="catalog-header" style="--store-color: ${store.color}">
          <button id="btnBackToStores" class="btn btn-outline btn-sm btn-back">
            <span aria-hidden="true">←</span> All Overland Park Stores
          </button>

          <div class="catalog-brand-info">
            <div class="catalog-brand-avatar" style="background-color: ${store.color}25; color: ${store.color};">
              ${this.getStoreEmoji(store.id)}
            </div>
            <div class="catalog-brand-text">
              <div class="catalog-badge-pill">${store.categoryTag} • ${store.badge}</div>
              <h2 class="catalog-store-name">${store.name}</h2>
              <div class="catalog-meta-row">
                <span>📍 ${store.address}</span>
                <span>•</span>
                <span>⭐ ${store.rating} (${store.reviews} reviews)</span>
                <span>•</span>
                <span>⚡ Delivery in ${store.estDeliveryMins}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="catalog-toolbar">
          <div class="catalog-search-wrap">
            <span class="search-icon" aria-hidden="true">🔍</span>
            <input 
              type="text" 
              id="catalogSearchInput" 
              class="catalog-search-input" 
              placeholder="Search apples, milk, artisan sourdough, steaks..."
              value="${this.searchQuery}"
            />
          </div>

          <div class="catalog-cart-trigger">
            <button id="btnOpenCartDrawer" class="btn btn-primary btn-sm">
              <span>🛒 Cart</span>
              <span class="cart-count-badge" style="display: ${this.cart.length > 0 ? 'inline-flex' : 'none'}">
                ${this.cart.reduce((sum, c) => sum + c.quantity, 0)}
              </span>
            </button>
          </div>
        </div>

        <!-- Category Pills -->
        <div class="category-pills-scroll" role="tablist" aria-label="Grocery Departments">
          ${categories.map(cat => `
            <button 
              class="cat-pill ${this.selectedCategory === cat.id ? 'active' : ''}" 
              data-cat="${cat.id}"
              role="tab"
              aria-selected="${this.selectedCategory === cat.id}"
            >
              <span>${cat.icon}</span> ${cat.label}
            </button>
          `).join('')}
        </div>

        <!-- Products Grid Container -->
        <div id="catalogProductsContainer" class="catalog-products-grid">
          <!-- Filled dynamically by renderCatalogProductsList() -->
        </div>

        <!-- Floating Cart Bar (Mobile/Quick access) -->
        <div id="customerFloatingCart" class="floating-cart-bar">
          <div class="floating-cart-info">
            <div class="floating-cart-items-text">0 items</div>
            <div class="floating-cart-total">$0.00</div>
          </div>
          <button class="btn btn-accent btn-sm" id="btnViewCartFloating">
            <span>View Cart</span>
            <span>🛒</span>
          </button>
        </div>

        ${this.renderCustomerModalsHtml()}
      </div>
    `;

    this.renderCatalogProductsList();
    this.updateCartBadges();
  }

  renderCatalogProductsList() {
    const container = this.container.querySelector('#catalogProductsContainer');
    if (!container || !this.selectedStore) return;

    let items = db.getStoreInventory(this.selectedStore.id);

    // Filter by department
    if (this.selectedCategory !== 'all') {
      items = items.filter(it => it.category === this.selectedCategory);
    }

    // Filter by search
    if (this.searchQuery) {
      items = items.filter(it => 
        it.name.toLowerCase().includes(this.searchQuery) ||
        (it.description && it.description.toLowerCase().includes(this.searchQuery)) ||
        (it.badge && it.badge.toLowerCase().includes(this.searchQuery))
      );
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-products-state">
          <div class="empty-icon">🥬</div>
          <h4>No products found</h4>
          <p>No items matched "${this.searchQuery || this.selectedCategory}". Try selecting another department or clearing your search.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => {
      const inCartEntry = this.cart.find(c => c.item.id === item.id);
      const inCartQty = inCartEntry ? inCartEntry.quantity : 0;

      return `
        <div class="product-card ${!item.inStock ? 'out-of-stock' : ''}">
          <div class="product-top-row">
            <span class="product-emoji">${item.emoji || '🛒'}</span>
            ${item.badge ? `<span class="product-badge">${item.badge}</span>` : ''}
            ${item.isPerishable ? `<span class="product-perishable-badge" title="Cold storage required">❄️ Chilled</span>` : ''}
          </div>

          <div class="product-info">
            <h4 class="product-name">${item.name}</h4>
            <p class="product-desc">${item.description || ''}</p>
            <div class="product-unit-text">${item.unit}</div>
          </div>

          <div class="product-bottom-row">
            <div class="product-price-wrap">
              <span class="product-price">$${item.price.toFixed(2)}</span>
            </div>

            <div class="product-actions">
              ${!item.inStock ? `
                <span class="out-of-stock-label">Out of Stock</span>
              ` : (inCartQty > 0 ? `
                <div class="qty-stepper-widget">
                  <button class="qty-btn qty-btn-minus" data-item-id="${item.id}" aria-label="Decrease quantity">−</button>
                  <span class="qty-value">${inCartQty}</span>
                  <button class="qty-btn qty-btn-plus" data-item-id="${item.id}" aria-label="Increase quantity">+</button>
                </div>
              ` : `
                <button class="btn btn-sm btn-primary btn-add-cart" data-item-id="${item.id}">
                  <span>+ Add</span>
                </button>
              `)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderCartDrawerContent() {
    const listContainer = this.container.querySelector('#cartDrawerItemsList');
    if (!listContainer) return;

    if (this.cart.length === 0) {
      listContainer.innerHTML = `
        <div class="cart-empty-message">
          <div class="empty-icon">🛒</div>
          <p>Your grocery basket is empty.</p>
          <span class="muted-text">Browse the aisles and add fresh items to order!</span>
        </div>
      `;
      this.renderCartSummary();
      return;
    }

    listContainer.innerHTML = this.cart.map(entry => {
      const it = entry.item;
      const rowTotal = (it.price * entry.quantity).toFixed(2);
      return `
        <div class="cart-item-row">
          <span class="cart-item-emoji">${it.emoji || '🛒'}</span>
          <div class="cart-item-details">
            <div class="cart-item-title">${it.name}</div>
            <div class="cart-item-sub">
              $${it.price.toFixed(2)} / ${it.unit}
              ${it.isPerishable ? '<span class="perish-tag">❄️ Chilled</span>' : ''}
            </div>
          </div>
          <div class="cart-item-right">
            <div class="qty-stepper-widget compact">
              <button class="qty-btn qty-btn-minus" data-item-id="${it.id}">−</button>
              <span class="qty-value">${entry.quantity}</span>
              <button class="qty-btn qty-btn-plus" data-item-id="${it.id}">+</button>
            </div>
            <div class="cart-item-cost">$${rowTotal}</div>
          </div>
        </div>
      `;
    }).join('');

    this.renderCartSummary();
  }

  renderCartSummary() {
    const subtotal = this.getCartSubtotal();
    const tip = this.getSelectedTip();
    const deliveryFee = 0.00;
    const total = subtotal + tip + deliveryFee;

    const subtotalEl = this.container.querySelector('#cartSummarySubtotal');
    const totalEl = this.container.querySelector('#cartSummaryTotal');
    const perishNotice = this.container.querySelector('#cartPerishableNotice');

    if (subtotalEl) subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${total.toFixed(2)}`;

    const hasPerish = this.cart.some(c => c.item.isPerishable);
    if (perishNotice) {
      perishNotice.style.display = hasPerish ? 'flex' : 'none';
    }
  }

  renderCustomerModalsHtml() {
    return `
      <!-- Cart Slide-Over Drawer -->
      <div id="customerCartDrawer" class="cart-drawer-overlay">
        <div class="cart-drawer-backdrop"></div>
        <div class="cart-drawer-panel">
          <div class="cart-drawer-header">
            <div class="cart-header-title">
              <h3>🛒 Grocery Cart</h3>
              <span class="cart-count-badge">0</span>
            </div>
            <button id="btnCloseCartDrawer" class="btn btn-icon btn-sm" aria-label="Close cart">✕</button>
          </div>

          <!-- Perishable Alert Banner -->
          <div id="cartPerishableNotice" class="cart-perishable-alert" style="display: none;">
            <span>❄️</span>
            <div><strong>Cold-Chain Protection Active:</strong> Packed with reusable chilled thermal bags.</div>
          </div>

          <div id="cartDrawerItemsList" class="cart-items-scroll">
            <!-- Populated dynamically -->
          </div>

          <div class="cart-drawer-footer">
            <!-- Driver Tip Selector -->
            <div class="cart-tip-section">
              <label class="tip-label">Delivery Driver Tip (100% goes to driver):</label>
              <div class="tip-options-row">
                <label class="tip-option">
                  <input type="radio" name="driverTipOption" value="2.50" />
                  <span>$2.50</span>
                </label>
                <label class="tip-option">
                  <input type="radio" name="driverTipOption" value="4.00" checked />
                  <span>$4.00</span>
                </label>
                <label class="tip-option">
                  <input type="radio" name="driverTipOption" value="6.00" />
                  <span>$6.00</span>
                </label>
                <label class="tip-option">
                  <input type="radio" name="driverTipOption" value="0.00" />
                  <span>None</span>
                </label>
              </div>
            </div>

            <!-- Price Breakdown -->
            <div class="cart-breakdown-list">
              <div class="cart-breakdown-row">
                <span>Subtotal:</span>
                <strong id="cartSummarySubtotal">$0.00</strong>
              </div>
              <div class="cart-breakdown-row">
                <span>Overland Park Express Delivery:</span>
                <span class="text-free">FREE ($0.00)</span>
              </div>
              <div class="cart-breakdown-row total-row">
                <span>Total:</span>
                <strong id="cartSummaryTotal" class="total-price-text">$0.00</strong>
              </div>
            </div>

            <button id="btnProceedCheckout" class="btn btn-primary w-full btn-lg">
              <span>Checkout Order</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Customer Checkout Modal -->
      <div id="customerCheckoutModal" class="modal-overlay">
        <div class="modal-card checkout-modal-card">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">Overland Park Grocery Checkout</h3>
              <p class="modal-subtitle">Dispatching from <strong id="checkoutModalStoreName">Store</strong></p>
            </div>
            <button id="btnCloseCheckoutModal" class="btn btn-icon btn-sm">✕</button>
          </div>

          <form id="customerCheckoutForm" class="modal-body">
            <!-- Preset Address Selector for Quick Test -->
            <div class="form-group">
              <label class="form-label">📍 Quick Select Overland Park Address:</label>
              <div class="preset-addresses-chips">
                ${PRESET_CUSTOMER_ADDRESSES.map((p, idx) => `
                  <button type="button" class="preset-address-chip ${idx === 0 ? 'active' : ''}" data-index="${idx}">
                    ${p.name}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label for="checkoutCustomerName" class="form-label">Customer Name</label>
                <input type="text" id="checkoutCustomerName" class="form-input" required />
              </div>
              <div class="form-group">
                <label for="checkoutCustomerPhone" class="form-label">Phone Number</label>
                <input type="tel" id="checkoutCustomerPhone" class="form-input" required />
              </div>
            </div>

            <div class="form-group">
              <label for="checkoutCustomerAddress" class="form-label">Delivery Street Address (Overland Park, KS)</label>
              <input type="text" id="checkoutCustomerAddress" class="form-input" required />
            </div>

            <div class="form-group">
              <label for="checkoutCustomerNotes" class="form-label">Delivery Instructions (Gate codes, porch notes)</label>
              <input type="text" id="checkoutCustomerNotes" class="form-input" placeholder="e.g. Leave on front porch, don't ring doorbell" />
            </div>

            <div class="checkout-summary-box">
              <div class="summary-line">
                <span>Groceries Subtotal:</span>
                <span id="checkoutModalSubtotal">$0.00</span>
              </div>
              <div class="summary-line">
                <span>Estimated Arrival:</span>
                <span class="text-accent">25-35 Minutes</span>
              </div>
              <div class="summary-line highlight">
                <span>Final Total:</span>
                <strong id="checkoutModalTotal">$0.00</strong>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" id="btnCancelCheckout" class="btn btn-outline">Cancel</button>
              <button type="submit" class="btn btn-primary btn-lg">
                <span>🚀 Place FreshRoute Order</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Live Order Tracking Modal -->
      <div id="customerTrackingModal" class="modal-overlay">
        <div class="modal-card tracking-modal-card">
          <div class="modal-header tracking-header">
            <div class="tracking-title-wrap">
              <span class="tracking-pulse-dot"></span>
              <div>
                <h3 class="modal-title">Live FreshRoute Tracker</h3>
                <span class="tracking-order-num" id="trackOrderNumber">#FR-8821</span>
              </div>
            </div>
            <button id="btnCloseTrackingModal" class="btn btn-icon btn-sm">✕</button>
          </div>

          <div class="modal-body tracking-modal-body">
            <!-- Status Badge Header -->
            <div class="tracking-status-banner">
              <div id="trackStatusPill" class="status-pill status-received">
                <span>📝</span> Order Received
              </div>
              <div class="tracking-est-time">
                <span>Estimated Drop-off:</span>
                <strong>~25 mins</strong>
              </div>
            </div>

            <!-- Stepper Timeline -->
            <div id="trackTimelineSteps" class="tracking-timeline-container">
              <!-- Dynamically populated -->
            </div>

            <!-- Hub & Dropoff Details -->
            <div class="tracking-location-grid">
              <div class="tracking-loc-card">
                <div class="loc-label">🏬 Store Origin</div>
                <div class="loc-val" id="trackStoreName">Store Name</div>
              </div>
              <div class="tracking-loc-card">
                <div class="loc-label">🏡 Delivery Destination</div>
                <div class="loc-val" id="trackCustomerAddress">Address</div>
              </div>
            </div>

            <!-- Order Items Collapsible -->
            <div class="tracking-items-box">
              <div class="items-box-header">
                <strong>Items in Package</strong>
                <span id="trackTotalAmount" class="text-accent">$0.00</span>
              </div>
              <div id="trackItemsSummaryList" class="track-items-list">
                <!-- Populated dynamically -->
              </div>
            </div>

            <!-- Quick Jump Role Switchers for Demo -->
            <div class="tracking-demo-shortcuts">
              <div class="shortcut-tip">
                💡 <strong>Try the 3-Way Ecosystem:</strong> See this live order update across apps!
              </div>
              <div class="shortcut-buttons">
                <button type="button" id="btnJumpToMerchant" class="btn btn-secondary btn-sm">
                  <span>🏬 View in Merchant Studio</span>
                </button>
                <button type="button" id="btnJumpToDriver" class="btn btn-secondary btn-sm">
                  <span>🚚 View in Driver Maps</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getStoreEmoji(storeId) {
    switch (storeId) {
      case 'whole_foods': return '🥦';
      case 'trader_joes': return '🌺';
      case 'hy_vee': return '🥩';
      case 'sprouts_corbin': return '🌱';
      case 'price_chopper': return '🛒';
      case 'costco_op': return '📦';
      default: return '🏬';
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}
