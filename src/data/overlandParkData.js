/**
 * Overland Park, Kansas - Indian Grocery Delivery Route Data
 * Curated Indian grocery store hubs, delivery batch scenarios, and neighborhood stops.
 */

export const OVERLAND_PARK_CENTER = [38.9325, -94.6750];
export const OVERLAND_PARK_BOUNDS = [
  [38.8000, -94.7700], // Southwest
  [39.0200, -94.6200], // Northeast
];

// Major Indian Grocery Stores in Overland Park, KS
export const GROCERY_STORES = [
  {
    id: 'royal_spices',
    name: 'Royal Spices Indian Grocery',
    brand: 'Royal Spices',
    address: '8617 W 95th St, Overland Park, KS 66212',
    lat: 38.9565,
    lng: -94.6852,
    icon: 'royal',
    color: '#2d6a4f',
    description: 'Central Overland Park Indian hub with fresh desi produce, atta, dhal, and fresh snacks'
  },
  {
    id: 'reliance_mart',
    name: 'Reliance Mart',
    brand: 'Reliance Mart',
    address: '8731 W 95th St, Overland Park, KS 66212',
    lat: 38.9566,
    lng: -94.6870,
    icon: 'reliance',
    color: '#3d5a45',
    description: 'Renowned cash & carry depot for bulk basmati rice, lentils, spices, and South Indian staples'
  },
  {
    id: 'kc_indian_mart',
    name: 'KC Indian Mart',
    brand: 'KC Indian Mart',
    address: '11005 Metcalf Ave, Overland Park, KS 66210',
    lat: 38.9298,
    lng: -94.6685,
    icon: 'kc',
    color: '#4a6b58',
    description: 'Mid-town hub with fresh batter, authentic masalas, frozen naans, and hot snacks'
  },
  {
    id: 'taj_groceries',
    name: 'Taj Groceries',
    brand: 'Taj Groceries',
    address: '8615 W 95th St, Overland Park, KS 66212',
    lat: 38.9564,
    lng: -94.6845,
    icon: 'taj',
    color: '#36533f',
    description: 'Everyday household brands, desi ghee, paneer, and premium whole wheat flours'
  },
  {
    id: 'tt_asian_grocery',
    name: 'TT Asian Grocery Store',
    brand: 'TT Asian Grocery',
    address: '11902 W 119th St, Overland Park, KS 66213',
    lat: 38.9130,
    lng: -94.7240,
    icon: 'tt',
    color: '#435e49',
    description: 'Southwest corridor hub for Indian sweets, festival specials, and bulk pantry goods'
  }
];

