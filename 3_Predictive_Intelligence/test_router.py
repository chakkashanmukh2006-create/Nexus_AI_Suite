import json
import math
from app.api.logistics_forecast_router import get_logistics_forecast

try:
    res = get_logistics_forecast(store="CMA CGM", level="store", name=None, horizon_days=90)
    print("SUCCESS")
except Exception as e:
    import traceback
    traceback.print_exc()
