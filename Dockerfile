FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy all backend directories
COPY 1_Customer_Retention /app/1_Customer_Retention
COPY 2_Anomaly_Detection /app/2_Anomaly_Detection
COPY 3_Predictive_Intelligence /app/3_Predictive_Intelligence
COPY 4_Decision_Making /app/4_Decision_Making
COPY datasets /app/datasets

# Install dependencies sequentially to satisfy all environments
RUN pip install --no-cache-dir -r /app/1_Customer_Retention/requirements.txt \
    && pip install --no-cache-dir -r /app/2_Anomaly_Detection/requirements.txt \
    && pip install --no-cache-dir -r /app/3_Predictive_Intelligence/requirements.txt \
    && pip install --no-cache-dir -r /app/4_Decision_Making/requirements.txt

COPY start_services.sh /app/start_services.sh
RUN chmod +x /app/start_services.sh

EXPOSE 8020 8021 8022 8023

CMD ["/app/start_services.sh"]
