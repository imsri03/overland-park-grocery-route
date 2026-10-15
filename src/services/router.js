/**
 * Routing and Traveling Salesperson Problem (TSP) Optimization Engine
 * Supports real road network geometry via OSRM and local 2-opt TSP optimization.
 */

// Haversine formula to calculate great-circle distance between two points in miles
export function haversineDistanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convert meters to miles
export function metersToMiles(meters) {
  return meters * 0.000621371;
}

// Convert seconds to readable time (e.g. "1 hr 15 mins" or "32 mins")
export function formatDuration(seconds) {
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) {
    return `${totalMins} min${totalMins === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${hours} hr${hours === 1 ? '' : 's'} ${mins} min${mins === 1 ? '' : 's'}`;
}

/**
 * Local 2-Opt Traveling Salesperson Problem Solver
 * Finds an optimal or near-optimal delivery sequence starting at index 0 (Store Depot).
 */
export function solveTSPLocal(points, roundTrip = true) {
  const n = points.length;
  if (n <= 2) {
    return {
      order: points.map((_, i) => i),
      totalDistance: calculateTourDistance(points, points.map((_, i) => i), roundTrip)
    };
  }

  // Build distance matrix
  const distMatrix = [];
  for (let i = 0; i < n; i++) {
    distMatrix[i] = [];
    for (let j = 0; j < n; j++) {
      distMatrix[i][j] = haversineDistanceMiles(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
    }
  }

  // Nearest neighbor initialization starting at depot 0
  let tour = [0];
  const unvisited = new Set();
  for (let i = 1; i < n; i++) unvisited.add(i);

  let current = 0;
  while (unvisited.size > 0) {
    let nearest = null;
    let minDist = Infinity;
    for (const next of unvisited) {
      if (distMatrix[current][next] < minDist) {
        minDist = distMatrix[current][next];
        nearest = next;
      }
    }
    tour.push(nearest);
    unvisited.delete(nearest);
    current = nearest;
  }

  // 2-Opt improvement iterations
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const delta = calculate2OptDelta(tour, distMatrix, i, j, roundTrip);
        if (delta < -1e-6) {
          // Reverse slice between i and j
          const reversed = tour.slice(i, j + 1).reverse();
          tour.splice(i, reversed.length, ...reversed);
          improved = true;
        }
      }
    }
  }

  const totalDist = calculateTourDistance(points, tour, roundTrip);
  return { order: tour, totalDistance: totalDist };
}

function calculateTourDistance(points, tour, roundTrip) {
  let dist = 0;
  for (let i = 0; i < tour.length - 1; i++) {
    const a = points[tour[i]];
    const b = points[tour[i + 1]];
    dist += haversineDistanceMiles(a.lat, a.lng, b.lat, b.lng);
  }
  if (roundTrip && tour.length > 1) {
    const last = points[tour[tour.length - 1]];
    const depot = points[tour[0]];
    dist += haversineDistanceMiles(last.lat, last.lng, depot.lat, depot.lng);
  }
  return dist;
}

function calculate2OptDelta(tour, matrix, i, j, roundTrip) {
  const n = tour.length;
  const u = tour[i - 1];
  const v = tour[i];
  const w = tour[j];
  const x = (j + 1 < n) ? tour[j + 1] : (roundTrip ? tour[0] : null);

  let currentDist = matrix[u][v];
  let newDist = matrix[u][w];

  if (x !== null) {
    currentDist += matrix[w][x];
    newDist += matrix[v][x];
  }

  return newDist - currentDist;
}

/**
 * Main Routing Engine:
 * Coordinates with OSRM (Trip or Route endpoint) to get actual road paths & maneuvers.
 */
