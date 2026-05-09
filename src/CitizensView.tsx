import React, { useState, useEffect } from 'react';
import { Users, UserCheck, UserX } from 'lucide-react';

export default function CitizensView() {
  const [citizens, setCitizens] = useState<any[]>([]);

  const fetchCitizens = async () => {
    try {
      const res = await fetch('/api/citizens');
      const data = await res.json();
      setCitizens(data.citizens || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCitizens();
    const interval = setInterval(fetchCitizens, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleBlock = async (userId: string, currentBlocked: boolean) => {
    try {
      const res = await fetch(`/api/citizens/${userId}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: !currentBlocked })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update status");
      }
      fetchCitizens();
    } catch (e: any) {
      console.error(e);
      alert(`Error updating citizen: ${e.message}`);
    }
  };

  const resetScore = async (userId: string) => {
    if (!window.confirm("Are you sure you want to reset this citizen's score? This will unblock them and set their reliability to 100%.")) return;
    try {
      const res = await fetch(`/api/citizens/${userId}/reset-score`, { method: 'POST' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reset score");
      }
      fetchCitizens();
      alert("Citizen score reset successfully.");
    } catch (e: any) {
      console.error(e);
      alert(`Error resetting score: ${e.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Manage Citizens</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-4">User ID</th>
              <th className="px-6 py-4">Reliability Score</th>
              <th className="px-6 py-4">Fake Reports</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {citizens.map(c => (
              <tr key={c.userId}>
                <td className="px-6 py-4 font-mono text-slate-600">{c.userId}</td>
                <td className={`px-6 py-4 font-bold ${c.reliabilityScore < 20 ? 'text-rose-600' : 'text-slate-600'}`}>
                  {c.reliabilityScore}% {c.reliabilityScore < 20 && '(Auto-Banned)'}
                </td>
                <td className="px-6 py-4">{c.fakeReports}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${c.blocked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {c.blocked ? 'Blocked' : 'Active'}
                  </span>
                </td>
                <td className="px-6 py-4 flex gap-2">
                  <button 
                    onClick={() => toggleBlock(c.userId, c.blocked)}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg font-bold text-xs ${c.blocked ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
                  >
                    {c.blocked ? <><UserCheck size={14} /> Unblock</> : <><UserX size={14} /> Block</>}
                  </button>
                  <button 
                    onClick={() => resetScore(c.userId)}
                    className="flex items-center space-x-2 px-3 py-1.5 rounded-lg font-bold text-xs bg-slate-100 text-slate-700"
                  >
                    Reset Score
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
