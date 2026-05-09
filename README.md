# 🌿 EcoRoute-ai (AntiGrid AI)

### *Smart City Waste Management Powered by Predictive Intelligence*

![EcoRoute AI Hero](file:///C:/Users/YASH/.gemini/antigravity/brain/1f16e2a2-5e57-4044-82db-1e9b1fb2c670/ecoroute_ai_hero_1778295929993.png)

**EcoRoute-ai** is a cutting-edge, AI-driven platform designed to revolutionize urban waste management. By combining real-time sensor data, crowdsourced intelligence, and advanced machine learning, it optimizes collection routes, reduces carbon emissions, and ensures a cleaner city environment.

---

## 🚀 Key Features

### 🧠 Predictive Fill Analytics
Uses a **Random Forest** machine learning model to forecast bin fill levels with high accuracy. The system considers:
- **Historical Trends**: Long-term usage patterns.
- **Real-time Weather**: Integration with Open-Meteo to adjust thresholds (e.g., higher heat triggers earlier collection to prevent odor).
- **Special Events**: Dynamic priority adjustment for festivals, concerts, or public gatherings.

### 📍 Intelligent Routing & Dispatch
Dynamic route optimization using **Google Maps Routes API** and **OSRM**.
- **Traffic Awareness**: Real-time traffic data integration for the fastest collection paths.
- **Multi-point Optimization**: Automatically sequences bin collections to minimize fuel consumption and time.
- **Automated Dispatch**: Zero-touch driver assignment based on urgency and proximity.

### 👥 Crowdsourced Intelligence (Citizen Portal)
Empowers residents to report overflows and issues directly.
- **Trust Scoring System**: A sophisticated reliability algorithm filters out fake reports and rewards consistent, accurate contributors.
- **Mobile-First Experience**: Quick reporting with photo attachments and location tagging.

![Citizen Portal Mockup](file:///C:/Users/YASH/.gemini/antigravity/brain/1f16e2a2-5e57-4044-82db-1e9b1fb2c670/citizen_portal_mockup_1778295957095.png)

### 🚛 Fleet Live Tracking
Comprehensive monitoring of the entire collection fleet:
- **Real-time Movement**: Track trucks on a live map with second-by-second updates.
- **Driver Wellness**: Monitoring fatigue levels and idle times to ensure safety and efficiency.
- **Telemetry Insights**: Fuel levels, speed, and route adherence tracking.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS 4, Framer Motion, Lucide Icons |
| **Backend** | Node.js, Express, TSX |
| **Database** | Firebase Firestore (Real-time reports & User data) |
| **AI/ML** | Google Gemini (Dispatch Briefing), Random Forest (Fill Prediction) |
| **Maps & GIS** | Google Maps Platform, Leaflet, OSRM, Open-Meteo API |

---

## 🚦 Getting Started

### Prerequisites
- Node.js (v18+)
- Google Maps API Key
- Gemini API Key
- Firebase Project

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/cloud9890/EcoRoute-ai.git
   cd EcoRoute-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file based on `.env.example`:
   ```bash
   GOOGLE_MAPS_PLATFORM_KEY=your_google_maps_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

---

## 🏗️ System Architecture

EcoRoute-ai follows a modern, event-driven architecture:

1.  **Ingestion**: Real-time bin levels and citizen reports are ingested via the Express API.
2.  **Processing**: The ML engine processes raw data against environmental factors (weather, events).
3.  **Optimization**: The routing engine calculates the most efficient "Collection Trip".
4.  **Action**: Dispatch orders are sent to drivers, and the live dashboard is updated via WebSockets/Polling.

---

## 🛡️ Security & Reliability
- **Firebase Security Rules**: Granular access control for bin data and reports.
- **Trust Algorithm**: Prevents system abuse by penalizing malicious/fake reporting.
- **Fallback Routing**: Automatic switch to OSRM if Google Maps service is unavailable.

---

> [!NOTE]
> This project is part of a smart city initiative to reduce the urban carbon footprint through data-driven logistics.
