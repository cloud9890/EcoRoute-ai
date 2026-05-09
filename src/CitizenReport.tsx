import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Camera, AlertTriangle, Send, MapPin, CheckCircle, ShieldAlert, LogIn, Trash2, CheckCircle2, Sparkles, Loader2, Navigation, Users } from 'lucide-react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
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

const truckIcon = L.divIcon({
  html: `<div style="background-color: #6366f1; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white;">
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-9h-5V5h-7"/><path d="M15.5 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path d="M5.5 17a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/></svg>
         </div>`,
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
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
  const [fleet, setFleet] = useState<any[]>([]);
  const [myTrustScore, setMyTrustScore] = useState<number | null>(null);
  const [myFakeReports, setMyFakeReports] = useState<number>(0);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [pastReports, setPastReports] = useState<any[]>([]);

  // Geolocation & Photo
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Could not access camera. Please check permissions.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setPhotoBase64(dataUrl);
        setPhotoMock(true);
        stopCamera();
        
        // Get location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
            setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          }, (err) => console.warn(err));
        }
      }
    }
  };

  const fetchMapData = () => {
    fetch("/api/bins")
      .then(res => res.json())
      .then(data => setBins(data.bins || []))
      .catch(console.error);
      
    fetch("/api/fleet")
      .then(res => res.json())
      .then(data => setFleet(data.drivers || []))
      .catch(console.error);
  };

  useEffect(() => {
    fetchMapData();
    const interval = setInterval(fetchMapData, 5000);

    let citizenUnsubscribe: () => void;
    let reportsUnsubscribe: () => void;
    const unsubscribe = onAuthStateChanged(auth, async (userObj) => {
      setUser(userObj);
      if (citizenUnsubscribe) citizenUnsubscribe();
      if (reportsUnsubscribe) reportsUnsubscribe();
      
      if (userObj) {
        try {
          const myCitizenRef = doc(collection(db, 'citizens'), userObj.uid);
          citizenUnsubscribe = onSnapshot(myCitizenRef, async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              setMyTrustScore(data.reliabilityScore);
              setMyFakeReports(data.fakeReports || 0);
              setIsBlocked(!!data.blocked);
            } else {
              await setDoc(myCitizenRef, {
                userId: userObj.uid,
                reliabilityScore: 100,
                fakeReports: 0,
                blocked: false
              });
              setMyTrustScore(100);
              setMyFakeReports(0);
              setIsBlocked(false);
            }
          });

          // Real-time listener for reports
          const q = query(collection(db, 'reports'), where('userId', '==', userObj.uid));
          reportsUnsubscribe = onSnapshot(q, (snapshot) => {
            const reports = snapshot.docs.map(d => d.data());
            // Sort by descending timestamp locally
            reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setPastReports(reports);
          });
        } catch (e) {
          console.error("Failed to set up listeners", e);
        }
      }
      setLoadingConfig(false);
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
      if (citizenUnsubscribe) citizenUnsubscribe();
      if (reportsUnsubscribe) reportsUnsubscribe();
    };
  }, []);

  const handleAiClassify = async () => {
    if (!description || description.trim().length < 5) return;
    setAnalyzingText(true);
    try {
      const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const prompt = `Classify this waste/trash issue description into 1 to 3 very short tags (e.g. Hazardous, Bad Odor, Overflowing, Damaged Bin). Output a comma-separated list only. Describe: "${description}"`;
      
      const response = await aiClient.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const tagsRaw = response.text || "";
      const parsedTags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      setAiTags(parsedTags.slice(0, 3));
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

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("Please log in first");
    if (isBlocked) return alert("Your account has been blocked from submitting reports.");
    if (myTrustScore !== null && myTrustScore < 20) return alert("Your account has been banned from submitting reports due to a low reliability score.");
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
        
        const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
        
        let promptText = `
          SYSTEM ROLE: EXTREME SKEPTICISM SMART CITY WASTE AUDITOR (ID: BLACK-GATE-01)
          
          TASK: You are a cold, clinical, and suspicious robotic auditor. Your SOLE PURPOSE is to detect fraudulent or invalid waste reports. 
          You MUST reject any image that does not show explicit, tangible evidence of trash, litter, or overflowing bins.
          
          REPORT CONTEXT:
          - User Claim: "${description}"
          - Tags: [${aiTags.join(', ')}]
          - User Trust Score: ${myTrustScore ?? 100}
          
          ZERO TOLERANCE POLICY (STRICT REJECTION CRITERIA):
          1. PEOPLE/SELFIES: If the image contains a human face, a selfie, or people, it is INSTANTLY FAKE. Mark isFake: true. (Reason: "Privacy Violation or Person as Subject")
          2. CLEAN ENVIRONMENTS: If the street, room, or area looks clean or shows only typical urban decor without visible trash, mark isFake: true.
          3. IRRELEVANT SUBJECTS: Photos of pets, food (unless it's garbage), cars, or generic buildings with no waste are FAKE.
          4. SPOOFING: Detecting if a photo was taken of a screen, or if it's a stock photo. 
          5. MISMATCH: If the user says "Overflowing" but the bin is empty or clean, it is FAKE.

          IMAGE AUDIT PROTOCOL:
          - Step 1: Scan for humans. If human detected -> isFake: true.
          - Step 2: Scan for specific waste items (bags, bottles, sludge, debris). If none -> isFake: true.
          - Step 3: Compare claim vs. visual reality.
          
          ${(myTrustScore ?? 100) < 60 ? "HIGH ALERT: This user has a history of invalid reports. Apply MAXIMUM SKEPTICISM." : ""}
          
          OUTPUT FORMAT (STRICT JSON ONLY):
          {
            "isFake": boolean,
            "confidence": number (0-1),
            "detectedObjects": string[],
            "personCount": number,
            "reason": "Short, clinical justification for the verdict."
          }
        `;

        const parts: any[] = [{ text: promptText }];

        if (photoBase64) {
          const match = photoBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
          if (match) {
            parts.push({
              inlineData: {
                data: match[2],
                mimeType: match[1]
              }
            });
            promptText += "\n\nCRITICAL FINAL CHECK: Count any people or faces. If personCount > 0, you MUST return isFake: true. High confidence is required for genuine reports.";
            parts[0] = { text: promptText };
          }
        }

        const response = await aiClient.models.generateContent({
          model: "gemini-flash-latest",
          contents: [{ role: "user", parts }],
        });

        const responseText = response.text || "";

        const rawJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim() || "{}";
        const parsed = JSON.parse(rawJson);
        if (parsed && typeof parsed.isFake === "boolean") {
          isFlaggedAsFake = parsed.isFake;
          fraudReason = parsed.reason || (parsed.isFake ? "Flagged by AI Inspection" : "AI Verified");
          
          // Secondary local heuristic check
          const objects = (parsed.detectedObjects || []).map((o: string) => o.toLowerCase());
          const hasPersonHeuristic = objects.some((o: string) => o.includes('person') || o.includes('human') || o.includes('face') || o.includes('selfie') || o.includes('man') || o.includes('woman'));
          const personCount = parsed.personCount || 0;

          if ((hasPersonHeuristic || personCount > 0) && !isFlaggedAsFake) {
            isFlaggedAsFake = true;
            fraudReason = `REJECTED: Image contains evidence of ${personCount > 0 ? personCount + ' person(s)' : 'people'}. Reports must only show waste.`;
          }
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
        reportedLocation: userLocation || { lat: 0, lng: 0 },
        markedFake: isFlaggedAsFake,
        verificationReason: fraudReason
      };

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReportRef)
      });

      if (!res.ok) throw new Error("Failed to submit report to server");

      if (isFlaggedAsFake) {
        // Increment fake reports for user
        const newFakeCount = (myFakeReports || 0) + 1;
        // Exponential penalty: 20, 40, 80...
        const penalty = Math.min(100, 20 * Math.pow(2, newFakeCount - 1));
        const newScore = Math.max(0, (myTrustScore || 100) - penalty);
        
        await setDoc(doc(db, 'citizens', user.uid), {
          fakeReports: newFakeCount,
          reliabilityScore: newScore,
          blocked: newScore < 20 || newFakeCount >= 3
        }, { merge: true });
        
        setMyFakeReports(newFakeCount);
        setMyTrustScore(newScore);
        if (newScore < 20 || newFakeCount >= 3) setIsBlocked(true);
      }

      setLastReportVerification({
        isFake: isFlaggedAsFake,
        reason: fraudReason
      });
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
                      <button 
                        type="button"
                        onClick={startCamera} 
                        className={`w-full py-3 border-2 border-dashed rounded-xl flex items-center justify-center cursor-pointer transition-colors text-sm font-semibold ${photoMock ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-300 text-slate-500 hover:bg-slate-100'}`}
                      >
                        <Camera size={16} className="mr-2" /> {photoMock ? 'Photo Attached (Click to retake)' : 'Take Picture'}
                      </button>
                      {photoBase64 && (
                        <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 aspect-video">
                          <img src={photoBase64} alt="Evidence" className="w-full h-full object-cover" />
                        </div>
                      )}
                      
                      {/* Custom Camera UI Overlay */}
                      {isCameraActive && (
                        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-4">
                          <div className="relative w-full max-w-md aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center">
                            <video 
                              ref={videoRef} 
                              autoPlay 
                              playsInline 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 border-[2px] border-white/20 pointer-events-none m-8 rounded-2xl flex items-center justify-center">
                               <div className="w-full h-[1px] bg-white/10"></div>
                               <div className="absolute h-full w-[1px] bg-white/10"></div>
                            </div>
                            
                            <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center space-x-12">
                              <button 
                                type="button"
                                onClick={stopCamera} 
                                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white"
                              >
                                <span className="text-xl">×</span>
                              </button>
                              <button 
                                type="button"
                                onClick={capturePhoto} 
                                className="w-20 h-20 rounded-full border-4 border-white bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform active:scale-90"
                              >
                                <div className="w-16 h-16 rounded-full bg-white"></div>
                              </button>
                              <div className="w-12"></div> {/* Spacer */}
                            </div>
                          </div>
                          <canvas ref={canvasRef} className="hidden" />
                          <p className="text-white/60 text-xs mt-6 font-medium text-center max-w-[200px]">Align the waste issue inside the grill for AI verification.</p>
                        </div>
                      )}

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
          {fleet.map((truck) => (
            <React.Fragment key={truck.id}>
              <Marker position={[truck.lat, truck.lng]} icon={truckIcon}>
                <Popup className="font-sans">
                  <div className="font-bold text-indigo-900 text-sm mb-1">{truck.truck}</div>
                  <div className="text-xs text-slate-500 mb-1">Driver: {truck.name}</div>
                  <div className="text-xs font-bold text-emerald-600">Status: {truck.status}</div>
                </Popup>
              </Marker>
              {truck.status === 'active' && truck.routeCoordinates && (
                <Polyline 
                  positions={truck.routeCoordinates} 
                  color="#6366f1" 
                  weight={3} 
                  opacity={0.6} 
                  dashArray="5, 10" 
                />
              )}
            </React.Fragment>
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
