import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Truck, Navigation, AlertTriangle, Coffee, MapPin, CheckCircle2, Clock, Battery, Loader2, Sparkles, Navigation2, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight, CircleDot, Check } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

const getTurnIcon = (modifier: string) => {
  switch (modifier) {
    case 'left': return <ArrowLeft size={20} className="text-indigo-600" />;
    case 'right': return <ArrowRight size={20} className="text-indigo-600" />;
    case 'straight': return <ArrowUp size={20} className="text-indigo-600" />;
    case 'slight left': return <ArrowUpLeft size={20} className="text-indigo-600" />;
    case 'slight right': return <ArrowUpRight size={20} className="text-indigo-600" />;
    case 'sharp left': return <ArrowLeft size={20} className="text-indigo-600" />;
    case 'sharp right': return <ArrowRight size={20} className="text-indigo-600" />;
    case 'uturn': return <ArrowUp size={20} className="text-indigo-600 rotate-180" />;
    default: return <CircleDot size={20} className="text-indigo-600" />;
  }
};

const depotIcon = L.divIcon({
  html: `<div style="background-color: #f43f5e; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
  className: '',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const truckIcon = L.divIcon({
  html: `<div style="background-color: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white;">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-9h-4V5h-4v12h1"/><path d="M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/><path d="M17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>
         </div>`,
  className: 'smooth-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const binIcon = L.divIcon({
  html: `<div style="background-color: #10b981; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function DriverPortal() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const fleetRes = await fetch('/api/fleet');
      const fleetData = await fleetRes.json();
      setDrivers(fleetData.drivers);
      
      const binsRes = await fetch('/api/bins');
      const binsData = await binsRes.json();
      setBins(binsData.bins);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const driver = drivers.find(d => d.id === selectedDriverId);

  // Helper to calculate distance
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const p = 0.017453292519943295;
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a));
  };

  const needingCollection = bins
    .filter(b => b.needsCollection)
    .filter(b => {
       if (!driver || !driver.lat || !driver.lng) return true;
       // Logic to detect if another truck is on the route to this bin (closer to it). Re-route if so.
       let amIClosest = true;
       const myDist = getDistance(driver.lat, driver.lng, b.lat, b.lng);
       drivers.forEach(otherDriver => {
         if (otherDriver.id !== driver.id && otherDriver.status === 'active' && otherDriver.lat && otherDriver.lng) {
            const otherDist = getDistance(otherDriver.lat, otherDriver.lng, b.lat, b.lng);
            // If another active truck is closer, let them handle it.
            if (otherDist < myDist) {
              amIClosest = false;
            }
         }
       });
       return amIClosest;
    })
    .sort((a, b) => {
       if (driver && driver.lat && driver.lng) {
         return getDistance(driver.lat, driver.lng, a.lat, a.lng) - getDistance(driver.lat, driver.lng, b.lat, b.lng);
       }
       return 0;
    });

  const toggleStatus = async (newStatus: string) => {
    if (!driver) return;
    try {
      await fetch(`/api/drivers/${driver.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const markCollected = async (binId: string) => {
    try {
      await fetch(`/api/bins/${binId}/collect`, { method: 'POST' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateAiTip = async () => {
    if (!driver) return;
    setGeneratingAi(true);
    try {
      const aiClient = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      const prompt = `
        You are an AI Safety Assistant for a waste collection truck driver. 
        Analyze the driver's current status and provide a 1-sentence safe driving tip or encouragement.
        
        Driver Info:
        - Name: \${driver.name}
        - Fatigue Level: \${driver.fatigueLevel}%
        - Status: \${driver.status}
        - Truck Fill Level: \${driver.fillLevel}%
        
        If fatigue > 80%, tell them to take a break safely. Otherwise, provide a concise smart-city route tip.
      `;

      const response = await aiClient.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      setAiTip(response.text || "Drive safely.");
    } catch (error) {
      console.error(error);
      setAiTip("Unable to fetch AI tip. Focus on the road and drive safely.");
    }
    setGeneratingAi(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!selectedDriverId) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="bg-white p-10 rounded-3xl shadow-xl w-full max-w-md border border-slate-200">
          <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 transform rotate-3">
            <Truck size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">Driver Portal</h1>
          <p className="text-slate-500 mb-8 font-medium leading-relaxed">Select your vehicle and start your shift to receive proactive AI-optimized routes.</p>
          
          <div className="space-y-4">
            {drivers.map(d => (
              <button
                key={d.id}
                onClick={() => setSelectedDriverId(d.id)}
                className="w-full bg-slate-50 border border-slate-200 hover:border-indigo-400 p-5 rounded-2xl flex items-center justify-between transition-all hover:bg-white hover:shadow-lg hover:shadow-indigo-500/10 group"
              >
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-4 shadow-sm ${d.status === 'active' ? 'bg-emerald-500 shadow-emerald-500/50' : d.status === 'break' ? 'bg-amber-500 shadow-amber-500/50' : 'bg-slate-300'}`} />
                  <div className="text-left">
                    <div className="font-bold text-slate-800 text-lg group-hover:text-indigo-700 transition-colors">{d.name}</div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">{d.truck} • {d.status}</div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 p-2 rounded-xl group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors">
                  <Navigation size={18} className="text-slate-400 group-hover:text-indigo-600" />
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-8 text-slate-400 text-xs font-bold tracking-widest uppercase">
          Powered by AntiGrid AI
        </div>
      </div>
    );
  }

  if (!driver) return null;

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans overflow-hidden">
      
      {/* Left Sidebar */}
      <div className="w-full lg:w-[450px] bg-white border-r border-slate-200 shadow-xl flex flex-col h-full z-10">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10 blur-[2px]">
            <Truck size={140} />
          </div>
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center space-x-3">
                <div className="bg-white/10 p-3 rounded-2xl border border-white/5">
                  <Truck size={24} className="text-indigo-300" />
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block mb-0.5">Active Driver</span>
                  <h2 className="text-xl font-bold tracking-tight">{driver.name}</h2>
                  <div className="text-indigo-300 text-xs font-bold mt-0.5">{driver.truck}</div>
                </div>
              </div>
              <button onClick={() => setSelectedDriverId('')} className="text-[10px] uppercase tracking-wider text-slate-400 hover:text-white font-black bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm transition-colors border border-white/5">
                Switch
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center">
                  <Battery size={14} className="mr-1" /> Load Capacity
                </div>
                <div className="text-2xl font-black">{driver.fillLevel}%</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center">
                  {driver.fatigueLevel > 80 ? <AlertTriangle size={14} className="mr-1 text-rose-400 animate-pulse" /> : <Clock size={14} className="mr-1" />} 
                  Fatigue Level
                </div>
                <div className={`text-2xl font-black ${driver.fatigueLevel > 80 ? 'text-rose-400' : ''}`}>{Math.round(driver.fatigueLevel)}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {driver.status === 'break' ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12 bg-white rounded-3xl border border-slate-200 shadow-sm px-6">
              <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-amber-200">
                <Coffee size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">You are on Break</h3>
              <p className="text-slate-500 font-medium mb-8 text-sm">Take your time. Hydrate and stretch before resuming your shift. Your route will be optimized while you rest.</p>
              <button 
                onClick={() => toggleStatus('active')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/30 text-lg flex justify-center items-center"
              >
                <CheckCircle2 size={24} className="mr-2" /> Resume Shift
              </button>
            </motion.div>
          ) : (
            <div className="space-y-6">
              
              {/* Next Navigation Target */}
              <div>
                <div className="flex items-center justify-between mb-3 pl-1">
                   <h3 className="font-bold text-slate-800 text-lg tracking-tight">Current Target</h3>
                   <span className="text-[10px] font-black tracking-widest uppercase text-indigo-600 bg-indigo-100 px-2 py-1 rounded">Optimized</span>
                </div>
                <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-200">
                  {needingCollection.length > 0 ? (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-2xl font-black text-slate-800 mb-1">Bin #{needingCollection[0].id}</h4>
                          <p className="text-sm font-semibold flex items-center text-slate-500">
                            <MapPin size={14} className="mr-1 text-rose-500" /> {needingCollection[0].zone}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">ETA</div>
                          <div className="font-black text-lg text-emerald-600">{driver.eta}</div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-3 mt-6">
                        <button className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md flex justify-center items-center">
                          <Navigation2 size={16} className="mr-2" /> Navigate
                        </button>
                        <button 
                          onClick={() => markCollected(needingCollection[0].id)}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md shadow-emerald-500/20 flex justify-center items-center"
                        >
                          <CheckCircle2 size={16} className="mr-2" /> Mark Collected
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 text-center bg-emerald-50 rounded-2xl border border-emerald-100">
                      <div className="w-12 h-12 bg-emerald-200 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 size={24} />
                      </div>
                      <h4 className="text-lg font-bold text-emerald-900 mb-1 tracking-tight">All Clear!</h4>
                      <p className="text-xs font-semibold text-emerald-700/70">No bins need immediate collection.<br/>Standby for new dispatches.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Assistant */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Sparkles size={64} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-indigo-900 flex items-center tracking-tight">
                      <div className="bg-indigo-600 p-1.5 rounded-lg mr-2"><Sparkles size={14} className="text-white" /></div>
                      AI Safety Coach
                    </h4>
                  </div>
                  <div className="text-sm font-medium text-indigo-800 mb-4 min-h-[40px] leading-relaxed">
                    {aiTip ? aiTip : "Get personalized driving and safety tips powered by AI based on your current metrics."}
                  </div>
                  <button 
                    onClick={handleGenerateAiTip}
                    disabled={generatingAi}
                    className="w-full bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold py-2.5 rounded-xl transition-colors shadow-sm flex justify-center items-center text-xs uppercase tracking-wider"
                  >
                    {generatingAi ? <><Loader2 size={14} className="animate-spin mr-2" /> Analyzing...</> : "Generate Safe Route Tip"}
                  </button>
                </div>
              </div>

              {/* Upcoming Route & Navigation */}
              {driver.navigationSteps && driver.navigationSteps.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden max-h-[400px]">
                  <div className="px-5 py-4 border-b border-indigo-100 flex items-center justify-between bg-indigo-50/80">
                    <h3 className="font-bold text-indigo-900 flex items-center">
                      <Navigation size={18} className="mr-2" /> Live Navigation
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {driver.navigationSteps.map((step: any, idx: number) => (
                      <div key={idx} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-start shadow-sm">
                        <div className="bg-indigo-100 p-2 rounded-lg shrink-0 mt-0.5">
                          {step.maneuver.type === 'arrive' ? <Check size={20} className="text-emerald-600" /> : getTurnIcon(step.maneuver.modifier)}
                        </div>
                        <div className="ml-4">
                          <p className="font-bold text-slate-800 text-sm">
                            {step.maneuver.type === 'depart' && 'Depart'}
                            {step.maneuver.type === 'turn' && 'Turn'}
                            {step.maneuver.type === 'continue' && 'Continue'}
                            {step.maneuver.type === 'new name' && 'Continue'}
                            {step.maneuver.type === 'arrive' && 'Arrive'}
                            {step.maneuver.modifier ? ` ${step.maneuver.modifier}` : ''}
                            {step.name ? ` onto ${step.name}` : ''}
                          </p>
                          {step.distance > 0 && (
                            <p className="text-xs text-slate-500 font-medium mt-1">In {step.distance >= 1000 ? (step.distance / 1000).toFixed(1) + ' km' : Math.round(step.distance) + ' m'}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!driver.navigationSteps && needingCollection.length > 1 && (
                <div>
                  <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-3 pl-1 uppercase">Upcoming Route Queue</h3>
                  <div className="space-y-2">
                    {needingCollection.slice(1, 4).map((b, i) => (
                      <div key={b.id} className="bg-white border border-slate-200 p-4 rounded-2xl flex justify-between items-center opacity-80">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-500 text-xs mr-3">
                            {i+2}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-sm">Bin #{b.id}</div>
                            <div className="text-xs text-slate-500 font-medium">{b.zone}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold uppercase text-rose-500 mb-0.5">Fill Level</div>
                          <div className="font-black text-sm text-slate-700">{b.fillLevel}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Bar Controls for Sidebar */}
        {driver.status === 'active' && (
          <div className="bg-white border-t border-slate-200 p-4 shrink-0 flex justify-between items-center">
             <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Status</span>
               <span className="text-emerald-500 font-bold tracking-tight text-sm">ACTIVE SHIFT</span>
             </div>
             
             <button 
               onClick={() => toggleStatus('break')}
               className="bg-amber-100 text-amber-700 hover:bg-amber-200 font-bold py-2.5 px-5 rounded-xl transition-colors flex items-center text-sm shadow-sm"
             >
               <Coffee size={16} className="mr-2" /> Start Break
             </button>
          </div>
        )}
      </div>

      {/* Right Map Area (Desktop/Tablet) */}
      <div className="hidden lg:block relative flex-1 bg-slate-200 border-l border-slate-200 shadow-inner">
        <MapContainer center={[28.6415, 77.2183]} zoom={13} className="w-full h-full z-0 font-sans" zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          
          <Marker position={[28.6415, 77.2183]} icon={depotIcon}>
            <Popup className="font-sans font-bold">HQ Depot</Popup>
          </Marker>

          {/* Draw needy bins */}
          {needingCollection.map((bin) => (
            <Marker key={bin.id} position={[bin.lat, bin.lng]} icon={binIcon}>
              <Popup className="font-sans">
                <div className="font-bold text-slate-800 text-sm mb-1">Bin #{bin.id}</div>
                <div className="text-xs text-slate-500">{bin.zone} • {bin.fillLevel}% Full</div>
              </Popup>
            </Marker>
          ))}

          {/* Draw driver if active */}
          {driver.status === 'active' && driver.lat && driver.lng && (
            <Marker position={[driver.lat, driver.lng]} icon={truckIcon} zIndexOffset={1000}>
              <Popup className="font-sans">
                <div className="font-bold text-slate-800 text-sm mb-1">{driver.name}</div>
                <div className="text-xs text-slate-500">Speed: {driver.speed} km/h</div>
              </Popup>
            </Marker>
          )}

          {/* Draw route line to next bin if active */}
          {driver.status === 'active' && driver.lat && needingCollection.length > 0 && (
            <Polyline
               positions={[
                 [driver.lat, driver.lng],
                 [needingCollection[0].lat, needingCollection[0].lng]
               ]}
               color="#3b82f6"
               weight={4}
               dashArray="8, 8"
               className="animate-pulse"
            />
          )}
        </MapContainer>
        
        {/* Map Overlay Controls */}
        <div className="absolute top-6 right-6 z-[400] bg-white p-3 rounded-2xl shadow-lg border border-slate-200 max-w-[200px] pointer-events-none text-center">
          <div className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded inline-block uppercase tracking-widest mb-1 shadow-sm border border-blue-100">Live GPS</div>
          <div className="text-slate-600 text-xs font-medium">Tracking and optimizing route dynamically.</div>
        </div>
      </div>

    </div>
  );
}