export async function calculateOptimizedRoute(store, stops, roundTrip = true) {
  if (!stops || stops.length === 0) {
    return {
      success: true,
      optimizedStops: [],
      coordinates: [[store.lng, store.lat]],
      totalMiles: 0,
      totalDurationSeconds: 0,
      totalDurationFormatted: '0 mins',
      legs: [],
      instructions: [],
      savings: null
    };
  }

  // All points: index 0 is Store Depot, indices 1..N are stops
  const allPoints = [store, ...stops];
  const coordsString = allPoints.map(p => `${p.lng},${p.lat}`).join(';');

  // Calculate naive (unoptimized) distance for comparison
  const naiveLocalResult = calculateTourDistance(allPoints, allPoints.map((_, i) => i), roundTrip);

  try {
    // Attempt OSRM Trip API (Native TSP on road network)
    const osrmUrl = `https://router.project-osrm.org/trip/v1/driving/${coordsString}?source=first&overview=full&geometries=geojson&steps=true&roundtrip=${roundTrip}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);

    const response = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.trips && data.trips.length > 0) {
        const trip = data.trips[0];
        const waypoints = data.waypoints;

        // Order mapping: Sort stops according to waypoint_index
        // waypoints[0] is store (waypoint_index = 0)
        // waypoints[1..N] are the stops
        const stopIndexMap = [];
        waypoints.forEach(wp => {
          stopIndexMap.push({
            inputIndex: wp.waypoint_index,
            tripIndex: wp.trips_index
          });
        });

        // Determine stop visitation order
        const orderedStops = [];
        // Map waypoints to ordered list excluding store (index 0)
        const sortedWaypoints = [...waypoints]
          .sort((a, b) => a.waypoint_index - b.waypoint_index)
          .filter(wp => wp.waypoint_index > 0);

        // Sort by trip order
        const stopsByTripOrder = [];
        for (let i = 1; i < allPoints.length; i++) {
          const wp = waypoints[i];
          stopsByTripOrder.push({
            stop: stops[i - 1],
            waypointIndex: wp.waypoint_index,
            order: wp.waypoint_index
          });
        }
        stopsByTripOrder.sort((a, b) => a.waypointIndex - b.waypointIndex);

        const optimizedStops = stopsByTripOrder.map((item, idx) => ({
          ...item.stop,
          sequence: idx + 1
        }));

        const totalMiles = metersToMiles(trip.distance);
        const totalDurationSeconds = trip.duration;

        // Extract instructions & legs
        const instructions = [];
        const legs = trip.legs || [];

        legs.forEach((leg, legIdx) => {
          const fromName = legIdx === 0 ? store.name : optimizedStops[legIdx - 1].customerName;
          const toName = legIdx < optimizedStops.length ? optimizedStops[legIdx].customerName : `${store.name} (Depot Return)`;
          const toAddress = legIdx < optimizedStops.length ? optimizedStops[legIdx].address : store.address;

          instructions.push({
            type: 'leg_header',
            text: `Leg ${legIdx + 1}: ${fromName} → ${toName}`,
            distanceMiles: metersToMiles(leg.distance).toFixed(1),
            durationMinutes: Math.round(leg.duration / 60),
            destinationAddress: toAddress
          });

          if (leg.steps) {
            leg.steps.forEach(step => {
              if (step.maneuver && step.maneuver.type !== 'depart' && step.name) {
                instructions.push({
                  type: 'step',
                  text: `${capitalizeManeuver(step.maneuver.modifier || step.maneuver.type)} onto ${step.name}`,
                  distanceMiles: metersToMiles(step.distance).toFixed(1),
                  modifier: step.maneuver.modifier || 'straight'
                });
              }
            });
          }
        });

        // Compute savings vs naive
        const naiveMiles = naiveLocalResult;
        const milesSaved = Math.max(0, naiveMiles - totalMiles);
        const minutesSaved = Math.round(milesSaved * 2.2); // ~25-30mph city average

        return {
          success: true,
          optimizedStops,
          coordinates: trip.geometry.coordinates, // [lng, lat]
          totalMiles: Number(totalMiles.toFixed(2)),
          totalDurationSeconds: Math.round(totalDurationSeconds),
          totalDurationFormatted: formatDuration(totalDurationSeconds),
          legs,
          instructions,
          savings: {
            milesSaved: Number(milesSaved.toFixed(1)),
            minutesSaved,
            fuelCostSaved: Number((milesSaved / 22 * 3.15).toFixed(2)), // 22 MPG, $3.15/gal in KS
            percentSaved: naiveMiles > 0 ? Math.round((milesSaved / naiveMiles) * 100) : 0
          }
        };
      }
    }
  } catch (err) {
    console.warn('OSRM Trip request failed, falling back to local TSP + route solver:', err);
  }

  // LOCAL TSP FALLBACK
  return solveLocalWithOSRMRoute(store, stops, roundTrip, naiveLocalResult);
}

/**
 * Fallback: Solves order locally, then fetches road geometries or generates interpolated paths.
 */
async function solveLocalWithOSRMRoute(store, stops, roundTrip, naiveLocalDist) {
  const allPoints = [store, ...stops];
  const tspResult = solveTSPLocal(allPoints, roundTrip);

  // Reorder stops
  const optimizedStops = [];
  for (let i = 1; i < tspResult.order.length; i++) {
    const pointIdx = tspResult.order[i];
    optimizedStops.push({
      ...stops[pointIdx - 1],
      sequence: i
    });
  }

  // Try standard route API with the optimized ordering
  const orderedPoints = [store, ...optimizedStops];
  if (roundTrip) orderedPoints.push(store);

  const coordsString = orderedPoints.map(p => `${p.lng},${p.lat}`).join(';');
  let polylineCoords = [];
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let legs = [];
  let instructions = [];

  try {
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson&steps=true`;
    const resp = await fetch(routeUrl);
    if (resp.ok) {
      const data = await resp.json();
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        polylineCoords = route.geometry.coordinates;
        totalDistanceMeters = route.distance;
        totalDurationSeconds = route.duration;
        legs = route.legs || [];

        legs.forEach((leg, legIdx) => {
          const fromName = legIdx === 0 ? store.name : optimizedStops[legIdx - 1].customerName;
          const toName = legIdx < optimizedStops.length ? optimizedStops[legIdx].customerName : `${store.name} (Depot Return)`;
          instructions.push({
            type: 'leg_header',
            text: `Leg ${legIdx + 1}: ${fromName} → ${toName}`,
            distanceMiles: metersToMiles(leg.distance).toFixed(1),
            durationMinutes: Math.round(leg.duration / 60)
          });
        });
      }
    }
  } catch (e) {
    console.warn('OSRM Route fallback failed, using interpolated straight paths:', e);
  }

  // If even Route API failed, generate high-density interpolated road coords
  if (!polylineCoords || polylineCoords.length === 0) {
    polylineCoords = generateInterpolatedPath(orderedPoints);
    totalDistanceMeters = tspResult.totalDistance / 0.000621371;
    totalDurationSeconds = (tspResult.totalDistance / 28) * 3600; // ~28mph
  }

  const totalMiles = metersToMiles(totalDistanceMeters);
  const milesSaved = Math.max(0, naiveLocalDist - totalMiles);

  return {
    success: true,
    optimizedStops,
    coordinates: polylineCoords,
    totalMiles: Number(totalMiles.toFixed(2)),
    totalDurationSeconds: Math.round(totalDurationSeconds),
    totalDurationFormatted: formatDuration(totalDurationSeconds),
    legs,
    instructions,
    savings: {
      milesSaved: Number(milesSaved.toFixed(1)),
      minutesSaved: Math.round(milesSaved * 2.2),
      fuelCostSaved: Number((milesSaved / 22 * 3.15).toFixed(2)),
      percentSaved: naiveLocalDist > 0 ? Math.round((milesSaved / naiveLocalDist) * 100) : 0
    }
  };
}

