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
    { id: '1', lat: 40.7128, lng: -74.0060, fillLevel: 85, zone: 'Downtown', lastUpdated: '2m ago', isPriority: true, isManualPriority: false, baseFillRate: 1.5, type: 'commercial' },
    { id: '2', lat: 40.7140, lng: -74.0020, fillLevel: 45, zone: 'Downtown', lastUpdated: '5m ago', isPriority: false, isManualPriority: false, baseFillRate: 1.2, type: 'commercial' },
    { id: '3', lat: 40.7155, lng: -74.0085, fillLevel: 20, zone: 'Downtown', lastUpdated: '10m ago', isPriority: false, isManualPriority: false, baseFillRate: 0.8, type: 'residential' },
    { id: '4', lat: 40.7095, lng: -74.0100, fillLevel: 92, zone: 'Financial', lastUpdated: '1m ago', isPriority: true, isManualPriority: false, baseFillRate: 1.8, type: 'commercial' },
    { id: '5', lat: 40.7075, lng: -74.0050, fillLevel: 78, zone: 'Financial', lastUpdated: '12m ago', isPriority: false, isManualPriority: false, baseFillRate: 1.4, type: 'commercial' },
    { id: '6', lat: 40.7160, lng: -74.0050, fillLevel: 10, zone: 'Midtown', lastUpdated: '15m ago', isPriority: false, isManualPriority: false, baseFillRate: 0.5, type: 'residential' },
    { id: '7', lat: 40.7135, lng: -74.0120, fillLevel: 88, zone: 'Financial', lastUpdated: 'Just now', isPriority: true, isManualPriority: false, baseFillRate: 1.6, type: 'commercial' },
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
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/bins", async (req, res) => {
    const hasEvent = req.query.hasEvent === 'true';
    let tempC = parseFloat(req.query.temp as string);
    const useLiveWeather = req.query.liveWeather === 'true';

    if (useLiveWeather) {
      try {
        const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m");
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