// Curated Preset Scenarios for Indian Grocery Delivery in Overland Park
export const PRESET_SCENARIOS = [
  {
    id: 'morning_batch_loop',
    name: '🌅 Morning Batch Run (7:00 - 10:00 AM) • 5 Stops',
    storeId: 'royal_spices',
    badge: 'Morning Run',
    description: 'Overnight orders placed between 4 PM - 9 PM delivered first thing in the morning across Central & Downtown OP.',
    stops: [
      {
        id: 'stop-1',
        customerName: 'Anand & Priya Sharma',
        phone: '(913) 555-0142',
        address: '8001 Conser St, Overland Park, KS 66204',
        lat: 38.9832,
        lng: -94.6698,
        bags: 3,
        items: ['Aashirvaad Sharbati Atta (20 lb)', 'Amul Pure Ghee (1L)', 'Fresh Curry Leaves', 'Toor Dal (4 lb)'],
        isPerishable: true,
        notes: 'Leave near porch swing. Morning delivery requested.',
        deliverySlotId: 'morning_next_day',
        status: 'pending'
      },
      {
        id: 'stop-2',
        customerName: 'Vikram Patel',
        phone: '(913) 555-0189',
        address: '7941 Santa Fe Dr, Overland Park, KS 66204',
        lat: 38.9845,
        lng: -94.6715,
        bags: 2,
        items: ['Royal Basmati Rice (10 lb)', 'Fresh Okra (Bhindi 2 lb)', 'Haldiram Aloo Bhujia'],
        isPerishable: true,
        notes: 'Ring doorbell upon drop-off please.',
        deliverySlotId: 'morning_next_day',
        status: 'pending'
      },
      {
        id: 'stop-3',
        customerName: 'Dr. Suresh & Meena Rao',
        phone: '(913) 555-0231',
        address: '8400 W 91st Terrace, Overland Park, KS 66212',
        lat: 38.9642,
        lng: -94.6825,
        bags: 4,
        items: ['Amul Paneer (400g x 2)', 'Idli Dosa Batter (32 oz)', 'Fresh Coriander & Mint', 'Deep Garlic Naan'],
        isPerishable: true,
        notes: 'Side door entrance near driveway garage.',
        deliverySlotId: 'morning_next_day',
        status: 'pending'
      },
      {
        id: 'stop-4',
        customerName: 'Deepak & Sneha Joshi',
        phone: '(913) 555-0377',
        address: '9320 Antioch Rd, Overland Park, KS 66212',
        lat: 38.9598,
        lng: -94.6865,
        bags: 3,
        items: ['Wagh Bakri CTC Tea (1 kg)', 'Parle-G Gold (Family Pack)', 'MDH Garam Masala', 'Lauki (Bottle Gourd)'],
        isPerishable: false,
        notes: 'Gate latch is unlocked, set on doorstep.',
        deliverySlotId: 'morning_next_day',
        status: 'pending'
      },
      {
        id: 'stop-5',
        customerName: 'Rajesh & Kavita Iyer',
        phone: '(913) 555-0420',
        address: '8710 Farley St, Overland Park, KS 66212',
        lat: 38.9710,
        lng: -94.7005,
        bags: 3,
        items: ['Sona Masoori Rice (20 lb)', 'Moong Dal (4 lb)', 'Everest Sambhar Masala'],
        isPerishable: false,
        notes: 'Please do not ring bell. Morning doorstep drop.',
        deliverySlotId: 'morning_next_day',
        status: 'pending'
      }
    ]
  },
  {
    id: 'evening_batch_loop',
    name: '🌆 Evening Batch Run (6:00 - 9:00 PM) • 5 Stops',
    storeId: 'reliance_mart',
    badge: 'Evening Run',
    description: 'Daytime orders placed between 9 AM - 12 PM prepared in the afternoon and delivered 6 PM - 9 PM across South OP.',
    stops: [
      {
        id: 'stop-6',
        customerName: 'Karthik & Sunita Nambiar',
        phone: '(913) 555-0511',
        address: '11900 W 119th St, Overland Park, KS 66213',
        lat: 38.9130,
        lng: -94.7235,
        bags: 3,
        items: ['Fresh Indian Samosas (4-pack)', 'Gits Gulab Jamun Tin', 'Maggi 2-Minute Noodles (12-pack)'],
        isPerishable: true,
        notes: 'Evening delivery between 6 PM - 9 PM.',
        deliverySlotId: 'evening_same_day',
        status: 'pending'
      },
      {
        id: 'stop-7',
        customerName: 'Amit & Ritu Agarwal',
        phone: '(913) 555-0622',
        address: '12400 Blue Valley Pkwy, Overland Park, KS 66213',
        lat: 38.9035,
        lng: -94.6890,
        bags: 4,
        items: ['Aashirvaad Multigrain Atta (10 lb)', 'Amul Cheese Slices', 'Swad Tindora (2 lb)'],
        isPerishable: true,
        notes: 'Leave under covered front porch.',
        deliverySlotId: 'evening_same_day',
        status: 'pending'
      },
      {
        id: 'stop-8',
        customerName: 'Sanjay Reddy',
        phone: '(913) 555-0733',
        address: '6800 W 135th St, Overland Park, KS 66223',
        lat: 38.8845,
        lng: -94.6640,
        bags: 2,
        items: ['Priya Gongura Pickle', 'Haldiram Rasgulla (1 kg)', 'Roasted Chana Dal'],
        isPerishable: false,
        notes: 'Apartment #302, ring intercom.',
        deliverySlotId: 'evening_same_day',
        status: 'pending'
      },
      {
        id: 'stop-9',
        customerName: 'Manoj & Divya Deshmukh',
        phone: '(913) 555-0844',
        address: '5600 W 135th St, Overland Park, KS 66223',
        lat: 38.8835,
        lng: -94.6510,
        bags: 3,
        items: ['Karela (Bitter Gourd 2 lb)', 'Ginger Garlic Paste (Swad)', 'Tata Salt'],
        isPerishable: true,
        notes: 'Door code #5541. Evening delivery.',
        deliverySlotId: 'evening_same_day',
        status: 'pending'
      },
      {
        id: 'stop-10',
        customerName: 'Harish & Swati Verma',
        phone: '(913) 555-0955',
        address: '14100 Switzer Rd, Overland Park, KS 66221',
        lat: 38.8720,
        lng: -94.7020,
        bags: 4,
        items: ['Daawat Rozana Basmati (10 lb)', 'Chana Dal (4 lb)', 'Fresh Green Chillies'],
        isPerishable: false,
        notes: 'Porch bench drop-off.',
        deliverySlotId: 'evening_same_day',
        status: 'pending'
      }
    ]
  }
];
