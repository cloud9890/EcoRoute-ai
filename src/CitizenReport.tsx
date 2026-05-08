import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, AlertTriangle, MapPin, Trash2, Camera } from 'lucide-react';

export default function CitizenReport() {
  const [searchParams] = useSearchParams();
  const binId = searchParams.get('binId') || 'unknown';
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleReport = async () => {
    setStatus('submitting');
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ binId, isOverflowing: true })
      });

      if (!response.ok) throw new Error('Failed to report');
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-emerald-100"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Report Received!</h2>
          <p className="text-slate-500 mb-6 font-medium">Thank you for keeping our city clean. A driver has been re-routed to this bin.</p>
          <button 
            onClick={() => setStatus('idle')}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-4 rounded-xl transition-colors"
          >
            Report Another Issue
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border border-slate-200"
      >
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trash2 size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Report a Full Bin</h2>
        <p className="text-slate-500 mb-6 font-medium text-sm">
          Notice an overflowing bin? Report it instantly so our crews can prioritize it on their route.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8 flex items-center justify-center text-slate-700 font-semibold">
          <MapPin size={18} className="text-emerald-500 mr-2" />
          Location: Bin #{binId}
        </div>

        <div className="space-y-3">
          <motion.button 
            whileTap={{ scale: 0.96 }}
            onClick={handleReport}
            disabled={status === 'submitting'}
            className="w-full bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-rose-500/30 flex justify-center items-center"
          >
            {status === 'submitting' ? (
               <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <AlertTriangle size={20} className="mr-2" />
                Report Overflow
              </>
            )}
          </motion.button>

          <button className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-xl transition-colors flex justify-center items-center">
             <Camera size={20} className="mr-2" />
             Attach Photo (Optional)
          </button>
        </div>
      </motion.div>
      <div className="mt-8 text-slate-400 text-sm font-medium">
        Powered by EcoRoute AI
      </div>
    </div>
  );
}
