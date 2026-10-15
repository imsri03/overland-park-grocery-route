/**
 * FreshRoute Unified Reactive Database & Event Engine
 * Manages store inventory, live order lifecycle, and real-time state synchronization
 * between Customer Storefront, Merchant Studio, and Delivery Agent Maps.
 */

import { STORE_CATALOGS, PRESET_CUSTOMER_ADDRESSES } from '../data/inventoryData.js';

const STORAGE_KEY = 'freshroute_ecosystem_db_v2';
const BROADCAST_CHANNEL_NAME = 'freshroute_sync_bus';

class FreshRouteDatabase {
  constructor() {
    this.listeners = new Set();
    this.broadcastChannel = null;

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          this.notifyLocalListeners(event.data.type, event.data.payload, false);
        };
      } catch (err) {
        console.warn('BroadcastChannel not initialized:', err);
      }
    }

    this.state = this.loadFromStorage();
  }

  getInitialSeedData() {
    const stores = STORE_CATALOGS.map(s => ({
      id: s.id,
      name: s.name,
      brand: s.brand,
      tagline: s.tagline,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      color: s.color,
      icon: s.icon,
      rating: s.rating,
      reviews: s.reviews,
      prepTimeMins: s.prepTimeMins,
      estDeliveryMins: s.estDeliveryMins,
      deliveryFee: s.deliveryFee,
      minOrder: s.minOrder,
      categoryTag: s.categoryTag,
      badge: s.badge,
      hours: s.hours
    }));

    const inventoryByStore = {};
    STORE_CATALOGS.forEach(s => {
      inventoryByStore[s.id] = JSON.parse(JSON.stringify(s.inventory));
    });

    // Realistic active initial orders
    const now = Date.now();
    const orders = [
      {
        id: 'ord-101',
        orderNumber: '#FR-8821',
        storeId: 'whole_foods',
        storeName: 'Whole Foods Market (91st & Metcalf)',
        storeAddress: '6621 W 119th St / 9101 Metcalf Ave, Overland Park, KS',
        createdAt: new Date(now - 35 * 60 * 1000).toISOString(),
        customer: {
          name: 'Sarah Jenkins',
          phone: '(913) 555-0142',
          address: '8001 Conser St, Overland Park, KS 66204',
          lat: 38.9832,
          lng: -94.6698,
          notes: 'Leave on porch near swing, gate is unlocked.'
        },
        items: [
          { id: 'wf-prod-1', name: 'Organic Honeycrisp Apples', price: 3.99, quantity: 2, packed: true, isPerishable: false },
          { id: 'wf-dai-1', name: 'Whole Grass-Fed Milk (Grade A)', price: 4.89, quantity: 1, packed: true, isPerishable: true },
          { id: 'wf-bak-1', name: 'Artisan Country Sourdough Loaf', price: 5.99, quantity: 1, packed: true, isPerishable: false },
          { id: 'wf-dai-2', name: 'Pasture-Raised Large Brown Eggs', price: 5.49, quantity: 1, packed: true, isPerishable: true }
        ],
        subtotal: 24.35,
        deliveryFee: 0.00,
        tip: 4.50,
        total: 28.85,
        bagsCount: 3,
        hasPerishable: true,
        status: 'ready_for_dispatch', // Ready for driver!
        timeline: [
          { status: 'received', time: new Date(now - 35 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), note: 'Order placed by customer via FreshRoute Shop' },
          { status: 'preparing', time: new Date(now - 24 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), note: 'Merchant started picking & packing in Overland Park' },
          { status: 'packed', time: new Date(now - 12 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), note: 'All 4 items checked & packed in insulated delivery bags' },
          { status: 'ready_for_dispatch', time: new Date(now - 8 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), note: 'Merchant requested FreshRoute driver pickup' }
        ]
      },
      {
        id: 'ord-102',
        orderNumber: '#FR-8822',
        storeId: 'whole_foods',
        storeName: 'Whole Foods Market (91st & Metcalf)',
        storeAddress: '6621 W 119th St / 9101 Metcalf Ave, Overland Park, KS',
        createdAt: new Date(now - 18 * 60 * 1000).toISOString(),
        customer: {
          name: 'Marcus Vance',
          phone: '(913) 555-0189',
          address: '7941 Santa Fe Dr, Overland Park, KS 66204',
          lat: 38.9845,
          lng: -94.6715,
          notes: 'Ring doorbell after delivery please!'
        },
        items: [
          { id: 'wf-bev-2', name: 'Nitro Cold Brew Coffee', price: 3.99, quantity: 2, packed: true, isPerishable: true },
          { id: 'wf-prod-3', name: 'Organic Hass Avocados', price: 5.29, quantity: 1, packed: false, isPerishable: false },
          { id: 'wf-dai-3', name: 'Authentic Greek Yogurt', price: 5.79, quantity: 1, packed: false, isPerishable: true }
        ],
        subtotal: 19.06,
        deliveryFee: 0.00,
        tip: 3.50,
        total: 22.56,
        bagsCount: 2,
        hasPerishable: true,
        status: 'preparing', // Merchant is currently packing!
        timeline: [
          { status: 'received', time: new Date(now - 18 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), note: 'Order placed by customer via FreshRoute Shop' },
          { status: 'preparing', time: new Date(now - 10 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), note: 'Whole Foods merchant is picking fresh items' }
        ]
      },
      {
        id: 'ord-103',
        orderNumber: '#FR-8823',
        storeId: 'hy_vee',
        storeName: 'Hy-Vee Overland Park (95th & Antioch)',
        storeAddress: '8959 W 95th St, Overland Park, KS',
        createdAt: new Date(now - 8 * 60 * 1000).toISOString(),
        customer: {
          name: 'Dr. Emily Chen',
          phone: '(913) 555-0231',
          address: '8400 W 91st Terrace, Overland Park, KS 66212',
          lat: 38.9642,
          lng: -94.6825,
          notes: 'Side garage entrance, gate is unlocked.'
        },
        items: [
          { id: 'hv-meat-1', name: 'Choice Angus New York Strip Steak', price: 13.99, quantity: 2, packed: false, isPerishable: true },
          { id: 'hv-bev-1', name: 'Boulevard Tank 7 Farmhouse Ale (6-pk)', price: 11.99, quantity: 1, packed: false, isPerishable: false }
        ],
        subtotal: 39.97,
        deliveryFee: 0.00,
        tip: 6.00,
        total: 45.97,
        bagsCount: 2,
        hasPerishable: true,
        status: 'received', // New order received!
        timeline: [
          { status: 'received', time: new Date(now - 8 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), note: 'Order placed by customer via FreshRoute Shop' }
        ]
      }
    ];

    return { stores, inventoryByStore, orders };
  }

  loadFromStorage() {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY);
      if (serialized) {
        const parsed = JSON.parse(serialized);
        if (parsed.stores && parsed.inventoryByStore && parsed.orders) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read FreshRoute state from localStorage:', e);
    }
    const initial = this.getInitialSeedData();
    this.saveToStorage(initial);
    return initial;
  }

  saveToStorage(data = this.state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to write to localStorage:', e);
    }
  }

  notifyLocalListeners(type, payload, broadcast = true) {
    this.listeners.forEach(cb => {
      try {
        cb(type, payload);
      } catch (err) {
        console.error('Listener callback error:', err);
      }
    });

    if (broadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type, payload });
      } catch (err) {
        // BroadcastChannel send failed
      }
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // --- STORES API ---
  getStores() {
    return this.state.stores;
  }

  getStore(storeId) {
    return this.state.stores.find(s => s.id === storeId) || null;
  }

  // --- INVENTORY API ---
  getStoreInventory(storeId) {
    return this.state.inventoryByStore[storeId] || [];
  }

  updateProduct(storeId, productId, updates) {
    const inventory = this.state.inventoryByStore[storeId];
    if (!inventory) return null;

    const item = inventory.find(p => p.id === productId);
    if (!item) return null;

    Object.assign(item, updates);
    this.saveToStorage();
    this.notifyLocalListeners('product:updated', { storeId, product: item });
    return item;
  }

  addProduct(storeId, productData) {
    if (!this.state.inventoryByStore[storeId]) {
      this.state.inventoryByStore[storeId] = [];
    }

    const newProduct = {
      id: `custom-prod-${Date.now()}`,
      name: productData.name,
      category: productData.category || 'produce',
      price: parseFloat(productData.price) || 2.99,
      unit: productData.unit || '1 unit',
      stock: parseInt(productData.stock, 10) || 20,
      inStock: true,
      isPerishable: Boolean(productData.isPerishable),
      emoji: productData.emoji || '🛒',
      badge: productData.badge || 'New Item',
      description: productData.description || 'Freshly added to store inventory.'
    };

    this.state.inventoryByStore[storeId].unshift(newProduct);
    this.saveToStorage();
    this.notifyLocalListeners('product:added', { storeId, product: newProduct });
    return newProduct;
  }

  // --- ORDERS API ---
  getOrders(filter = {}) {
    let orders = [...this.state.orders];
    if (filter.storeId) {
      orders = orders.filter(o => o.storeId === filter.storeId);
    }
    if (filter.status) {
      if (Array.isArray(filter.status)) {
        orders = orders.filter(o => filter.status.includes(o.status));
      } else {
        orders = orders.filter(o => o.status === filter.status);
      }
    }
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getOrder(orderId) {
    return this.state.orders.find(o => o.id === orderId) || null;
  }

  createOrder(orderData) {
    const now = new Date();
    const orderNumber = `#FR-${Math.floor(1000 + Math.random() * 9000)}`;

    const store = this.getStore(orderData.storeId);
    const hasPerishable = orderData.items.some(it => it.isPerishable);
    const totalItems = orderData.items.reduce((sum, it) => sum + it.quantity, 0);
    const calculatedBags = Math.max(1, Math.ceil(totalItems / 3));

    const newOrder = {
      id: `ord-${Date.now()}`,
      orderNumber,
      storeId: orderData.storeId,
      storeName: store ? store.name : 'Overland Park Grocery',
      storeAddress: store ? store.address : 'Overland Park, KS',
      createdAt: now.toISOString(),
      customer: {
        name: orderData.customer.name,
        phone: orderData.customer.phone || '(913) 555-0100',
        address: orderData.customer.address,
        lat: orderData.customer.lat,
        lng: orderData.customer.lng,
        notes: orderData.customer.notes || ''
      },
      items: orderData.items.map(it => ({
        id: it.id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        packed: false,
        isPerishable: Boolean(it.isPerishable)
      })),
      subtotal: parseFloat(orderData.subtotal.toFixed(2)),
      deliveryFee: parseFloat((orderData.deliveryFee || 0).toFixed(2)),
      tip: parseFloat((orderData.tip || 0).toFixed(2)),
      total: parseFloat(orderData.total.toFixed(2)),
      bagsCount: calculatedBags,
      hasPerishable,
      status: 'received',
      timeline: [
        {
          status: 'received',
          time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          note: 'Order placed by customer via FreshRoute Shop'
        }
      ]
    };

    // Update stock levels in inventory
    const inventory = this.state.inventoryByStore[orderData.storeId];
    if (inventory) {
      orderData.items.forEach(orderedItem => {
        const product = inventory.find(p => p.id === orderedItem.id);
        if (product) {
          product.stock = Math.max(0, product.stock - orderedItem.quantity);
          if (product.stock === 0) product.inStock = false;
        }
      });
    }

    this.state.orders.unshift(newOrder);
    this.saveToStorage();
    this.notifyLocalListeners('order:created', { order: newOrder });
    return newOrder;
  }

  updateOrderStatus(orderId, newStatus, note = '') {
    const order = this.getOrder(orderId);
    if (!order) return null;

    order.status = newStatus;
    const now = new Date();
    order.timeline.push({
      status: newStatus,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      note: note || `Status updated to ${newStatus}`
    });

    this.saveToStorage();
    this.notifyLocalListeners('order:status_changed', { orderId, status: newStatus, order });
    return order;
  }

  toggleOrderItemPacked(orderId, itemIndex) {
    const order = this.getOrder(orderId);
    if (!order || !order.items[itemIndex]) return null;

    order.items[itemIndex].packed = !order.items[itemIndex].packed;
    
    // Check if all items are packed
    const allPacked = order.items.every(item => item.packed);
    if (allPacked && order.status === 'preparing') {
      order.status = 'packed';
      order.timeline.push({
        status: 'packed',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        note: 'All items marked packed by merchant'
      });
    }

    this.saveToStorage();
    this.notifyLocalListeners('order:item_packed', { orderId, order });
    return order;
  }

  setOrderBagCount(orderId, bagCount) {
    const order = this.getOrder(orderId);
    if (!order) return null;
    order.bagsCount = Math.max(1, parseInt(bagCount, 10) || 1);
    this.saveToStorage();
    this.notifyLocalListeners('order:updated', { orderId, order });
    return order;
  }

  resetDemoData() {
    const fresh = this.getInitialSeedData();
    this.state = fresh;
    this.saveToStorage(fresh);
    this.notifyLocalListeners('db:reset', fresh);
    return fresh;
  }
}

export const db = new FreshRouteDatabase();
