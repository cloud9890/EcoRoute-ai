import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
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
  Moon,
  ThermometerSun,
  CheckCircle2,
  X,
  History,
  Activity,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  ArrowUpLeft,
  CircleDot,
  Check,
  Menu,
  Camera,
  XCircle,
  ThumbsDown,
  Users
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';

import AnalyticsView from './AnalyticsView';
import FleetView from './FleetView';
import SettingsView from './SettingsView';
import TrackingView from './TrackingView';


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

const createCustomIcon = (fillLevel: number, isSelected: boolean = false) => {
  let bgClass = 'bg-emerald-500';
  let borderClass = 'border-emerald-600';
  if (fillLevel >= 80) {
    bgClass = 'bg-rose-500';
    borderClass = 'border-rose-600';
  } else if (fillLevel >= 50) {
    bgClass = 'bg-amber-400';
    borderClass = 'border-amber-500';
  }

  const selectionRing = isSelected ? '<div class="absolute -inset-2 border-2 border-indigo-500 rounded-full animate-pulse"></div>' : '';

  const html = `
    <div class="relative flex h-8 w-8 items-center justify-center rounded-full border-[3px] shadow-lg text-white font-bold text-[10px] transform transition-transform hover:scale-110 ${bgClass} ${borderClass}">
      ${selectionRing}
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

const DEPOT_COORDS: [number, number] = [28.6415, 77.2183];

let GLOBAL_API_KEY = 
  process.env.GOOGLE_MAPS_PLATFORM_KEY || 
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || 
  '';

export default function Dashboard() {
  const [mapsApiKey, setMapsApiKey] = useState(GLOBAL_API_KEY);
  
  useEffect(() => {
    if (!mapsApiKey || mapsApiKey === 'YOUR_API_KEY') {
      fetch('/api/config')
        .then(r => r.json())
        .then(data => {
          if (data.googleMapsApiKey && data.googleMapsApiKey !== 'YOUR_API_KEY') {
            GLOBAL_API_KEY = data.googleMapsApiKey;
            setMapsApiKey(data.googleMapsApiKey);
          }
        })
        .catch(console.error);
    }
  }, [mapsApiKey]);

  const hasValidApiKey = Boolean(mapsApiKey) && mapsApiKey !== 'YOUR_API_KEY';
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hoveredBin, setHoveredBin] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<any | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Dashboard state
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulateEvent, setSimulateEvent] = useState(false);
  const [temperature, setTemperature] = useState(22);
  const [useLiveWeather, setUseLiveWeather] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [fetchingRoute, setFetchingRoute] = useState(false);
  const [routeDetails, setRouteDetails] = useState<{distance: number, duration: number} | null>(null);
  
  const [navigationSteps, setNavigationSteps] = useState<any[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState(false);

  const [aiBriefing, setAiBriefing] = useState<string>("Analyzing current network data...");
  const [fetchingAi, setFetchingAi] = useState(false);
  const [routingProvider, setRoutingProvider] = useState<string>('osrm');

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForRoute, setSelectedForRoute] = useState<Set<string>>(new Set());
  const [isCustomRoute, setIsCustomRoute] = useState(false);

  // Fleet State
  const [drivers, setDrivers] = useState<any[]>([]);

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

  const fetchFleet = async () => {
    try {
      const res = await fetch('/api/fleet');
      const data = await res.json();
      setDrivers(data.drivers);
    } catch (e) {
      console.error("Failed to fetch fleet data", e);
    }
  };

  const markReportFake = async (reportId: string, binId: string) => {
    try {
      await fetch(`/api/reports/${reportId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFake: true })
      });
      fetchBins();
      if (selectedBin && selectedBin.id === binId) {
        setSelectedBin({
          ...selectedBin,
          hasReport: false,
          reportDetails: null
        });
      }
    } catch (e) {
      console.error("Failed to flag report", e);
    }
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

  const handleDispatch = async () => {
    if (!selectedDriverId) return;
    setIsDispatching(true);
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: selectedDriverId,
          routeCoordinates: routeCoordinates,
          navigationSteps: navigationSteps,
          routeDetails: routeDetails,
          destinationName: `Route (${routeTargetBins.length} bins)`
        })
      });
      if (res.ok) {
        setShowDispatchModal(false);
        setActiveTab('tracking');
        fetchFleet();
      }
    } catch (e) {
      console.error("Failed to dispatch", e);
    }
    setIsDispatching(false);
  };

  useEffect(() => {
    fetchBins();
    fetchFleet();
    const interval = setInterval(() => {
      fetchBins();
      fetchFleet();
    }, 3000); // refresh every 3s
    return () => clearInterval(interval);
  }, [simulateEvent, temperature, useLiveWeather]);

  const needingCollection = bins.filter(b => b.needsCollection);
  const routeTargetBins = isCustomRoute 
    ? bins.filter(b => selectedForRoute.has(b.id)) 
    : needingCollection;
  
  useEffect(() => {
    let active = true;

    const fetchRoute = async () => {
      const sortedCollection = [...routeTargetBins].sort((a, b) => b.predictedFillLevel - a.predictedFillLevel);
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
        const res = await fetch(`/api/route?coordString=${coordString}`);
        if (!res.ok) throw new Error("Routing failed");
        
        const data = await res.json();
        console.log("Routing received:", {provider: data.provider, routesLen: data.routes?.length, tripsLen: data.trips?.length});
        
        if (active && data.trips && data.trips.length > 0) {
          const coords = data.trips[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          setRouteCoordinates(coords);
          setRouteDetails({
            distance: data.trips[0].distance,
            duration: data.trips[0].duration
          });
          const allSteps = data.trips[0].legs.flatMap((leg: any) => leg.steps);
          setNavigationSteps(allSteps);
          setIsNavigating(true);
        } else if (active && data.routes && data.routes.length > 0) {
          const coords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          setRouteCoordinates(coords);
          setRouteDetails({
            distance: data.routes[0].distance,
            duration: data.routes[0].duration
          });
          const allSteps = data.routes[0].legs.flatMap((leg: any) => leg.steps);
          setNavigationSteps(allSteps);
          setRoutingProvider(data.provider || (data.routes[0].geometry ? 'google' : 'osrm'));
          setIsNavigating(true);
        } else if (active) {
          setRouteCoordinates(waypoints);
          setRouteDetails(null);
          setNavigationSteps([]);
        }
      } catch (err) {
        console.error("Failed to fetch route", err);
        if (active) {
          setRouteCoordinates(waypoints);
          setRouteDetails(null);
        }
      } finally {
        if (active) setFetchingRoute(false);
      }
    };

    if (routeTargetBins.length > 0) {
      fetchRoute();
    } else {
      setRouteCoordinates([]);
      setRouteDetails(null);
    }
    
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(routeTargetBins.map(b => b.id))]);

  useEffect(() => {
    // Only fetch briefing when we have fully calculated routes and bins
    if (fetchingRoute || bins.length === 0) return;
    
    // throttle/debounce slightly to prevent spam
    const handler = setTimeout(async () => {
      setFetchingAi(true);
      try {
        const binsContext = {
          needingCollection: needingCollection.length,
          highUrgency: bins.filter(b => b.predictedFillLevel > 85).length,
          hasReports: bins.some(b => b.hasReport)
        };
        const weatherContext = { tempC: temperature, liveWeather: useLiveWeather };
        
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

        const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await aiClient.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
        });

        if (response.text) {
           setAiBriefing(response.text);
        } else {
           setAiBriefing("No insights generated.");
        }
      } catch (err: any) {
        console.error("Gemini Frontend Error:", err);
        const errMsg = err.message || String(err);
        setAiBriefing(`AI Briefing ERROR: ${errMsg}`);
      } finally {
        setFetchingAi(false);
      }
    }, 1000);

    return () => clearTimeout(handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchingRoute, routeDetails, useLiveWeather, temperature]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden relative">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          x: (isMobileMenuOpen || isDesktop) ? 0 : -256,
        }}
        transition={{ type: 'spring', stiffness: 250, damping: 25 }}
        className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col justify-between z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <div>
          <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800">
            <div className="flex items-center">
              <motion.div 
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
                className="mr-3 text-emerald-500"
              >
                <Navigation size={24} />
              </motion.div>
              <span className="text-xl font-bold text-white tracking-tight">AntiGrid <span className="text-emerald-500">AI</span></span>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
              { id: 'routes', icon: MapIcon, label: 'Live Routing' },
              { id: 'fleet', icon: Truck, label: 'Fleet & Drivers' },
              { id: 'tracking', icon: Navigation, label: 'Live Tracking' },
              { id: 'analytics', icon: BarChart3, label: 'Predictive Analytics' },
            ].map((item) => (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  activeTab === item.id 
                    ? 'bg-slate-800 text-white shadow-sm' 
                    : 'hover:bg-slate-800/50 hover:text-white text-slate-400'
                }`}
              >
                <item.icon size={20} className={activeTab === item.id ? "text-emerald-500" : ""} />
                <span className="font-medium">{item.label}</span>
              </motion.button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800 space-y-1">
          <a
            href="/report"
            target="_blank"
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors duration-200 hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-400"
          >
            <div className="flex items-center space-x-3">
              <Users size={20} />
              <span className="font-medium">Citizen Portal</span>
            </div>
            <ArrowUpRight size={14} className="opacity-50" />
          </a>
          <a
            href="/driver"
            target="_blank"
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors duration-200 hover:bg-emerald-900/30 text-slate-400 hover:text-emerald-400"
          >
            <div className="flex items-center space-x-3">
              <Truck size={20} />
              <span className="font-medium">Driver Portal</span>
            </div>
            <ArrowUpRight size={14} className="opacity-50" />
          </a>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setActiveTab('settings');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors duration-200 ${
              activeTab === 'settings' 
                ? 'bg-slate-800 text-white shadow-sm' 
                : 'hover:bg-slate-800/50 hover:text-white text-slate-400'
            }`}
          >
            <Settings size={20} className={activeTab === 'settings' ? "text-emerald-500" : ""} />
            <span className="font-medium">Settings</span>
          </motion.button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 z-10 shrink-0">
          <div className="flex items-center space-x-2 md:space-x-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="hidden sm:block text-sm font-medium text-slate-500">
              Department of Sanitation <span className="mx-2 hidden md:inline">•</span> <span className="hidden md:inline">District 1A</span>
            </div>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-emerald-100/50 text-emerald-700 px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-semibold flex items-center"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse mt-[1px]"></div>
              <span className="hidden xs:inline">System Active</span>
            </motion.div>
          </div>
          
          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="relative group hidden md:block">
              <input 
                type="text" 
                placeholder="Search..." 
                className="pl-10 pr-4 py-2 border border-slate-200 rounded-full text-sm bg-slate-50 flex focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all w-48 lg:w-64 group-hover:bg-white"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="relative p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="relative p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
              <Bell size={20} />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-emerald-500 to-emerald-300 border-2 border-white shadow-sm"></div>
          </div>
        </header>        {/* Dashboard Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-slate-50/50">
          
          {activeTab === 'dashboard' && (
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
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 lg:gap-6"
            >
              <div className="text-sm font-bold text-slate-800 flex items-center shrink-0">
                <CloudLightning size={16} className="text-emerald-500 mr-2" /> ML Context
              </div>
              
              <div className="hidden lg:block h-8 w-px bg-slate-200"></div>
              
              <div className="flex flex-wrap items-center gap-4">
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
              </div>

              <div className="hidden sm:block h-6 w-px bg-slate-200"></div>

              <div className={`flex items-center space-x-2 text-sm text-slate-700 font-medium transition-opacity ${useLiveWeather ? 'opacity-50 pointer-events-none' : ''}`}>
                <ThermometerSun size={16} />
                <span className="w-20">Temp: {temperature}°C</span>
                <input 
                  type="range" 
                  min="0" max="40" 
                  value={temperature} 
                  onChange={(e) => setTemperature(parseInt(e.target.value))}
                  disabled={useLiveWeather}
                  className="w-24 sm:w-32 lg:w-40 accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="flex-1 hidden xl:block"></div>

              <button 
                onClick={fetchBins}
                className="w-full sm:w-auto flex items-center justify-center text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors shrink-0"
              >
                <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                Recalculate
              </button>
            </motion.div>

            {/* AI Fleet Assistant Briefing */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-4"
            >
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
                <Sparkles size={24} className={fetchingAi ? "animate-pulse" : ""} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-indigo-900 flex items-center">
                    AntiGrid AI Dispatch Brief
                  </h3>
                  {fetchingAi && <span className="text-xs font-semibold text-indigo-400 animate-pulse">Generating...</span>}
                </div>
                {aiBriefing.includes('API_KEY_INVALID') || aiBriefing.includes('API key not valid') ? (
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl mt-2">
                    <p className="text-sm font-semibold text-rose-800">Action Required: Fix Settings</p>
                    <p className="text-xs text-rose-600 mt-1 mb-2">
                      It appears you have customized the <strong>GEMINI_API_KEY</strong> in the environment settings (⚙️ gear icon) with your Google Maps API key by mistake.
                    </p>
                    <ul className="text-xs text-rose-600 list-disc pl-4 space-y-1 font-medium">
                      <li>Open the AI Studio Settings (⚙️ gear icon in the top right).</li>
                      <li>Delete the <strong>GEMINI_API_KEY</strong> row entirely to restore the default AI features.</li>
                      <li>To enable map routing, add your key to a new row named <strong>GOOGLE_MAPS_PLATFORM_KEY</strong>.</li>
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-indigo-800/80 leading-relaxed">
                    {aiBriefing}
                  </p>
                )}
              </div>
            </motion.div>

          </div>
          )}

          {activeTab === 'routes' && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Map and Route section */}
            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 h-auto lg:h-[700px]">
              
              {/* Map View */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="w-full lg:flex-1 lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative h-[60vh] min-h-[400px] lg:min-h-0 lg:h-full block"
              >
                <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3 pointer-events-none">
                  <div className="flex items-center text-sm font-medium"><div className="w-3 h-3 rounded-full bg-rose-500 mr-2 shadow-sm"></div> Critical</div>
                  <div className="flex items-center text-sm font-medium"><div className="w-3 h-3 rounded-full bg-amber-400 mr-2 shadow-sm"></div> Warning</div>
                  <div className="flex items-center text-sm font-medium"><div className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-sm"></div> Normal</div>
                </div>

                <MapContainer center={DEPOT_COORDS} zoom={13} className="w-full h-full z-0 font-sans" zoomControl={false}>
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  />
                  {/* Depot Marker */}
                  <Marker position={DEPOT_COORDS}>
                    <Popup className="font-sans">
                      <div className="font-bold text-slate-800">Central Dispatch</div>
                      <div className="text-xs text-slate-500">Fleet HQ</div>
                    </Popup>
                  </Marker>
                  
                  {/* Bins Markers */}
                  {bins.map(bin => (
                    <Marker 
                      key={bin.id} 
                      position={[bin.lat, bin.lng]}
                      icon={createCustomIcon(bin.predictedFillLevel, selectedBin?.id === bin.id || selectedForRoute.has(bin.id))}
                      eventHandlers={{
                        click: () => {
                          if (selectionMode) {
                            const newSet = new Set(selectedForRoute);
                            if (newSet.has(bin.id)) newSet.delete(bin.id);
                            else newSet.add(bin.id);
                            setSelectedForRoute(newSet);
                          } else {
                            setSelectedBin(bin);
                          }
                        }
                      }}
                    />
                  ))}
                  
                  {/* Route Polyline (if any) */}
                  {routeCoordinates.length > 0 && (
                    <Polyline 
                      positions={routeCoordinates}
                      color="#10b981"
                      weight={5}
                      opacity={0.8}
                    />
                  )}
                </MapContainer>
                
                <div className="absolute top-4 right-4 z-[400] flex space-x-2">
                  <button 
                    onClick={() => {
                      if (selectionMode) {
                        setSelectionMode(false);
                        setIsCustomRoute(false);
                        setSelectedForRoute(new Set());
                      } else {
                        setSelectionMode(true);
                        setIsCustomRoute(true);
                        setSelectedForRoute(new Set());
                      }
                    }}
                    className={`px-4 py-2 rounded-xl font-bold border shadow-sm transition-colors text-sm ${selectionMode ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                  >
                    {selectionMode ? `Exit Selection Mode (${selectedForRoute.size} bins)` : 'Select Bins for Custom Route'}
                  </button>
                </div>

                {/* Floating Map Actions */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[400] flex space-x-4">
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (routeCoordinates.length > 0) setShowDispatchModal(true);
                    }}
                    disabled={routeCoordinates.length === 0}
                    className={`text-white shadow-xl px-6 py-3 rounded-full font-semibold tracking-wide flex items-center space-x-2 transition-colors border ${routeCoordinates.length > 0 ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 border-indigo-500' : 'bg-slate-400 border-slate-400 cursor-not-allowed opacity-70'}`}
                  >
                    <Truck size={18} />
                    <span>Dispatch Truck to Route</span>
                  </motion.button>
                </div>
                
                {/* Detailed Bin Drawer */}
                <AnimatePresence>
                  {selectedBin && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="absolute inset-x-4 bottom-4 top-4 sm:top-4 sm:right-4 sm:left-auto sm:bottom-4 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[500] flex flex-col overflow-hidden"
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
                            {selectedBin.reportDetails && (
                              <div className="flex flex-col space-y-2 mt-2 bg-rose-50 p-3 rounded-lg border border-rose-200">
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold text-rose-700 text-sm flex items-center">
                                    <AlertTriangle size={14} className="mr-1" /> Citizen Report
                                  </span>
                                  {selectedBin.reportDetails.photoAttached ? (
                                    <span className="flex items-center text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                      <Camera size={12} className="mr-1" /> Photo Verified
                                    </span>
                                  ) : (
                                    <span className="flex items-center text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">
                                      Unverified
                                    </span>
                                  )}
                                </div>
                                <div className="flex justify-between items-center text-xs mt-1">
                                  <span className="text-slate-600 font-medium">User Trust Score</span>
                                  <span className={`font-bold ${selectedBin.reportDetails.trustScore > 80 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                    {selectedBin.reportDetails.trustScore}%
                                  </span>
                                </div>
                                <button
                                  onClick={() => markReportFake(selectedBin.reportDetails.id, selectedBin.id)}
                                  className="mt-2 w-full flex items-center justify-center py-1.5 bg-white hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold rounded text-xs transition-colors"
                                >
                                  <ThumbsDown size={14} className="mr-1.5" /> Mark as Fake (Driver Override)
                                </button>
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

              {/* Route List / Navigation Sheet */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden h-[500px] lg:h-full"
              >
                {isNavigating ? (
                  <>
                    <div className="px-6 py-5 border-b border-indigo-100 flex flex-col bg-indigo-50/80">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <h3 className="font-bold text-indigo-900 text-lg flex items-center">
                            <Navigation size={20} className="mr-2" /> Route Calculated
                          </h3>
                          {routingProvider === 'google' && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full w-fit mt-1 animate-pulse">
                              Real-time Traffic Active
                            </span>
                          )}
                        </div>
                        <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold shadow-inner">
                          {routeDetails ? Math.ceil(routeDetails.duration / 60) : 0} mins
                        </div>
                      </div>
                      <p className="text-sm mt-3 text-indigo-800">
                        Turn-by-turn navigation has been forwarded to the Driver Portal. Complete the dispatch to assign this route to a truck.
                      </p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      <h4 className="font-bold text-slate-700">Target Bins in Route:</h4>
                      <div className="space-y-2">
                        {routeTargetBins.map((bin, idx) => (
                           <div key={idx} className="bg-slate-50 border border-slate-100 p-3 rounded-lg flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                <div>
                                  <div className="font-bold text-sm text-slate-800">Bin #{bin.id}</div>
                                  <div className="text-xs text-slate-500">{bin.zone}</div>
                                </div>
                              </div>
                              <div className="font-bold text-sm text-slate-600">{bin.fillLevel}%</div>
                           </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
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
                        {routeTargetBins.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 font-medium">
                            <CheckCircle2 size={40} className="mx-auto mb-2 text-emerald-400" />
                            No bins selected for routing.
                          </div>
                        ) : (
                          [...routeTargetBins].sort((a,b) => b.predictedFillLevel - a.predictedFillLevel).map((bin, i) => (
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
                      <p className="text-xs text-slate-500 text-center font-medium">Route dynamically recalculates.</p>
                    </div>
                  </>
                )}
              </motion.div>

            </div>
          </div>
          )}
          {activeTab === 'fleet' && <FleetView drivers={drivers} onUpdate={fetchFleet} />}
          {activeTab === 'tracking' && <TrackingView drivers={drivers} />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      <AnimatePresence>
        {showDispatchModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
            >
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 text-lg flex items-center">
                  <Truck size={20} className="mr-2 text-indigo-500" /> Dispatch Truck
                </h3>
                <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm font-medium text-slate-500">
                  Select an available driver to dispatch on the calculated route ({routeTargetBins.length} bins, {(routeDetails?.distance ?? 0) / 1000}km).
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {drivers.filter(d => d.status !== 'active').map(driver => (
                    <div 
                      key={driver.id}
                      onClick={() => setSelectedDriverId(driver.id)}
                      className={`p-3 rounded-xl border-2 flex cursor-pointer transition-colors ${selectedDriverId === driver.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-indigo-200'}`}
                    >
                      <div className="flex-1">
                        <div className="font-bold text-slate-800 flex justify-between items-center">
                          {driver.name}
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${driver.status === 'break' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {driver.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1 font-semibold">
                          ID: {driver.id} • Truck: {driver.truck}
                        </div>
                      </div>
                    </div>
                  ))}
                  {drivers.filter(d => d.status !== 'active').length === 0 && (
                    <div className="text-center p-4 text-sm font-medium text-slate-500 bg-slate-50 rounded-xl">
                      No drivers available.
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
                <button 
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDispatch}
                  disabled={!selectedDriverId || isDispatching}
                  className={`px-5 py-2 font-bold rounded-xl text-white shadow-md text-sm transition-colors flex items-center ${(!selectedDriverId || isDispatching) ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'}`}
                >
                  {isDispatching ? 'Dispatching...' : 'Confirm Dispatch'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
