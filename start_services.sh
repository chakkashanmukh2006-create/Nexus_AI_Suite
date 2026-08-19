#!/bin/bash

echo "Starting Insure AI Ecosystem Backend Services..."

# Start Port 8020 (Customer Retention & Sentiment)
cd /app/1_Customer_Retention
uvicorn app.main:app --host 0.0.0.0 --port 8020 &
PID1=$!

# Start Port 8021 (Anomaly Detection)
cd /app/2_Anomaly_Detection
uvicorn app.main:app --host 0.0.0.0 --port 8021 &
PID2=$!

# Start Port 8022 (Predictive Intelligence)
cd /app/3_Predictive_Intelligence
uvicorn app.main:app --host 0.0.0.0 --port 8022 &
PID3=$!

# Start Port 8023 (Decision Making)
cd /app/4_Decision_Making
uvicorn app.main:app --host 0.0.0.0 --port 8023 &
PID4=$!

echo "All services successfully initialized."
echo "Listening on ports: 8020, 8021, 8022, 8023"

# Wait for all background processes to keep container alive
wait $PID1 $PID2 $PID3 $PID4
