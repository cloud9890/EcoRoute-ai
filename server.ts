import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


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

  const citizenReports: any[] = [];

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

  // API Routes
  app.get("/api/fleet", async (req, res) => {
    // In a real application, this would call a third-party API like Samsara or Geotab:
    // const fleetRes = await fetch('https://api.external-fleet.com/v1/vehicles', { headers: { Authorization: ... } });
    
    // Simulate real-time dynamic data for demonstration
    const simulateStatus = () => Math.random() > 0.8 ? 'break' : 'active';
    
    const drivers = [
      { id: 'D-101', name: 'Alex Johnson', status: 'active', truck: 'TRK-402', fillLevel: Math.floor(Math.random() * 20) + 30, location: 'Barakhamba Road', destination: 'Bin #1', eta: `${Math.floor(Math.random() * 5) + 2} min` },
      { id: 'D-102', name: 'Sarah Miller', status: 'break', truck: 'TRK-405', fillLevel: 80, location: 'Depot (NDLS)', destination: '-', eta: '-' },
      { id: 'D-103', name: 'Mike Chen', status: 'active', truck: 'TRK-408', fillLevel: Math.floor(Math.random() * 10) + 10, location: 'Connaught Place', destination: 'Bin #4', eta: `${Math.floor(Math.random() * 3) + 1} min` },
      { id: 'D-104', name: 'Emily Davis', status: 'off-duty', truck: 'TRK-412', fillLevel: 0, location: 'Depot (Sadar)', destination: '-', eta: '-' }
    ];
    
    // Add real-time timestamp or delay
    setTimeout(() => {
      res.json({ drivers, timestamp: new Date().toISOString() });
    }, 500); // Simulate network latency
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy to OSRM Trip API
  app.get("/api/route", async (req, res) => {
    const { coordString } = req.query;
    if (!coordString || typeof coordString !== 'string') {
      return res.status(400).json({ error: "Missing or invalid coords" });
    }
    try {
      const response = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coordString}?source=first&destination=last&roundtrip=true&overview=full&geometries=geojson&steps=true`);
      if (!response.ok) {
        throw new Error("Trip service failed");
      }
      const data = await response.json();
      res.json(data);
    } catch (e) {
      try {
        const fallRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=true`);
        if (!fallRes.ok) throw new Error("OSRM route failed");
        const fallData = await fallRes.json();
        res.json(fallData);
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
        const weatherData = await response.json();
        tempC = weatherData.current.temperature_2m;
      } catch (e) {
        console.error("Failed to fetch live weather", e);
        if (isNaN(tempC)) tempC = 22;
      }
    } else {
      if (isNaN(tempC)) tempC = 22;
    }

    const predictedBins = binsList.map(bin => {
      const hasReport = citizenReports.some(report => report.binId === bin.id && Date.now() - new Date(report.timestamp).getTime() < 3600000); // report within last hour
      
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
        collectionThreshold,
        needsCollection
      };
    });

    res.json({ bins: predictedBins, tempC: Math.round(tempC) });
  });

  // Priority Toggle Endpoint
  app.post("/api/bins/:id/priority", (req, res) => {
    const bin = binsList.find(b => b.id === req.params.id);
    if (!bin) return res.status(404).json({ error: "Bin not found" });

    bin.isManualPriority = req.body.isManualPriority;
    res.json({ success: true, bin });
  });

  // Citizen Report Endpoint
  app.post("/api/reports", (req, res) => {
    const { binId, isOverflowing } = req.body;
    if (!binId) return res.status(400).json({ error: "Missing binId" });

    const newReport = {
      id: Math.random().toString(36).substr(2, 9),
      binId,
      isOverflowing,
      timestamp: new Date().toISOString()
    };
    
    citizenReports.push(newReport);
    console.log(`New citizen report received for Bin ${binId}`);
    
    res.json({ success: true, report: newReport });
  });

  // AI Briefing Endpoint
  app.post("/api/ai-briefing", async (req, res) => {
    const { binsContext, routeDetails, weatherContext } = req.body;
    
    try {
      const prompt = `
        You are EcoRouteAI, an automated dispatch assistant for a smart city sanitation department.
        Review the following real-time data and provide a concise, maximum 3-sentence operational brief for the dispatch team.
        Do not use markdown formatting. Be professional, urgent if necessary, and data-driven. Keep it under 250 characters if possible.

        Context:
        Weather: ${weatherContext.tempC}°C, Live Weather Enabled: ${weatherContext.liveWeather}
        Bins that need collection: ${binsContext.needingCollection}
        Total distance of proposed route: ${routeDetails ? (routeDetails.distance / 1000).toFixed(1) + 'km' : 'N/A'}
        Estimated duration: ${routeDetails ? Math.ceil(routeDetails.duration / 60) + ' mins' : 'N/A'}
        High urgency bins: ${binsContext.highUrgency} 
        Active citizen reports: ${binsContext.hasReports ? 'Yes' : 'No'}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      res.json({ text: response.text });
    } catch (e) {
      console.error("AI Briefing error:", e);
      res.status(500).json({ error: "Failed to generate briefing" });
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
