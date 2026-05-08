import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Save, User, Bell, Shield, Sliders, Smartphone } from 'lucide-react';

export default function SettingsView() {
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySMS, setNotifySMS] = useState(false);
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [darkTheme, setDarkTheme] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">System Settings</h2>
          <p className="text-slate-500 font-medium">Manage your account, notifications, and preferences.</p>
        </div>
        <button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center justify-center">
          <Save size={18} className="mr-2" /> Save Changes
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-4">
          
          {/* Settings Sidebar */}
          <div className="bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 py-4 md:py-6 px-4">
            <div className="flex md:flex-col space-x-2 md:space-x-0 md:space-y-1 overflow-x-auto no-scrollbar md:overflow-visible">
              <button className="flex-none md:flex-1 w-auto md:w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 font-medium shrink-0">
                <User size={18} />
                <span>Profile</span>
              </button>
              <button className="flex-none md:flex-1 w-auto md:w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors shrink-0">
                <Bell size={18} />
                <span>Notifications</span>
              </button>
              <button className="flex-none md:flex-1 w-auto md:w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors shrink-0">
                <Sliders size={18} />
                <span>Routing rules</span>
              </button>
              <button className="flex-none md:flex-1 w-auto md:w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors shrink-0">
                <Shield size={18} />
                <span>Security</span>
              </button>
              <button className="flex-none md:flex-1 w-auto md:w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors shrink-0">
                <Smartphone size={18} />
                <span>Integrations</span>
              </button>
            </div>
          </div>

          {/* Settings Content */}
          <div className="col-span-3 p-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h3 className="text-xl font-bold text-slate-800 mb-6">Profile Information</h3>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                  <input type="text" defaultValue="Harsh Agarwal" className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                  <input type="email" defaultValue="harshagarwal8050@gmail.com" className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Department Role</label>
                  <input type="text" defaultValue="Head of Operations" readOnly className="w-full border border-slate-200 bg-slate-50 text-slate-500 rounded-lg px-4 py-2 cursor-not-allowed" />
                </div>
              </div>

              <hr className="my-8 border-slate-200" />

              <h3 className="text-xl font-bold text-slate-800 mb-6">System Preferences</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                  <div>
                    <h4 className="font-bold text-slate-800">Email Notifications</h4>
                    <p className="text-sm font-medium text-slate-500">Receive daily reports and critical overflow alerts.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={notifyEmail} onChange={() => setNotifyEmail(!notifyEmail)} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                  <div>
                    <h4 className="font-bold text-slate-800">SMS Alerts</h4>
                    <p className="text-sm font-medium text-slate-500">Immediate text alerts for fleet emergencies.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={notifySMS} onChange={() => setNotifySMS(!notifySMS)} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 border border-slate-200 rounded-xl">
                  <div>
                    <h4 className="font-bold text-slate-800">Auto-Dispatch Approval</h4>
                    <p className="text-sm font-medium text-slate-500">Allow AI to directly dispatch trucks without human review.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={autoDispatch} onChange={() => setAutoDispatch(!autoDispatch)} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>

            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
