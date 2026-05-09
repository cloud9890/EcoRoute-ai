import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, Truck, User, MapPin, AlertTriangle, Clock, Target, Activity, Sparkles, Loader2 } from 'lucide-react';
import ReactDOMServer from 'react-dom/server';
import { GoogleGenAI } from '@google/genai';

const DEPOT_COORDS: [number, number] = [28.6415, 77.2183];

function MapAutoCenter({ target }: { target: any }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.setView([target.lat, target.lng], 15, { animate: true });
    }
  }, [target, map]);
  return null;
}

const createDriverIcon = (status: string) => {
  const color = status === 'active' ? '#10b981' : status === 'break' ? '#f59e0b' : '#64748b';
  const svg = ReactDOMServer.renderToString(
    <div style={{ color: color, filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.25))' }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill={color} stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5"></circle>
        <circle cx="18.5" cy="18.5" r="2.5"></circle>
      </svg>
    </div>
  );
  return L.divIcon({
    html: svg,
    className: 'smooth-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const createDepotIcon = () => {
  const svg = ReactDOMServer.renderToString(
    <div style={{ color: '#3b82f6', filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.25))' }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#3b82f6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    </div>
  );
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};


export default function TrackingView({ drivers = [] }: { drivers: any[] }) {
  const activeDrivers = drivers.filter(d => d.status !== 'off-duty');
  const [followedDriverId, setFollowedDriverId] = useState<string | null>(null);
  
  const [aiTrafficInsight, setAiTrafficInsight] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  const followedDriver = activeDrivers.find(d => d.id === followedDriverId);

  const handleGenerateTrafficInsight = async () => {
    setGeneratingAi(true);
    try {
      const prompt = `
        You are a smart AI Traffic Analyst monitoring waste management truck speeds and routes.
        Look at these active drivers and their speeds/ETA. Give a 2-sentence situational update. Is anyone delayed or speeding?
        
        Drivers: \${JSON.stringify(activeDrivers.map(d => ({ name: d.name, speed: d.speed, dest: d.destination, eta: d.eta })))}
      `;

      const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await aiClient.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiTrafficInsight(response.text || "Insight generation failed.");
    } catch (error) {
      console.error(error);
      setAiTrafficInsight("Failed to generate AI insight. Ensure your API key is correctly configured.");
    }
    setGeneratingAi(false);
  };


  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Live Driver Tracking</h2>
          <p className="text-slate-500 font-medium text-sm sm:text-base mt-1">Real-time GPS tracking of active fleet vehicles.</p>
        </div>
        <div className="flex space-x-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
           <div className="flex items-center text-sm font-bold text-slate-700">
             <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2 border border-white"></div> Active
           </div>
           <div className="flex items-center text-sm font-bold text-slate-700">
             <div className="w-3 h-3 rounded-full bg-amber-500 mr-2 border border-white"></div> Break
           </div>
        </div>
      </div>

      {/* AI Traffic Analyst Panel */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
        className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles size={64} className="text-indigo-600" />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center relative z-10">
          <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-md shadow-indigo-600/30 shrink-0">
            <Sparkles size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-indigo-950 text-lg mb-1">AI Route Monitor</h3>
            <div className="text-indigo-800/80 text-sm font-medium">
              {aiTrafficInsight ? (
                <p className="leading-relaxed">{aiTrafficInsight}</p>
              ) : (
                <p>Analyze live telematics to detect traffic anomalies, vehicle delays, or routing inefficiencies.</p>
              )}
            </div>
          </div>
          <button 
            onClick={handleGenerateTrafficInsight}
            disabled={generatingAi}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors shadow-sm shadow-indigo-600/20 flex items-center"
          >
            {generatingAi ? (
              <><Loader2 size={16} className="animate-spin mr-2" /> Analyzing Routes...</>
            ) : (
              <><Sparkles size={16} className="mr-2" /> Scan Routes</>
            )}
          </button>
        </div>
      </motion.div>

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6 h-[70vh] min-h-[500px]">
        
        {/* Map View */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full h-full lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative"
        >
          {followedDriverId && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-indigo-200 flex items-center space-x-3">
               <span className="flex items-center text-indigo-700 font-bold text-sm">
                 <Target size={16} className="mr-2 animate-pulse" /> Following {followedDriver?.name}
               </span>
               <button 
                 onClick={() => setFollowedDriverId(null)}
                 className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-md font-semibold transition-colors"
               >
                 Cancel
               </button>
            </div>
          )}

          <MapContainer center={DEPOT_COORDS} zoom={13} className="w-full h-full z-0 font-sans" zoomControl={true}>
            {followedDriver && <MapAutoCenter target={followedDriver} />}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {/* Depot Marker */}
            <Marker position={DEPOT_COORDS} icon={createDepotIcon()}>
              <Popup className="font-sans">
                <div className="font-bold text-slate-800">Central Dispatch</div>
                <div className="text-xs text-slate-500">Fleet HQ</div>
              </Popup>
            </Marker>
            
            {/* Driver Markers */}
            {activeDrivers.map(driver => (
              <React.Fragment key={driver.id}>
                <Marker 
                  position={[driver.lat, driver.lng]}
                  icon={createDriverIcon(driver.status)}
                >
                  <Popup className="font-sans min-w-[200px]">
                    <div className="space-y-2">
                      <div className="font-bold text-slate-800 text-base flex justify-between items-center">
                        {driver.name}
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center border border-emerald-100">
                          <Activity size={10} className="mr-1" /> {driver.speed || 0} km/h
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                         <span className="font-semibold text-slate-500">{driver.id} • {driver.truck}</span>
                         <span className={`px-2 py-0.5 rounded uppercase font-bold tracking-wider ${driver.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                           {driver.status}
                         </span>
                      </div>
                      <div className="h-px w-full bg-slate-100 my-2"></div>
                      <div className="text-xs font-semibold text-slate-600 space-y-1">
                        <div className="flex"><MapPin size={12} className="mr-1 text-slate-400" /> Loc: {driver.location}</div>
                        <div className="flex"><Navigation size={12} className="mr-1 text-indigo-400" /> Dest: {driver.destination}</div>
                        <div className="flex text-amber-600"><Truck size={12} className="mr-1" /> Load: {driver.fillLevel}%</div>
                        
                        {driver.fatigueLevel !== undefined && (
                          <div className="pt-2 mt-2 border-t border-slate-100 flex flex-col space-y-1">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="flex items-center text-slate-500">
                                 {driver.fatigueLevel > 80 && <AlertTriangle size={10} className="text-rose-500 mr-1 animate-pulse" />}
                                 Fatigue
                              </span>
                              <span className={driver.fatigueLevel > 80 ? 'text-rose-600 font-bold' : ''}>{Math.round(driver.fatigueLevel)}%</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500">
                              <span className="flex items-center"><Clock size={10} className="mr-1" /> Idle: {driver.idleTime}m</span>
                              <span>Adherence: {driver.routeAdherence}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="pt-2 mt-1 border-t border-slate-100">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setFollowedDriverId(driver.id);
                          }}
                          className="w-full text-center py-1.5 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          Follow on Map
                        </button>
                      </div>
                    </div>
                  </Popup>
                  <Tooltip direction="bottom" offset={[0, 10]} opacity={0.9} permanent={false}>
                    <span className="font-bold text-slate-800">{driver.name} - {driver.speed || 0} km/h</span>
                  </Tooltip>
                </Marker>
                
                {/* Driver History Trail */}
                {driver.history && driver.history.length > 1 && (
                  <Polyline 
                    positions={driver.history} 
                    color={driver.status === 'active' ? '#10b981' : '#f59e0b'} 
                    weight={3} 
                    opacity={0.3} 
                  />
                )}

                {/* Driver Assigned Route */}
                {driver.routeCoordinates && driver.routeCoordinates.length > 0 && (
                  <Polyline 
                    positions={driver.routeCoordinates.slice(driver.currentRouteIndex)} 
                    color="#6366f1" 
                    weight={4} 
                    opacity={0.6} 
                    dashArray="4 8"
                  />
                )}
              </React.Fragment>
            ))}
            
          </MapContainer>
        </motion.div>

        {/* Driver List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
           <div className="p-4 border-b border-slate-100 bg-slate-50/50">
             <h3 className="font-bold text-slate-800 flex items-center"><User size={16} className="mr-2 text-indigo-500" /> Active Roster</h3>
           </div>
           <div className="overflow-y-auto flex-1 p-2 space-y-2">
             {activeDrivers.map(driver => (
               <div 
                 key={driver.id} 
                 className={`p-3 rounded-xl border transition-colors cursor-pointer ${followedDriverId === driver.id ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50 border-transparent hover:border-slate-100'}`}
                 onClick={() => setFollowedDriverId(followedDriverId === driver.id ? null : driver.id)}
               >
                 <div className="flex justify-between items-center mb-1 text-sm">
                   <div className="font-bold text-slate-800 flex items-center">
                     {driver.name}
                   </div>
                   <div className={`w-2.5 h-2.5 rounded-full ${driver.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                 </div>
                 <div className="text-[10px] tracking-wider font-bold text-slate-500 flex flex-col space-y-1">
                    <div className="flex justify-between uppercase">
                      <span>{driver.truck} ({driver.speed || 0} km/h)</span>
                      <span>Load: {driver.fillLevel}%</span>
                    </div>
                    {driver.fatigueLevel !== undefined && (
                      <div className={`flex justify-between ${driver.fatigueLevel > 80 ? 'text-rose-600' : 'text-slate-400'}`}>
                         <span className="flex items-center">
                           {driver.fatigueLevel > 80 && <AlertTriangle size={10} className="mr-1" />}
                           Fatigue: {Math.round(driver.fatigueLevel)}%
                         </span>
                         <span>Idle: {driver.idleTime}m</span>
                      </div>
                    )}
                 </div>
               </div>
             ))}
             {activeDrivers.length === 0 && (
               <div className="p-4 text-center text-sm font-semibold text-slate-500">
                 No active drivers on duty.
               </div>
             )}
           </div>
        </div>

      </div>
    </div>
  );
}
