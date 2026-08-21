#!/bin/bash
(cd 1_Customer_Retention && ./venv/bin/python -m uvicorn app.main:app --port 8000) &
(cd 2_Anomaly_Detection && ./venv/bin/python -m uvicorn app.main:app --port 8001) &
(cd 3_Predictive_Intelligence && ./venv/bin/python -m uvicorn app.main:app --port 8002) &
(cd 4_Decision_Making && ./venv/bin/python -m uvicorn app.main:app --port 8003) &
wait
