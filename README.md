<div align="center">
<img width="1200" height="475" alt="EcoRoute AI Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# 🌿 EcoRoute AI
### Intelligent Waste Management for Smarter, Greener Cities

[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## 🚀 Overview

**EcoRoute AI** is a cutting-edge, AI-powered sanitation management platform designed to eliminate inefficient, static waste collection routes. By leveraging real-time sensor data simulation, predictive machine learning, and dynamic routing algorithms, EcoRoute AI ensures that sanitation crews only visit bins that actually need emptying—reducing fuel consumption, CO2 emissions, and urban clutter.

## ✨ Key Features

-   **🤖 ML Predictive Filling:** A simulated "Random Forest" engine predicts bin fill levels by analyzing historical fill rates, real-time weather data (heatwaves accelerate decomposition/odor), and proximity to major urban events.
-   **📍 Opti-Route™ Technology:** Dynamically calculates the most efficient collection path using the OSRM (Open Source Routing Machine) API, prioritizing critical bins and minimizing travel distance.
-   **📱 Citizen Reporting Hub:** A user-friendly interface for residents to report overflowing bins. These reports instantly override ML predictions to force-priority collection.
-   **📊 Live Analytics Dashboard:** A premium, glassmorphic command center for sanitation departments featuring:
    -   Interactive **Leaflet** maps with live bin status.
    -   Prediction factor breakdown (Weather vs. Events vs. History).
    -   Real-time CO2 savings tracking.
    -   Fleet & Driver management views.
-   **🌡️ Environmental Integration:** Uses the **Open-Meteo API** to factor current temperature into decomposition and fill-rate forecasts.
-   **🕹️ Scenario Simulators:** Test the system against custom conditions like heatwaves, public holidays, or festivals to see how the routing adapts.

## 🛠️ Technology Stack

-   **Frontend:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
-   **Styling:** [Tailwind CSS 4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
-   **Backend:** [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [TSX](https://github.com/privatenumber/tsx)
-   **Geospatial:** [Leaflet](https://leafletjs.com/), [React Leaflet](https://react-leaflet.js.org/), [OSRM API](https://project-osrm.org/)
-   **Data Vis:** [Recharts](https://recharts.org/)
-   **AI Integration:** [Google Gemini API](https://ai.google.dev/) (via `@google/genai`)

## 🏗️ Project Structure

```text
├── server.ts           # Express server & ML Prediction Logic
├── src/
│   ├── main.tsx        # App entry point
│   ├── App.tsx         # Routing logic
│   ├── Dashboard.tsx   # Admin command center (The main feature)
│   ├── CitizenReport.tsx # Resident reporting interface
│   └── index.css       # Global styles & Tailwind 4 setup
├── public/             # Static assets
└── vite.config.ts      # Vite configuration
```

## 🚦 Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or higher)
-   An API Key for [Google Gemini](https://aistudio.google.com/app/apikey) (optional but recommended for AI features)

### Local Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/cloud9890/EcoRoute-ai.git
    cd EcoRoute-ai
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables:**
    Create a `.env` file in the root directory and add your keys:
    ```env
    GEMINI_API_KEY="your_api_key_here"
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

## 🌍 Impact

By switching from static to dynamic AI routing, cities can expect:
-   Up to **30% reduction** in fuel costs.
-   Significant decrease in urban CO2 footprint.
-   Cleaner streets through proactive overflow prevention.

---

<div align="center">
Built with ❤️ for a Sustainable Future.
</div>
