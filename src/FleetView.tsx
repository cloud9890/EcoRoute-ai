import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, User, MapPin, CheckCircle2, Clock, Phone, AlertTriangle, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

export default function FleetView({ drivers = [], onUpdate }: { drivers?: any[], onUpdate?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(new Date());
  const [aiCoachInsight, setAiCoachInsight] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  
  // Create a local state to allow optimistic updates, updated when props change
  const [localDrivers, setLocalDrivers] = useState<any[]>(drivers);

  useEffect(() => {
    setLocalDrivers(drivers);
    setLastSync(new Date());
  }, [drivers]);

  const toggleDriverStatus = async (id: string) => {
    const driver = localDrivers.find(d => d.id === id);
    if (!driver) return;
    const newStatus = driver.status === 'active' ? 'break' : 'active';

    // Optimistic UI update
    setLocalDrivers(localDrivers.map(d => {
      if (d.id === id) {
         if (d.status === 'active') return { ...d, status: 'break', destination: '-', eta: '-' };
         if (d.status === 'break') return { ...d, status: 'active', destination: 'Assigning...', eta: 'Calculating' };
      }
      return d;
    }));

    try {
      await fetch(`/api/drivers/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateCoachInsight = async () => {
    setGeneratingAi(true);
    try {
      const prompt = `
        You are an AI Fleet Manager. Look at these drivers and their fatigue/idle metrics. 
        Give a 2-sentence piece of operational advice. Should anyone take a break immediately? 
        Who is performing best?
        
        Drivers: \${JSON.stringify(localDrivers.map(d => ({ name: d.name, fatigue: d.fatigueLevel, status: d.status, idle: d.idleTime })))}
      `;

      const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await aiClient.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      setAiCoachInsight(response.text || "Insight generation failed.");
    } catch (error) {
      console.error(error);
      setAiCoachInsight("Failed to generate AI insight. Ensure your API key is correctly configured.");
    }
    setGeneratingAi(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Fleet & Driver Management</h2>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-slate-500 font-medium text-sm sm:text-base">Real-time tracking powered by External Fleet API.</p>
            {lastSync && (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex items-center whitespace-nowrap">
                <RefreshCw size={10} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
                Last sync: {lastSync.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center justify-center whitespace-nowrap">
          <Truck size={18} className="mr-2" /> Dispatch New Vehicle
        </button>
      </div>

      {/* AI Fleet Coach Panel */}
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
            <h3 className="font-bold text-indigo-950 text-lg mb-1">AI Fleet Coach</h3>
            <div className="text-indigo-800/80 text-sm font-medium">
              {aiCoachInsight ? (
                <p className="leading-relaxed">{aiCoachInsight}</p>
              ) : (
                <p>Monitor real-time fatigue and operations with AI-driven interventions.</p>
              )}
            </div>
          </div>
          <button 
            onClick={handleGenerateCoachInsight}
            disabled={generatingAi}
            className="shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl text-sm transition-colors shadow-sm shadow-indigo-600/20 flex items-center"
          >
            {generatingAi ? (
              <><Loader2 size={16} className="animate-spin mr-2" /> Analyzing Fleet...</>
            ) : (
              <><Sparkles size={16} className="mr-2" /> Generate Coach Report</>
            )}
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {localDrivers.map((driver, i) => (
          <motion.div 
            key={driver.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 mr-3 shrink-0">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{driver.name}</h3>
                  <p className="text-xs font-semibold text-slate-500">{driver.id} • {driver.truck}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                driver.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                driver.status === 'break' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                {driver.status}
              </span>
            </div>

            <div className="space-y-3 mb-6 bg-slate-50 rounded-xl p-3 border border-slate-100">
               <div>
                 <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                   <span>Truck Capacity Limit</span>
                   <span>{driver.fillLevel}%</span>
                 </div>
                 <div className="w-full bg-slate-200 rounded-full h-2">
                   <div className={`h-2 rounded-full ${driver.fillLevel > 75 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${driver.fillLevel}%` }}></div>
                 </div>
               </div>

               {/* Fatigue & Performance Monitor */}
               {(driver.fatigueLevel !== undefined) && (
                 <div className="pt-2 border-t border-slate-200 space-y-2">
                   <div>
                     <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                       <span className="flex items-center">
                         {driver.fatigueLevel > 80 && <AlertTriangle size={12} className="text-rose-500 mr-1 animate-pulse" />}
                         Fatigue Level
                       </span>
                       <span className={driver.fatigueLevel > 80 ? 'text-rose-600' : ''}>{Math.round(driver.fatigueLevel)}%</span>
                     </div>
                     <div className="w-full bg-slate-200 rounded-full h-1.5">
                       <div className={`h-1.5 rounded-full ${driver.fatigueLevel > 80 ? 'bg-rose-500' : driver.fatigueLevel > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${driver.fatigueLevel}%` }}></div>
                     </div>
                   </div>
                   <div className="flex justify-between text-xs font-medium text-slate-600">
                     <span className="flex items-center" title="Idle Time">
                       <Clock size={12} className="mr-1 text-slate-400" /> 
                       Idle: {driver.idleTime}m
                     </span>
                     <span className="flex items-center" title="Route Adherence">
                       <MapPin size={12} className="mr-1 text-slate-400" />
                       Adherence: {driver.routeAdherence}%
                     </span>
                   </div>
                 </div>
               )}
               
               {driver.status === 'active' && (
                 <div className="text-sm font-medium text-slate-600 flex flex-col space-y-1 pt-1">
                   <span className="flex items-center"><MapPin size={14} className="mr-2 text-indigo-500" /> Current: {driver.location}</span>
                   <span className="flex items-center"><Truck size={14} className="mr-2 text-emerald-500" /> En route to: {driver.destination}</span>
                   <span className="flex items-center"><Clock size={14} className="mr-2 text-amber-500" /> ETA: {driver.eta}</span>
                 </div>
               )}
            </div>

            <div className="mt-auto grid grid-cols-2 gap-2">
               <button 
                 onClick={() => toggleDriverStatus(driver.id)}
                 disabled={driver.status === 'off-duty'}
                 className="flex items-center justify-center py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-bold transition-colors"
               >
                 {driver.status === 'break' ? 'Set Active' : 'Set Break'}
               </button>
               <button 
                 disabled={driver.status === 'off-duty'}
                 className="flex items-center justify-center py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 rounded-lg text-sm font-bold transition-colors"
               >
                 <Phone size={14} className="mr-1" /> Contact
               </button>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