function generateInterpolatedPath(points) {
  const result = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const steps = 15;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      result.push([
        p1.lng + (p2.lng - p1.lng) * t,
        p1.lat + (p2.lat - p1.lat) * t
      ]);
    }
  }
  const last = points[points.length - 1];
  result.push([last.lng, last.lat]);
  return result;
}

function capitalizeManeuver(str) {
  if (!str) return 'Continue';
  if (str === 'left') return 'Turn left';
  if (str === 'right') return 'Turn right';
  if (str === 'sharp left') return 'Sharp left';
  if (str === 'sharp right') return 'Sharp right';
  if (str === 'slight left') return 'Slight left';
  if (str === 'slight right') return 'Slight right';
  if (str === 'straight') return 'Continue straight';
  if (str === 'uturn') return 'Make a U-turn';
  return `Turn ${str}`;
}

/**
 * Generate Google Maps Multi-stop URL
 */
export function generateGoogleMapsUrl(store, stops, roundTrip = true) {
  if (!stops || stops.length === 0) return '#';
  const origin = encodeURIComponent(`${store.address}`);
  const destination = roundTrip
    ? encodeURIComponent(`${store.address}`)
    : encodeURIComponent(`${stops[stops.length - 1].address}`);

  const waypoints = roundTrip
    ? stops.map(s => encodeURIComponent(s.address)).join('|')
    : stops.slice(0, -1).map(s => encodeURIComponent(s.address)).join('|');

  if (waypoints) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
}
