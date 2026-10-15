# 🛒 FreshRoute OP — Overland Park Grocery Delivery Route Optimizer

A high-performance, visually interactive grocery delivery route optimization web application built specifically for **Overland Park, Kansas, USA**.

## 🌟 Features Overview

- **Interactive Overland Park Map**:
  - Full Leaflet map centered on Overland Park, KS with authentic city boundary limits.
  - High-resolution ESRI / OpenStreetMap road tiles (crystal clear, no API keys or watermarks).
  - Custom SVG store depot pins with glowing pulsing rings, numbered sequence stops (`1`, `2`, `3`...), and animated grocery delivery van with heading rotation and headlights.
  - Interactive popup cards displaying customer names, bag counts, grocery items, phone numbers, and driver notes.

- **Intelligent Multi-Stop Route Optimization (TSP)**:
  - Real road-network routing via OSRM (Open Source Routing Machine). Traces real turns and maneuvers on Metcalf Ave, Antioch Rd, I-435, US-69, 95th St, 119th St, 135th St, etc.
  - Local 2-Opt Traveling Salesperson (TSP) heuristic solver for instant fallback.
  - **Round Trip Mode** (Depot ➔ Stops ➔ Return to Store) or **Drop-off Finish Mode** (Depot ➔ Stops ➔ Finish at Last Stop).
  - Efficiency metrics: Miles saved, driving minutes saved, fuel cost saved (calculated using KS gas price averages), and CO₂ footprint reduction.

- **Pre-Configured Overland Park Grocery Store Hubs**:
  1. **Whole Foods Market** (91st & Metcalf Ave, OP 66212)
  2. **Trader Joe's** (119th & Roe Ave, OP 66209)
  3. **Hy-Vee Overland Park** (95th & Antioch Rd, OP 66212)
  4. **Sprouts Farmers Market** (Corbin Park, 135th & Metcalf, OP 66223)
  5. **Price Chopper** (119th & Antioch, OP 66213)
  6. **Costco Wholesale Hub** (Blue Valley Pkwy, OP 66213)

- **One-Click Curated Neighborhood Scenarios**:
  - 🏙️ **Central OP (5 Stops)**: Historic Downtown OP, Conser St, Santa Fe Dr, and Metcalf corridor.
  - 🌾 **South OP (5 Stops)**: 135th St, Switzer Rd, Quivira Rd, and Antioch Rd around Corbin Park & Blue Valley.
  - 🏢 **College Blvd (5 Stops)**: Corporate Woods, Indian Creek Trail, and Prairiefire corridor.
  - ➕ **Custom Route**: Add custom stops by searching or clicking directly on the map.

- **Address Input & Geocoding**:
  - Live autocomplete search with OpenStreetMap Nominatim bounded to Overland Park / Johnson County, KS.
  - **"Click to Add Stop" Mode**: Tap any street in Overland Park to drop a new house pin with reverse geocoding.
  - Order customization: Customer name, grocery items, cold-chain perishable toggle, doorstep notes.

- **Live Route Simulation**:
  - Smooth animation of the grocery delivery van traveling along the road network.
  - Real-time speedometer, progress bar, and speed controls (1x, 2x, 5x, 10x).
  - Stop arrival pause: drops off groceries, updates stop status to "Delivered ✓", displays notification toast, and triggers confetti celebration when all deliveries are completed.

- **Export & Driver Manifest**:
  - **Google Maps Navigation Link**: Instant 1-click multi-stop driving route for smartphones.
  - **Printable Dispatch Manifest**: Formatted delivery checklist with customer details, order items, and signature boxes.

## 🚀 Running Locally

```bash
cd /Users/srinadhreddy/.gemini/antigravity-ide/scratch/overland-park-grocery-route
npm install
npm run dev
```

Open `http://127.0.0.1:5173/` in your browser.
