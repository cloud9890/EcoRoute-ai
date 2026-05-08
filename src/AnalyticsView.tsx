import React from 'react';
import { motion } from 'motion/react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { TrendingDown, Leaf, DollarSign, Activity } from 'lucide-react';

const collectionHistory = [
  { day: 'Mon', completed: 420, optimized: 380 },
  { day: 'Tue', completed: 450, optimized: 400 },
  { day: 'Wed', completed: 390, optimized: 350 },
  { day: 'Thu', completed: 410, optimized: 375 },
  { day: 'Fri', completed: 480, optimized: 460 },
  { day: 'Sat', completed: 510, optimized: 490 },
  { day: 'Sun', completed: 520, optimized: 505 }
];

const efficiencyData = [
  { time: '08:00', fuelUsed: 45, co2Saved: 12 },
  { time: '10:00', fuelUsed: 60, co2Saved: 18 },
  { time: '12:00', fuelUsed: 80, co2Saved: 25 },
  { time: '14:00', fuelUsed: 70, co2Saved: 22 },
  { time: '16:00', fuelUsed: 50, co2Saved: 15 },
  { time: '18:00', fuelUsed: 30, co2Saved: 8 }
];

const complaintData = [
  { name: 'Odor', value: 15 },
  { name: 'Overflow', value: 45 },
  { name: 'Missed Pickup', value: 25 },
  { name: 'Damage', value: 15 }
];
const COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

export default function AnalyticsView() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Predictive Analytics</h2>
          <p className="text-slate-500 font-medium">System-wide performance, ROI, and sustainability metrics.</p>
        </div>
        <div className="flex bg-white rounded-lg p-1 border border-slate-200">
           <button className="px-4 py-1.5 rounded-md text-sm font-semibold bg-emerald-50 text-emerald-700">7 Days</button>
           <button className="px-4 py-1.5 rounded-md text-sm font-semibold text-slate-500 hover:text-slate-700">30 Days</button>
           <button className="px-4 py-1.5 rounded-md text-sm font-semibold text-slate-500 hover:text-slate-700">All Time</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {[
           { label: 'CO2 Emissions Saved', value: '18.4 tons', icon: Leaf, color: 'text-emerald-600', bg: 'bg-emerald-100' },
           { label: 'Fuel Costs Avoided', value: '$12,450', icon: DollarSign, color: 'text-teal-600', bg: 'bg-teal-100' },
           { label: 'Overflow Rate', value: '1.2%', icon: TrendingDown, color: 'text-blue-600', bg: 'bg-blue-100' },
           { label: 'Model Accuracy', value: '94.8%', icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-100' },
         ].map((stat, i) => (
           <motion.div 
             key={i}
             initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
             className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
           >
             <div>
               <p className="text-xs font-bold text-slate-500 uppercase">{stat.label}</p>
               <h3 className="text-2xl font-black text-slate-800 mt-1">{stat.value}</h3>
             </div>
             <div className={`p-3 rounded-xl \${stat.bg} \${stat.color}`}>
               <stat.icon size={20} />
             </div>
           </motion.div>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         
         {/* Chart 1 */}
         <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
         >
            <h3 className="text-lg font-bold text-slate-800 mb-4">Route Optimization Impact</h3>
            <div className="h-64">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={collectionHistory}>
                   <defs>
                     <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                     </linearGradient>
                     <linearGradient id="colorOptimized" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                       <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                   <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                   <Area type="monotone" dataKey="completed" name="Standard Stops" stroke="#94a3b8" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} />
                   <Area type="monotone" dataKey="optimized" name="Optimized Stops" stroke="#10b981" fillOpacity={1} fill="url(#colorOptimized)" strokeWidth={3} />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
            <p className="text-xs text-center text-slate-500 mt-4 font-medium">Fewer optimized stops = less driving, same total waste collected.</p>
         </motion.div>

         {/* Chart 2 */}
         <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
         >
            <h3 className="text-lg font-bold text-slate-800 mb-4">Citizen Reports Breakdown</h3>
            <div className="relative h-64 flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={complaintData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={90}
                     paddingAngle={5}
                     dataKey="value"
                   >
                     {complaintData.map((entry, index) => (
                       <Cell key={"cell-" + index} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute flex flex-col items-center pointer-events-none">
                 <span className="text-3xl font-black text-slate-800">100</span>
                 <span className="text-xs font-bold text-slate-400">Total Reports</span>
               </div>
            </div>
         </motion.div>

         {/* Route Optimization Savings Model */}
         <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mt-2"
         >
            <h3 className="text-lg font-bold text-slate-800 mb-6">Route Optimization Impact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
               <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col items-center text-center">
                 <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-3">
                   <Activity size={24} />
                 </div>
                 <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Miles Driven Reduction</h4>
                 <div className="text-3xl font-black text-slate-800 tracking-tight">32%</div>
                 <p className="text-xs font-medium text-slate-500 mt-2">Versus standard fixed-route scheduling.</p>
               </div>

               <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col items-center text-center">
                 <div className="p-3 bg-teal-100 text-teal-600 rounded-full mb-3">
                   <DollarSign size={24} />
                 </div>
                 <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Weekly Fuel Savings</h4>
                 <div className="text-3xl font-black text-slate-800 tracking-tight">185 gal</div>
                 <p className="text-xs font-medium text-slate-500 mt-2">Saved directly across all fleet vehicles.</p>
               </div>

               <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col items-center text-center">
                 <div className="p-3 bg-amber-100 text-amber-600 rounded-full mb-3">
                   <TrendingDown size={24} />
                 </div>
                 <h4 className="text-sm font-bold text-slate-500 uppercase mb-1">Vehicle Wear & Tear</h4>
                 <div className="text-3xl font-black text-slate-800 tracking-tight">-15%</div>
                 <p className="text-xs font-medium text-slate-500 mt-2">Estimated maintenance reduction costs.</p>
               </div>

            </div>
         </motion.div>

      </div>
    </div>
  );
}
