import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Camera, AlertTriangle, Send, MapPin, CheckCircle, ShieldAlert, LogIn, Trash2, CheckCircle2, Sparkles, Loader2, Navigation, Users } from 'lucide-react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import ReactDOMServer from 'react-dom/server';

const defaultIcon = L.divIcon({
  html: `<div style="background-color: #0f172a; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white;">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
         </div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

export default function CitizenReport() {
  const [searchParams] = useSearchParams();
  const initialBinId = searchParams.get('binId') || '';
  
  const [user, setUser] = useState<User | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  // Form State
  const [selectedBin, setSelectedBin] = useState(initialBinId);
  const [description, setDescription] = useState('');
  const [photoMock, setPhotoMock] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // AI State
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [analyzingText, setAnalyzingText] = useState(false);
  const [lastReportVerification, setLastReportVerification] = useState<{isFake: boolean, reason: string} | null>(null);

  // Data
  const [bins, setBins] = useState<any[]>([]);
  const [myTrustScore, setMyTrustScore] = useState<number | null>(null);
  const [myFakeReports, setMyFakeReports] = useState<number>(0);
  const [pastReports, setPastReports] = useState<any[]>([]);

  // Geolocation & Photo
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  const fetchPastReports = async (uid: string) => {
    try {
      const q = query(collection(db, 'reports'), where('userId', '==', uid));
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(d => d.data());
      // Sort by descending timestamp locally
      reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPastReports(reports);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetch("/api/bins")
      .then(res => res.json())
      .then(data => {
        setBins(data.bins || []);
      })
      .catch(console.error);

    const unsubscribe = onAuthStateChanged(auth, async (userObj) => {
      setUser(userObj);
      if (userObj) {
        try {
          const citizensRef = collection(db, 'citizens');
          const q = query(citizensRef, where('userId', '==', userObj.uid));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            setMyTrustScore(data.reliabilityScore);
            setMyFakeReports(data.fakeReports || 0);
          } else {
            const myCitizenRef = doc(collection(db, 'citizens'), userObj.uid);
            await setDoc(myCitizenRef, {
              userId: userObj.uid,
              reliabilityScore: 100,
              fakeReports: 0
            });
            setMyTrustScore(100);
            setMyFakeReports(0);
          }
          await fetchPastReports(userObj.uid);
        } catch (e) {
          console.error("Failed to fetch/create citizen profile", e);
        }
      }
      setLoadingConfig(false);
    });

    return unsubscribe;
  }, []);

  const handleAiClassify = async () => {
    if (!description || description.trim().length < 5) return;
    setAnalyzingText(true);
    try {
      const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Classify this waste/trash issue description into 1 to 3 very short tags (e.g. Hazardous, Bad Odor, Overflowing, Damaged Bin). Output a comma-separated list only. Describe: "${description}"`;
      
      const response = await aiClient.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      const tagsRaw = response.text || "";
      const parsedTags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      setAiTags(parsedTags);
    } catch (error) {
      console.error(error);
    }
    setAnalyzingText(false);
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
      alert("Login failed. Check console.");
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64(reader.result as string);
      setPhotoMock(true); // for legacy logic
    };
    reader.readAsDataURL(file);

    // Get location when photo is attached
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, (err) => {
        console.warn("Geolocation failed", err);
      });
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("Please log in first");
    if (myFakeReports >= 3) return alert("Your account has been banned from submitting reports due to multiple fake submissions.");
    if (!selectedBin) return alert("Please select a bin");

    setSubmitting(true);
    try {
      const genId = crypto.randomUUID();
      let isFlaggedAsFake = false;
      let fraudReason = "Verified";
      
      try {
        const binInfo = bins.find(b => b.id === selectedBin);
        const pastFlagged = pastReports.filter(r => r.markedFake).length;
        
        const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `
          Act as a Smart City AI Verification System.
          Determine if the following citizen waste report is likely FAKE or SPAM.
          
          Report Details:
          - Description: "${description}"
          - AI Tags: [${aiTags.join(', ')}]
          - Evidence Attached: ${photoMock ? 'Yes' : 'No'}
          - Location: ${binInfo?.zone} (Bin #${selectedBin})
          
          User Context:
          - Trust Score: ${myTrustScore ?? 100}/100
          - Past Fake Reports: ${pastFlagged}
          
          Rules for flagging:
          - If there's no evidence AND the description is nonsense ("asdf", "test", "spam"), FLAG IT.
          - If the user has a Trust Score < 50, scrutinize heavily.
          - If there are past fake reports and evidence is missing, FLAG IT.
          
          Respond ONLY with a JSON object format:
          {
            "isFake": boolean,
            "reason": "String explaining the verification outcome in 1 sentence"
          }
        `;

        const parts: any[] = [{ text: prompt }];

        if (photoBase64) {
          const match = photoBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                data: match[2],
                mimeType: match[1]
              }
            });
            prompt += "\n\n- Analyze the attached image as well to verify if there is actually waste or an issue present.";
            parts[0] = { text: prompt };
          }
        }

        const response = await aiClient.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{ role: "user", parts }],
        });

        const rawJson = response.text?.replace(/```json/g, "").replace(/```/g, "").trim() || "{}";
        const parsed = JSON.parse(rawJson);
        if (parsed && typeof parsed.isFake === "boolean") {
          isFlaggedAsFake = parsed.isFake;
          fraudReason = parsed.reason || (parsed.isFake ? "Automatically flagged by AI" : "AI Verified");
        }
      } catch (aiError) {
        console.warn("AI Fake Detection skipped due to error:", aiError);
      }

      const newReportRef = {
        id: genId,
        binId: selectedBin,
        isOverflowing: true,
        description,
        aiTags,
        timestamp: new Date().toISOString(),
        userId: user.uid,
        trustScore: myTrustScore ?? 100,
        photoAttached: photoMock,
        photoData: photoBase64,
        reportedLocation: userLocation,
        markedFake: isFlaggedAsFake,
        verificationReason: fraudReason
      };

      await setDoc(doc(db, 'reports', genId), newReportRef);

      if (isFlaggedAsFake) {
        // Increment fake reports for user
        const newFakeCount = myFakeReports + 1;
        await setDoc(doc(db, 'citizens', user.uid), {
          fakeReports: newFakeCount,
          reliabilityScore: Math.max(0, (myTrustScore || 100) - 20)
        }, { merge: true });
        setMyFakeReports(newFakeCount);
        setMyTrustScore(Math.max(0, (myTrustScore || 100) - 20));
      }

      setLastReportVerification({
        isFake: isFlaggedAsFake,
        reason: fraudReason
      });
      fetchPastReports(user.uid);
      setSubmitted(true);
    } catch (e: any) {
      console.error("Error submitting report", e);
      alert("Error: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingConfig) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans"><Loader2 className="animate-spin text-emerald-600 mr-2" /> Loading Secure Citizen Portal...</div>;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans overflow-hidden">
      
      {/* Left Sidebar - Profile & Form */}
      <div className="w-full lg:w-[450px] bg-white border-r border-slate-200 shadow-xl flex flex-col h-full z-10">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white shadow-md relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Users size={80} />
          </div>
          <div className="flex justify-between items-center relative z-10 mb-4">
            <div className="flex items-center space-x-2">
              <div className="bg-emerald-500 p-2 rounded-lg"><Users size={20} className="text-white" /></div>
              <h1 className="font-bold text-lg tracking-tight">Citizen Portal</h1>
            </div>
            {user && (
              <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-white font-semibold transition-colors bg-white/10 px-3 py-1 rounded-full">Sign Out</button>
            )}
          </div>

          {!user ? (
            <div className="bg-white/10 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
              <h2 className="font-bold mb-2">Welcome, Citizen!</h2>
              <p className="text-sm text-slate-300 mb-4 font-medium leading-relaxed">Sign in to report full bins, track issues, and earn rewards for keeping the city clean.</p>
              <button onClick={handleLogin} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg flex justify-center items-center transition-colors shadow-lg shadow-emerald-500/20">
                <LogIn size={18} className="mr-2" /> Sign in with Google
              </button>
            </div>
          ) : (
            <div className="flex justify-between items-center bg-white/10 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
              <div className="text-sm truncate mr-4">
                <span className="text-slate-400 block text-xs uppercase font-bold tracking-widest mb-1">Logged In</span>
                <span className="font-semibold text-white truncate" title={user.email || ''}>{user.email}</span>
              </div>
              <div className="bg-white/10 px-3 py-2 rounded-lg text-center shrink-0 border border-white/10">
                <span className="block text-[10px] text-emerald-300 font-black uppercase tracking-widest mb-0.5">Trust Score</span>
                <span className={`text-xl font-black ${myTrustScore && myTrustScore > 80 ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {myTrustScore ?? 100}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {user && (
            <>
              {/* Form Section */}
              <div className="relative">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  <AlertTriangle size={18} className="mr-2 text-rose-500" /> New Report
                </h2>
                
                {submitted ? (
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${lastReportVerification?.isFake === false ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                      {lastReportVerification?.isFake === false ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1 text-lg">Report Received!</h3>
                    <p className="text-sm text-slate-600 mb-4">A driver has been alerted.</p>
                    
                    {lastReportVerification && (
                      <div className={`p-3 rounded-xl mb-6 text-xs text-left border ${lastReportVerification.isFake ? 'bg-white border-orange-200 text-orange-800' : 'bg-white border-emerald-200 text-emerald-800'}`}>
                        <div className="flex items-center font-bold mb-1"><Sparkles size={14} className="mr-1" /> AI Verification</div>
                        {lastReportVerification.reason}
                      </div>
                    )}

                    <button 
                      onClick={() => { setSubmitted(false); setSelectedBin(''); setDescription(''); setAiTags([]); setPhotoMock(false); setLastReportVerification(null); }}
                      className="w-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl transition-colors text-sm"
                    >
                      Report Another
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmitReport} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select Bin</label>
                      <div className="relative">
                        <select required value={selectedBin} onChange={(e) => setSelectedBin(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 appearance-none font-semibold text-slate-800 text-sm">
                          <option value="" disabled>Select on map or list...</option>
                          {bins.map(b => (
                            <option key={b.id} value={b.id}>Bin #{b.id} - {b.zone}</option>
                          ))}
                        </select>
                        <MapPin className="absolute left-3 top-3.5 text-slate-400" size={16} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Issue Details</label>
                      <textarea required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's wrong? (e.g. overflowing, broken lock)" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none font-medium text-slate-800 text-sm resize-none h-24 transition-colors"></textarea>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-wrap gap-1">
                          {aiTags.map((tag, i) => (
                            <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-bold text-[10px] uppercase border border-indigo-200">{tag}</span>
                          ))}
                        </div>
                        <button type="button" onClick={handleAiClassify} disabled={analyzingText || description.length < 5} className="flex text-xs items-center bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg font-bold disabled:opacity-50 transition-colors shrink-0">
                          {analyzingText ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Sparkles size={14} className="mr-1.5 text-indigo-500" />}
                          Smart Tag
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Evidence</label>
                      <label className={`w-full py-3 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-colors text-sm font-semibold ${photoMock ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-300 text-slate-500 hover:bg-slate-100'}`}>
                        <Camera size={16} className="mr-2" /> {photoMock ? 'Photo Attached (Click to change)' : 'Take or Upload Photo'}
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      </label>
                      {userLocation && (
                        <p className="text-[10px] text-slate-500 mt-1 flex items-center">
                          <MapPin size={10} className="mr-1" /> Location captured from photo: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                        </p>
                      )}
                    </div>

                    <button type="submit" disabled={submitting} className="w-full bg-slate-900 hover:bg-black active:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all shadow-md mt-2 flex justify-center items-center">
                      {submitting ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} className="mr-2" /> Submit Report</>}
                    </button>
                  </form>
                )}
              </div>

              {/* Past Reports */}
              <div className="border-t border-slate-100 pt-6">
                <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  <ShieldAlert size={18} className="mr-2 text-indigo-500" /> My Past Reports
                </h2>
                {pastReports.length === 0 ? (
                  <div className="text-center bg-slate-50 p-6 rounded-2xl border border-slate-100 border-dashed">
                    <p className="text-sm font-medium text-slate-500">You haven't submitted any reports yet. Help keep the city clean!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pastReports.slice(0, 5).map((r, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border ${r.markedFake ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'} shadow-sm`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-bold text-sm text-slate-800">Bin #{r.binId}</div>
                          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                            {new Date(r.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-2 font-medium">{r.description}</p>
                        <div className="flex items-center justify-between">
                           <div className="flex gap-1">
                             {r.aiTags?.slice(0, 2).map((t: string, i: number) => <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 rounded">{t}</span>)}
                           </div>
                           {r.markedFake ? (
                             <span className="text-[10px] font-bold text-rose-600 flex items-center bg-rose-100 px-1.5 rounded"><AlertTriangle size={10} className="mr-1" /> Flagged Fake</span>
                           ) : (
                             <span className="text-[10px] font-bold text-emerald-600 flex items-center bg-emerald-100 px-1.5 rounded"><CheckCircle2 size={10} className="mr-1" /> Verified</span>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>

      {/* Right Map Area (Desktop only for full map, mobile relies on form) */}
      <div className="hidden lg:block relative flex-1 bg-slate-200">
        <MapContainer center={[28.6415, 77.2183]} zoom={13} className="w-full h-full z-0 font-sans" zoomControl={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {bins.map((bin) => (
            <Marker key={bin.id} position={[bin.lat, bin.lng]} icon={defaultIcon} eventHandlers={{ click: () => setSelectedBin(bin.id) }}>
              <Popup className="font-sans">
                <div className="font-bold text-slate-800 text-sm mb-1">Bin #{bin.id}</div>
                <div className="text-xs text-slate-500 mb-2">{bin.zone}</div>
                <button onClick={() => setSelectedBin(bin.id)} className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold py-1.5 rounded transition-colors">Select for Report</button>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        {/* Map overlay elements */}
        <div className="absolute top-6 left-6 z-[400] bg-white p-4 rounded-xl shadow-lg border border-slate-200 max-w-sm pointer-events-none">
          <h3 className="font-bold text-slate-800 flex items-center mb-1"><MapPin size={16} className="mr-2 text-emerald-600" /> Interactive City Map</h3>
          <p className="text-xs text-slate-500 font-medium">Click on any bin on the map to quickly auto-fill the report form. Help direct the fleet efficiently.</p>
        </div>
      </div>

    </div>
  );
}
