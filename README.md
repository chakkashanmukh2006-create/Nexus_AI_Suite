# Nexus AI Suite

> **Multi-Industry Predictive Intelligence Platform**

Nexus AI Suite is an advanced, context-aware multi-model AI engine designed to scale across diverse industries including Retail, Grocery, Logistics, Maintenance, and Insurance. It replaces generic dashboards with a high-end, asymmetrical "Neural Command Center" powered by real-time machine learning backends.

## 🌟 Core Modules

1. **Customer 360 & Retention Engine (Port 8000)**
   - *Predictive churn modeling and 360-degree customer profile generation.*
   - Features automated "Bag of Words" name-correction and fuzzy matching for data integrity.
   - **Tech:** FastAPI, Next.js, Fuzzy Matching, Scikit-Learn

2. **Logistics & Anomaly Detection (Port 8001)**
   - *Real-time isolation forest algorithms detecting supply chain deviations.*
   - Instantly highlights logistical anomalies in high-throughput environments.
   - **Tech:** Isolation Forests, FastAPI

3. **Predictive Maintenance (Port 8002)**
   - *Neural networks forecasting equipment degradation and system failures.*
   - Monitors physical assets to prevent catastrophic downtime.
   - **Tech:** LSTM Neural Networks, Sensor Data Simulation

4. **Automated Decision Engine (Port 8003)**
   - *Claims processing and risk assessment automation using gradient boosting models.*
   - Instantly approves, rejects, or flags complex claims based on historical patterns.
   - **Tech:** XGBoost, Natural Language Processing (NLP)

## 🚀 Architecture

- **Frontend:** Built on Next.js 15, utilizing a custom Tailwind CSS v4 design system. The UI features a state-of-the-art "Neural Command Center" aesthetic with glassmorphism, dynamic data tickers, and cybernetic accents.
- **Backend:** A distributed microservice architecture featuring multiple FastAPI servers processing distinct machine learning workloads independently.

## 🛠️ Getting Started

### 1. Launch the Backends
Each module runs on an independent FastAPI server. From the root directory, start the servers in separate terminal windows:
```bash
# Customer Retention
cd 1_Customer_Retention && ./venv/bin/uvicorn app.main:app --port 8000 --reload

# Anomaly Detection
cd 2_Anomaly_Detection && ./venv/bin/uvicorn app.main:app --port 8001 --reload

# Predictive Maintenance
cd 3_Predictive_Intelligence && ./venv/bin/uvicorn app.main:app --port 8002 --reload

# Decision Engine
cd 4_Decision_Making && ./venv/bin/uvicorn app.main:app --port 8003 --reload
```

### 2. Launch the Neural Command Center Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🧠 Retraining Module
Nexus AI features an active learning loop. You can navigate to the "Model Tuning" tab in the UI to upload correction datasets (e.g., misspelled names) and dynamically retrain the Customer 360 extraction model without bringing the servers down.

---
*Developed as a next-generation Enterprise AI Ecosystem.*
