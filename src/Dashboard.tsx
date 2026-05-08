import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Map as MapIcon,
  Truck,
  BarChart3,
  Settings,
  Bell,
  Search,
  AlertTriangle,
  TrendingDown,
  Navigation,
  Trash2,
  Calendar,
  CloudLightning,
  MapPin,
  RefreshCw,
  Sun,
  ThermometerSun,
  CheckCircle2,
  X,
  History,
  Activity
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';

const createCustomIcon = (fillLevel: number) => {
  let bgClass = 'bg-emerald-500';
  let borderClass = 'border-emerald-600';
  if (fillLevel >= 80) {
    bgClass = 'bg-rose-500';
    borderClass = 'border-rose-600';
  } else if (fillLevel >= 50) {
    bgClass = 'bg-amber-400';
    borderClass = 'border-amber-500';
  }

  const html = `
    <div class="relative flex h-8 w-8 items-center justify-center rounded-full border-[3px] shadow-lg text-white font-bold text-[10px] transform transition-transform hover:scale-110 ${bgClass} ${borderClass}">
      ${fillLevel}%
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-icon',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const DEPOT_COORDS: [number, number] = [40.7100, -74.0040];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hoveredBin, setHoveredBin] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<any | null>(null);
  
  // Dashboard state
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulateEvent, setSimulateEvent] = useState(false);
  const [temperature, setTemperature] = useState(22);
  const [useLiveWeather, setUseLiveWeather] = useState(false);

  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [fetchingRoute, setFetchingRoute] = useState(false);
  const [routeDetails, setRouteDetails] = useState<{distance: number, duration: number} | null>(null);

  const fetchBins = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bins?hasEvent=${simulateEvent}&temp=${temperature}&liveWeather=${useLiveWeather}`);
      const data = await res.json();
      setBins(data.bins);
      if (useLiveWeather) {
        setTemperature(data.tempC);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const toggleManualPriority = async (binId: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/bins/${binId}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isManualPriority: !currentStatus })
      });
      fetchBins();
      if (selectedBin && selectedBin.id === binId) {
        setSelectedBin({ 
          ...selectedBin, 
          isManualPriority: !currentStatus, 
          predictedFillLevel: !currentStatus ? 100 : selectedBin.predictedFillLevel 
        });
      }
    } catch(e) {
      console.error(e)
    }
  };

  useEffect(() => {
    fetchBins();
    const interval = setInterval(fetchBins, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [simulateEvent, temperature, useLiveWeather]);

  const needingCollection = bins.filter(b => b.needsCollection);
  
  useEffect(() => {
    let active = true;

    const fetchRoute = async () => {
      const sortedCollection = [...needingCollection].sort((a, b) => b.predictedFillLevel - a.predictedFillLevel);
      const waypoints = [
        DEPOT_COORDS,
        ...sortedCollection.map(b => [b.lat, b.lng] as [number, number]),
        DEPOT_COORDS
      ];

      if (waypoints.length < 2) {
        if (active) {
          setRouteCoordinates([]);
          setRouteDetails(null);
        }
        return;
      }

      if (active) setFetchingRoute(true);
      const coordString = waypoints.map(wp => `${wp[1]},${wp[0]}`).join(';');
      
      try {
        // Try trip API first for optimized TSP routing
        const res = await fetch(`https://router.project-osrm.org/trip/v1/driving/${coordString}?source=first&destination=last&roundtrip=true&overview=full&geometries=geojson`);
        if (!res.ok) throw new Error("Trip service failed");
        
        const data = await res.json();
        if (active && data.trips && data.trips.length > 0) {
          const coords = data.trips[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          setRouteCoordinates(coords);
          setRouteDetails({
            distance: data.trips[0].distance,
            duration: data.trips[0].duration
          });
        } else {
          throw new Error("No trips generated");
        }
      } catch (e) {
        // Fallback to strict route API
        try {
          const resRoute = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`);
          const dataRoute = await resRoute.json();
          if (active && dataRoute.routes && dataRoute.routes.length > 0) {
            const coords = dataRoute.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
            setRouteCoordinates(coords);
            setRouteDetails({
              distance: dataRoute.routes[0].distance,
              duration: dataRoute.routes[0].duration
            });
          } else if (active) {
            setRouteCoordinates(waypoints);
            setRouteDetails(null);
          }
        } catch (err) {
          console.error("Failed to fetch route", err);
          if (active) {
            setRouteCoordinates(waypoints);
            setRouteDetails(null);
          }
        }
      } finally {
        if (active) setFetchingRoute(false);
      }
    };

    if (needingCollection.length > 0) {
      fetchRoute();
    } else {
      setRouteCoordinates([]);
      setRouteDetails(null);
    }
    
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(needingCollection.map(b => b.id))]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -250 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between"
      >
        <div>
          <div className="h-16 flex items-center px-6 border-b border-slate-800">
            <motion.div 
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
              className="mr-3 text-emerald-500"
            >
              <Navigation size={24} />
            </motion.div>
            <span className="text-xl font-bold text-white tracking-tight">EcoRoute<span className="text-emerald-500">AI</span></span>
          </div>
          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'routes', icon: MapIcon, label: 'Live Routing' },
              { id: 'fleet', icon: Truck, label: 'Fleet & Drivers' },
              { id: 'analytics', icon: BarChart3, label: 'Predictive Analytics' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'hover:bg-slate-800/50 hover:text-emerald-400'
                }`}
              >
                <item.icon size={20} className={activeTab === item.id ? "text-emerald-500" : ""} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <button className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg hover:bg-slate-800/50 hover:text-white transition-colors duration-200">
            <Settings size={20} />
            <span className="font-medium">Settings</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex items-center space-x-4">
            <div className="text-sm font-medium text-slate-500">
              Department of Sanitation <span className="mx-2">•</span> District 1A
            </div>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-emerald-100/50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse mt-[1px]"></div>
              System Active
            </motion.div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Search bins, drivers..." 
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-full text-sm bg-slate-50 flex focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all w-64 group-hover:bg-white"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>
            <button className="relative p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
              <Bell size={20} />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-300 border-2 border-white shadow-sm"></div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-auto p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Total Active Bins', value: bins.length.toString(), desc: 'Live connected modules', icon: Trash2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
                { label: 'Critical Fill Level', value: needingCollection.length.toString(), desc: 'Immediate routing required', icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-100' },
                { label: 'Avg System Prediction', value: bins.length ? Math.round(bins.reduce((acc, b) => acc + b.predictedFillLevel, 0) / bins.length) + '%' : '0%', desc: 'Based on ML forecasts', icon: CloudLightning, color: 'text-amber-600', bg: 'bg-amber-100' },
                { label: 'Daily CO2 Reduction', value: '2.4t', desc: 'Versus static routing', icon: TrendingDown, color: 'text-teal-600', bg: 'bg-teal-100' }
              ].map((stat, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  key={i}
                  className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                      <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{stat.value}</h3>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
                      <stat.icon size={20} />
                    </div>
                  </div>
                  <div className="mt-4 text-xs font-medium text-slate-400">
                    {stat.desc}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Simulators */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center gap-4 lg:gap-6"
            >
              <div className="text-sm font-bold text-slate-800 flex items-center shrink-0">
                <CloudLightning size={16} className="text-emerald-500 mr-2" /> ML Context
              </div>
              
              <div className="hidden lg:block h-8 w-px bg-slate-200"></div>
              
              <label className="flex items-center space-x-2 text-sm text-slate-700 font-medium cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={simulateEvent}
                  onChange={(e) => setSimulateEvent(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <Calendar size={16} />
                <span>Major Event Nearby</span>
              </label>

              <div className="hidden sm:block h-6 w-px bg-slate-200"></div>

              <label className="flex items-center space-x-2 text-sm text-slate-700 font-medium cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={useLiveWeather}
                  onChange={(e) => setUseLiveWeather(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <Sun size={16} />
                <span>Live Weather (API)</span>
              </label>

              <div className={`flex items-center space-x-2 text-sm text-slate-700 font-medium transition-opacity ${useLiveWeather ? 'opacity-50 pointer-events-none' : ''}`}>
                <ThermometerSun size={16} />
                <span className="w-20">Temp: {temperature}°C</span>
                <input 
                  type="range" 
                  min="0" max="40" 
                  value={temperature}
                  onChange={(e) => setTemperature(parseInt(e.target.value))}
                  disabled={useLiveWeather}
                  className="w-24 accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex-1"></div>

              <button 
                onClick={fetchBins}
                className="flex items-center text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors shrink-0"
              >
                <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                Recalculate
              </button>
            </motion.div>

            {/* Map and Route section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">
              
              {/* Map View */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative"
              >
                <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3 pointer-events-none">
                  <div className="flex items-center text-sm font-medium"><div className="w-3 h-3 rounded-full bg-rose-500 mr-2 shadow-sm"></div> Critical</div>
                  <div className="flex items-center text-sm font-medium"><div className="w-3 h-3 rounded-full bg-amber-400 mr-2 shadow-sm"></div> Warning</div>
                  <div className="flex items-center text-sm font-medium"><div className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-sm"></div> Normal</div>
                </div>

                <MapContainer 
                  center={[40.7128, -74.0060]} 
                  zoom={14} 
                  style={{ height: '100%', width: '100%', zIndex: 10 }}
                  zoomControl={false}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; OpenStreetMap &copy; CARTO'
                  />
                  
                  {bins.length > 0 && needingCollection.length > 0 && (
                    <Polyline 
                      positions={routeCoordinates} 
                      pathOptions={{ color: '#0ea5e9', weight: 4, opacity: 0.7, dashArray: fetchingRoute ? '8, 10' : undefined, lineJoin: 'round' }} 
                    />
                  )}

                  {bins.map(bin => (
                    <Marker 
                      key={bin.id} 
                      position={[bin.lat, bin.lng]}
                      icon={createCustomIcon(bin.predictedFillLevel)}
                      eventHandlers={{
                        click: () => setSelectedBin(bin)
                      }}
                    />
                  ))}

                  {/* Depot Marker */}
                  <Marker 
                    position={DEPOT_COORDS}
                    icon={L.divIcon({
                      className: 'bg-transparent',
                      html: '<div class="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center border-2 border-white shadow-lg"><div class="w-2 h-2 bg-white rounded-sm"></div></div>',
                      iconSize: [24,24],
                      iconAnchor: [12,12]
                    })}
                  />
                </MapContainer>
                
                {/* Floating Map Actions */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400]">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/20 px-6 py-3 rounded-full font-semibold tracking-wide flex items-center space-x-2 transition-colors border border-emerald-500"
                  >
                    <Truck size={18} />
                    <span>Dispatch Automated Route</span>
                  </motion.button>
                </div>
                
                {/* Detailed Bin Drawer */}
                <AnimatePresence>
                  {selectedBin && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="absolute top-4 right-4 bottom-4 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[500] flex flex-col overflow-hidden"
                    >
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${selectedBin.needsCollection ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                          <h3 className="font-bold text-slate-800">Bin #{selectedBin.id}</h3>
                        </div>
                        <button onClick={() => setSelectedBin(null)} className="text-slate-400 hover:text-slate-700 bg-white shadow-sm p-1.5 rounded-full border border-slate-200">
                          <X size={16} />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        {/* Prediction Breakdown */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center mb-3">
                            <Activity size={14} className="mr-1.5" /> ML Prediction Factors
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">Historical Base</span>
                              <span className="font-bold text-slate-800">{Math.round(selectedBin.baseFillRate * 30)}%</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">Event Factor</span>
                              <span className="font-bold text-slate-800">{simulateEvent ? '+40%' : '0%'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">Weather Adjust</span>
                              <span className="font-bold text-slate-800">{temperature > 30 ? '+15%' : temperature < 10 ? '-5%' : '0%'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-slate-600">Dynamic Threshold</span>
                              <span className="font-bold text-slate-800">{selectedBin.collectionThreshold}%</span>
                            </div>
                            {selectedBin.hasReport && (
                              <div className="flex justify-between items-center text-sm bg-rose-50 p-2 rounded-lg text-rose-700 border border-rose-100">
                                <span className="font-semibold flex items-center"><AlertTriangle size={14} className="mr-1" /> Citizen Report</span>
                                <span className="font-bold flex items-center">Override</span>
                              </div>
                            )}
                            <div className="border-t pt-2 flex justify-between items-center text-sm">
                              <span className="font-bold text-slate-800">Final Prediction</span>
                              <span className={`font-bold px-2 py-0.5 rounded text-white ${selectedBin.needsCollection ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                                {selectedBin.predictedFillLevel}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Historical Chart */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center mb-4">
                            <History size={14} className="mr-1.5" /> 7-Day Trend
                          </h4>
                          <div className="h-32 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={[
                                { day: 'M', fill: Math.min((selectedBin.baseFillRate * 30) % 100, 95) },
                                { day: 'T', fill: Math.min((selectedBin.baseFillRate * 40) % 100, 95) },
                                { day: 'W', fill: Math.min((selectedBin.baseFillRate * 50) % 100, 95) },
                                { day: 'T', fill: Math.min((selectedBin.baseFillRate * 60) % 100, 95) },
                                { day: 'F', fill: Math.min((selectedBin.baseFillRate * 20) % 100, 95) }, // Collection day
                                { day: 'S', fill: Math.min((selectedBin.baseFillRate * 35) % 100, 95) },
                                { day: 'S', fill: Math.min((selectedBin.baseFillRate * 45) % 100, 95) }
                              ]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                                <RechartsTooltip 
                                  cursor={{ fill: '#f1f5f9' }}
                                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="fill" fill="#10b981" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Manual Override Action */}
                      <div className="p-5 border-t border-slate-100 bg-slate-50">
                        <button 
                          onClick={() => toggleManualPriority(selectedBin.id, selectedBin.isManualPriority)}
                          className={`w-full py-2.5 rounded-lg font-bold text-sm transition-all shadow-sm flex items-center justify-center ${
                            selectedBin.isManualPriority 
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                              : 'bg-slate-800 text-white hover:bg-slate-900 border border-slate-700'
                          }`}
                        >
                          {selectedBin.isManualPriority ? 'Remove Route Override' : 'Force Priority Route'}
                        </button>
                        <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
                          {selectedBin.isManualPriority ? 'This bin is manually forced into the driver route.' : 'Overrides ML to force collection next round.'}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Next Route Sheet */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden"
              >
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 text-lg">Next Opti-Route™</h3>
                  <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">
                    <Calendar size={18} />
                  </div>
                </div>
                <div className="px-6 py-4 border-b border-slate-50">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500 font-medium">Estimated Duration</span>
                    <span className="font-bold text-slate-800">
                      {fetchingRoute ? <span className="text-emerald-500 animate-pulse">Calculating...</span> : routeDetails ? `${Math.ceil(routeDetails.duration / 60)} mins` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500 font-medium">Total Distance</span>
                    <span className="font-bold text-slate-800">
                      {fetchingRoute ? '-' : routeDetails ? `${(routeDetails.distance / 1000).toFixed(1)} km` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-medium">Predicted Overflow Prevention</span>
                    <span className="font-bold text-emerald-600">100%</span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-1">
                    {needingCollection.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-medium">
                        <CheckCircle2 size={40} className="mx-auto mb-2 text-emerald-400" />
                        No bins require collection based on predictions.
                      </div>
                    ) : (
                      needingCollection.sort((a,b) => b.predictedFillLevel - a.predictedFillLevel).map((bin, i) => (
                        <motion.div
                          key={bin.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 + (i * 0.1) }}
                          onMouseEnter={() => setHoveredBin(bin.id)}
                          onMouseLeave={() => setHoveredBin(null)}
                          className={`group flex items-center p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                            hoveredBin === bin.id ? 'bg-slate-50 shadow-sm border border-slate-200' : 'border border-transparent hover:bg-slate-50/80'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-white">
                            {i + 1}
                          </div>
                          <div className="ml-4 flex-1">
                            <p className="font-semibold text-slate-800 text-sm flex items-center">
                              Bin #{bin.id}
                              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium border border-rose-100">
                                {bin.predictedFillLevel}%
                              </span>
                              {bin.hasReport && (
                                <AlertTriangle size={14} className="ml-2 text-rose-500" />
                              )}
                            </p>
                            <p className="text-xs text-slate-500 font-medium flex items-center mt-0.5">
                              <MapPin size={10} className="mr-1" /> {bin.zone}
                            </p>
                          </div>
                          <button className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-emerald-600 transition-all bg-white rounded-lg border border-slate-200 shadow-sm">
                            <Navigation size={16} />
                          </button>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                  <p className="text-xs text-slate-500 text-center font-medium">Route dynamically recalculates upon new priority reports.</p>
                </div>
              </motion.div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
