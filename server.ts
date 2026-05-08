import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // === MOCK DATABASE ===
  const binsList = [
    { id: '1', lat: 28.6304, lng: 77.2177, fillLevel: 85, zone: 'Connaught Place', lastUpdated: '2m ago', isPriority: true, isManualPriority: false, baseFillRate: 1.5, type: 'commercial' },
    { id: '2', lat: 28.6315, lng: 77.2160, fillLevel: 45, zone: 'Connaught Place', lastUpdated: '5m ago', isPriority: false, isManualPriority: false, baseFillRate: 1.2, type: 'commercial' },
    { id: '3', lat: 28.6290, lng: 77.2190, fillLevel: 20, zone: 'Barakhamba Road', lastUpdated: '10m ago', isPriority: false, isManualPriority: false, baseFillRate: 0.8, type: 'residential' },
    { id: '4', lat: 28.6285, lng: 77.2150, fillLevel: 92, zone: 'Janpath', lastUpdated: '1m ago', isPriority: true, isManualPriority: false, baseFillRate: 1.8, type: 'commercial' },
    { id: '5', lat: 28.6330, lng: 77.2190, fillLevel: 78, zone: 'K G Marg', lastUpdated: '12m ago', isPriority: false, isManualPriority: false, baseFillRate: 1.4, type: 'commercial' },
    { id: '6', lat: 28.6295, lng: 77.2210, fillLevel: 10, zone: 'Tolstoy Marg', lastUpdated: '15m ago', isPriority: false, isManualPriority: false, baseFillRate: 0.5, type: 'residential' },
    { id: '7', lat: 28.6340, lng: 77.2150, fillLevel: 88, zone: 'Baba Kharak Singh Rd', lastUpdated: 'Just now', isPriority: true, isManualPriority: false, baseFillRate: 1.6, type: 'commercial' },
  ];

  interface UserTrust {
    userId: string;
    reliabilityScore: number;
    fakeReports: number;
  }

  // Import Firebase web SDK instead of admin
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, collection, doc, getDoc, getDocs, updateDoc, query, where } = await import('firebase/firestore');
  const fs = await import('fs');
  const pathModule = await import('path');
  const configPath = pathModule.join(process.cwd(), 'firebase-applet-config.json');
  const configStr = fs.readFileSync(configPath, 'utf8');
  const firebaseConfig = JSON.parse(configStr);

  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

  // === MACHINE LEARNING ENGINE: MOCK RANDOM FOREST ===
  // This simulates a Random Forest model estimating fill rate based on:
  // - Historical Rate (from bin.baseFillRate)
  // - External Events (boolean)
  // - Temperature (celsius)
  // - Crowdsourced reports exist
  
  function predictFillLevel(bin: any, hasEvent: boolean, tempC: number, hasCitizenReport: boolean): number {
    // Tree 1: High weight on recent citizen reports
    const tree1 = (tempC > 25 && hasCitizenReport) ? 95 : (bin.baseFillRate * 30);
    
    // Tree 2: Focuses on events and base historical rate
    let tree2 = bin.baseFillRate * 25;
    if (hasEvent) tree2 += 40;
    
    // Tree 3: Weather and POI type
    let tree3 = bin.fillLevel; // start from last known
    if (tempC > 30 && bin.type === 'commercial') tree3 += 15;
    if (tempC < 10) tree3 -= 5;

    // Aggregate (Random Forest Voting/Averaging)
    // If there is an overflow report, it overrides much of the baseline prediction.
    if (hasCitizenReport) return 100;

    let prediction = (tree1 + tree2 + tree3) / 3;
    
    return Math.min(Math.max(prediction, 0), 100);
  }

  // === MOCK FLEET DATABASE ===
  const fleetDrivers: any[] = [
    { id: 'D-101', name: 'Alex Johnson', status: 'break', truck: 'TRK-402', fillLevel: 30, location: 'Barakhamba Road', destination: '-', eta: '-', lat: 28.6290, lng: 77.2190, routeCoordinates: null, currentRouteIndex: 0, fatigueLevel: 65, idleTime: 15, routeAdherence: 95, history: [], speed: 0 },
    { id: 'D-102', name: 'Sarah Miller', status: 'break', truck: 'TRK-405', fillLevel: 80, location: 'Depot (NDLS)', destination: '-', eta: '-', lat: 28.6415, lng: 77.2183, routeCoordinates: null, currentRouteIndex: 0, fatigueLevel: 25, idleTime: 45, routeAdherence: 98, history: [], speed: 0 },
    { id: 'D-103', name: 'Mike Chen', status: 'break', truck: 'TRK-408', fillLevel: 10, location: 'Connaught Place', destination: '-', eta: '-', lat: 28.6310, lng: 77.2170, routeCoordinates: null, currentRouteIndex: 0, fatigueLevel: 85, idleTime: 5, routeAdherence: 70, history: [], speed: 0 },
    { id: 'D-104', name: 'Emily Davis', status: 'off-duty', truck: 'TRK-412', fillLevel: 0, location: 'Depot (Sadar)', destination: '-', eta: '-', lat: 28.6500, lng: 77.2000, routeCoordinates: null, currentRouteIndex: 0, fatigueLevel: 0, idleTime: 0, routeAdherence: 100, history: [], speed: 0 }
  ];

  function updateFleetMovement() {
    fleetDrivers.forEach(driver => {
      // Append current location to history
      if (!driver.history) driver.history = [];
      driver.history.push([driver.lat, driver.lng]);
      if (driver.history.length > 50) driver.history.shift(); // Keep last 50 points

      // Fatigue logic
      if (driver.status === 'active') {
        driver.fatigueLevel = Math.min(100, driver.fatigueLevel + (Math.random() * 0.5));
        driver.idleTime = 0;
      } else if (driver.status === 'break') {
        driver.fatigueLevel = Math.max(0, driver.fatigueLevel - (Math.random() * 1.5));
        driver.idleTime += 1;
      }
      
      if (driver.status === 'active' && driver.routeCoordinates && driver.routeCoordinates.length > 0) {
        // Move towards the next coordinate
        const target = driver.routeCoordinates[driver.currentRouteIndex];
        if (!target) {
          driver.status = 'break';
          driver.destination = '-';
          driver.routeCoordinates = null;
          driver.currentRouteIndex = 0;
          driver.speed = 0;
          return;
        }

        const dx = target[0] - driver.lat;
        const dy = target[1] - driver.lng;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Speed
        const speed = 0.002;
        driver.speed = Math.round(Math.random() * 15 + 35); // mock speed between 35-50 km/h
        
        if (distance < speed) {
          driver.lat = target[0];
          driver.lng = target[1];
          driver.currentRouteIndex += 5; // skip points to move faster visually
          
          if (driver.currentRouteIndex >= driver.routeCoordinates.length) {
            // Reached destination
            driver.status = 'break';
            driver.destination = 'Completed';
            driver.routeCoordinates = null;
            driver.currentRouteIndex = 0;
            driver.speed = 0;
          }
        } else {
          driver.lat += (dx / distance) * speed;
          driver.lng += (dy / distance) * speed;
        }

        driver.fillLevel = Math.max(0, Math.min(100, Math.floor(driver.fillLevel + (Math.random() * 2))));
      } else if (driver.status === 'active') {
         // Random fallback (stationary or tiny movements)
         driver.lat += (Math.random() - 0.5) * 0.0001;
         driver.lng += (Math.random() - 0.5) * 0.0001;
         driver.speed = Math.round(Math.random() * 5 + 5);
      } else {
         driver.speed = 0;
      }
    });
  }

  app.post("/api/dispatch", (req, res) => {
    const { driverId, routeCoordinates, destinationName } = req.body;
    const driver = fleetDrivers.find(d => d.id === driverId);
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    driver.status = 'active';
    driver.routeCoordinates = routeCoordinates;
    driver.currentRouteIndex = 0;
    driver.destination = destinationName || 'Assigned Route';
    
    // Teleport to start of route if needed
    if (routeCoordinates && routeCoordinates.length > 0) {
      driver.lat = routeCoordinates[0][0];
      driver.lng = routeCoordinates[0][1];
    }
    
    res.json({ success: true, driver });
  });

  app.post("/api/drivers/:id/status", (req, res) => {
    const { status } = req.body;
    const driverId = req.params.id;
    const driver = fleetDrivers.find(d => d.id === driverId);
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    driver.status = status;
    if (status === 'break') {
      driver.eta = '-';
      driver.destination = '-';
      driver.speed = 0;
    } else {
      driver.eta = 'Calculating';
      driver.destination = 'Assigning...';
    }
    res.json({ success: true, driver });
  });

  // API Routes
  app.get("/api/config", (req, res) => {
    res.json({
      googleMapsApiKey: process.env.GOOGLE_MAPS_PLATFORM_KEY || ''
    });
  });

  app.get("/api/fleet", async (req, res) => {
    // In a real application, this would call a third-party API like Samsara or Geotab:
    // const fleetRes = await fetch('https://api.external-fleet.com/v1/vehicles', { headers: { Authorization: ... } });
    
    updateFleetMovement();
    
    // Add real-time timestamp or delay
    setTimeout(() => {
      res.json({ drivers: fleetDrivers, timestamp: new Date().toISOString() });
    }, 200); // Simulate network latency
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Update /api/route to use Google Maps Routes API if key is present
  app.get("/api/route", async (req, res) => {
    const { coordString } = req.query;
    if (!coordString || typeof coordString !== 'string') {
      return res.status(400).json({ error: "Missing or invalid coords" });
    }

    const gKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;

    // Use Google Routes API if available for better traffic data
    if (gKey && gKey !== 'YOUR_API_KEY') {
      try {
        const coords = coordString.split(';').map(c => {
          const [lng, lat] = c.split(',').map(Number);
          return { latitude: lat, longitude: lng };
        });

        if (coords.length < 2) throw new Error("At least origin and destination required");

        const origin = coords[0];
        const destination = coords[coords.length - 1];
        const intermediates = coords.slice(1, -1).map(c => ({ location: { latLng: c } }));

        const body = {
          origin: { location: { latLng: origin } },
          destination: { location: { latLng: destination } },
          intermediates,
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          polylineQuality: "OVERVIEW",
          computeAlternativeRoutes: false,
          languageCode: "en-US"
        };

        const gRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': gKey,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.staticDuration,routes.legs.steps'
          },
          body: JSON.stringify(body)
        });

        if (!gRes.ok) {
          const errText = await gRes.text();
          console.error("Google Routes API Error details:", errText);
          throw new Error("Google Routes service failed");
        }

        const gData: any = await gRes.json();
        
        if (gData.routes && gData.routes.length > 0) {
          const route = gData.routes[0];
          
          // Helper to decode polyline
          const decodePolyline = (encoded: string) => {
            const points = [];
            let index = 0, len = encoded.length;
            let lat = 0, lng = 0;
            while (index < len) {
              let b, shift = 0, result = 0;
              do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
              } while (b >= 0x20);
              const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
              lat += dlat;
              shift = 0;
              result = 0;
              do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
              } while (b >= 0x20);
              const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
              lng += dlng;
              points.push([lng / 1e5, lat / 1e5]); // [lng, lat] for geojson compatibility if needed, but the original OSRM response uses [lng, lat] in coordinates array
            }
            return points;
          };

          const points = decodePolyline(route.polyline.encodedPolyline);
          
          // Construct a response that matches the structure expected by the frontend
          // (which expects OSRM format)
          const mapGoogleManeuverToOSRM = (maneuver: string) => {
            if (!maneuver) return { type: 'continue', modifier: 'straight' };
            const m = maneuver.toUpperCase();
            if (m.includes('DEPART')) return { type: 'depart', modifier: 'straight' };
            if (m.includes('ARRIVE')) return { type: 'arrive', modifier: 'straight' };
            if (m.includes('ROUNDABOUT')) return { type: 'turn', modifier: 'straight' };
            
            let modifier = 'straight';
            if (m.includes('SLIGHT_LEFT')) modifier = 'slight left';
            else if (m.includes('SHARP_LEFT')) modifier = 'sharp left';
            else if (m.includes('LEFT')) modifier = 'left';
            else if (m.includes('SLIGHT_RIGHT')) modifier = 'slight right';
            else if (m.includes('SHARP_RIGHT')) modifier = 'sharp right';
            else if (m.includes('RIGHT')) modifier = 'right';
            else if (m.includes('UTURN')) modifier = 'uturn';
            
            return { type: 'turn', modifier };
          };

          return res.json({
            provider: "google",
            routes: [{
              geometry: {
                type: "LineString",
                coordinates: points
              },
              distance: route.distanceMeters,
              duration: parseInt(route.duration.replace('s', '')),
              legs: route.legs.map((leg: any) => ({
                duration: leg.duration ? parseInt(leg.duration.replace('s', '')) : 0,
                distance: leg.distanceMeters,
                steps: (leg.steps || []).map((step: any) => {
                  const instructions = step.navigationInstruction || {};
                  const nmInfo = mapGoogleManeuverToOSRM(instructions.maneuver);
                  return {
                    distance: step.distanceMeters,
                    duration: step.staticDuration ? parseInt(step.staticDuration.replace('s', '')) : 0,
                    name: instructions.instructions || '',
                    maneuver: nmInfo
                  };
                })
              }))
            }]
          });
        }
      } catch (err: any) {
        console.warn("Google Routes service skipped, using OSRM fallback:", err.message || err);
      }
    }

    // Default OSRM Fallback
    try {
      const response = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coordString}?source=first&destination=last&roundtrip=true&overview=full&geometries=geojson&steps=true`);
      if (!response.ok) {
        throw new Error("Trip service failed");
      }
      const data = await response.json();
      res.json({ ...data, provider: "osrm" });
    } catch (e) {
      try {
        const fallRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=true`);
        if (!fallRes.ok) throw new Error("OSRM route failed");
        const fallData = await fallRes.json();
        res.json({ ...fallData, provider: "osrm" });
      } catch (err) {
        res.status(500).json({ error: "Routing failed" });
      }
    }
  });

  app.get("/api/bins", async (req, res) => {
    const hasEvent = req.query.hasEvent === 'true';
    let tempC = parseFloat(req.query.temp as string);
    const useLiveWeather = req.query.liveWeather === 'true';

    if (useLiveWeather) {
      try {
        const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&current=temperature_2m");
        const text = await response.text();
        if (!response.ok) {
          throw new Error(`Weather fetch failed: ${text.substring(0, 50)}`);
        }
        try {
          const weatherData = JSON.parse(text);
          tempC = weatherData.current.temperature_2m;
        } catch (e: any) {
          throw new Error(`Failed to parse weather JSON: ${text.substring(0,50)}`);
        }
      } catch (e) {
        console.warn("Failed to fetch live weather", e);
        if (isNaN(tempC)) tempC = 22;
      }
    } else {
      if (isNaN(tempC)) tempC = 22;
    }

    let citizenReports: any[] = [];
    try {
      const reportsSnap = await getDocs(collection(db, 'reports'));
      citizenReports = reportsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error("Failed to fetch reports from Firebase", e);
    }

    const predictedBins = binsList.map(bin => {
      // Find valid recent reports (not marked fake, within an hour)
      const recentReports = citizenReports.filter(report => 
        report.binId === bin.id && 
        Date.now() - new Date(report.timestamp).getTime() < 3600000 &&
        !report.markedFake
      );
      
      const trustedReports = recentReports.filter(r => r.trustScore >= 50);
      const hasReport = trustedReports.length > 0;
      
      let predictedFillLevel = Math.round(predictFillLevel(bin, hasEvent, tempC, hasReport));
      if (bin.isManualPriority) predictedFillLevel = 100; // Force route override

      // Dynamic collection threshold based on temperature
      let collectionThreshold = 75; // Default threshold
      if (tempC >= 28) { // High heat lowers threshold to prevent odor
        collectionThreshold = bin.type === 'commercial' ? 50 : 60;
      } else if (tempC >= 22) {
        collectionThreshold = 65;
      }

      const needsCollection = predictedFillLevel >= collectionThreshold || bin.isManualPriority;

      return {
        ...bin,
        predictedFillLevel,
        hasReport,
        reportDetails: recentReports.length > 0 ? recentReports[recentReports.length - 1] : null,
        collectionThreshold,
        needsCollection
      };
    });

    res.json({ bins: predictedBins, tempC: Math.round(tempC) });
  });

  // Priority Toggle Endpoint
  app.post("/api/bins/:id/collect", (req, res) => {
    const binId = req.params.id;
    const bin = binsList.find(b => b.id === binId);
    if (!bin) return res.status(404).json({ error: "Bin not found" });

    // Mark collected
    bin.fillLevel = 0;
    bin.predictedFillLevel = 0;
    bin.needsCollection = false;
    bin.collectionThreshold = 80;

    res.json({ success: true, bin });
  });

  app.post("/api/bins/:id/priority", (req, res) => {
    const bin = binsList.find(b => b.id === req.params.id);
    if (!bin) return res.status(404).json({ error: "Bin not found" });

    bin.isManualPriority = req.body.isManualPriority;
    res.json({ success: true, bin });
  });

  // Verify report endpoint
  app.post("/api/reports/:id/verify", async (req, res) => {
    const reportId = req.params.id;
    const { isFake } = req.body;

    try {
      const reportRef = doc(db, 'reports', reportId);
      const reportDoc = await getDoc(reportRef);

      if (!reportDoc.exists()) return res.status(404).json({ error: "Report not found" });

      const report = reportDoc.data();
      
      if (isFake) {
        await updateDoc(reportRef, { markedFake: true });

        // Penalize user
        if (report && report.userId) {
          const userRef = doc(db, 'citizens', report.userId);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const newScore = Math.max(0, (userData?.reliabilityScore || 100) - 20);
            await updateDoc(userRef, {
              fakeReports: (userData?.fakeReports || 0) + 1,
              reliabilityScore: newScore
            });
            console.log(`User ${report.userId} penalized. New score: ${newScore}`);
            return res.json({ success: true, userScore: newScore });
          }
        }
      }
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
