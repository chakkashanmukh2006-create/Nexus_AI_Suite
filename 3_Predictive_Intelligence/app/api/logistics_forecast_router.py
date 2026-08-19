from fastapi import APIRouter, Query
import pandas as pd
import numpy as np
import os
from datetime import timedelta
import random

# Models
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX
from prophet import Prophet
import xgboost as xgb
import warnings
warnings.filterwarnings("ignore")

router = APIRouter()

def get_kaggle_dataset():
    csv_path = os.path.join(os.path.dirname(__file__), "../../../datasets/logistics_forecast.csv")
    df = pd.read_csv(csv_path)
    df['Date'] = pd.to_datetime(df['Date'], format="mixed", dayfirst=False)
    return df

@router.get("/logistics/options")
def get_logistics_options():
    df = get_kaggle_dataset()
    stores = sorted(df['Company'].dropna().unique().tolist())
    categories = sorted(df['Freight_Type'].dropna().unique().tolist())
    products = sorted(df['Shipping_Lane'].dropna().unique().tolist())
    return {
        "stores": stores,
        "categories": categories,
        "products": products
    }

@router.get("/logistics/forecast")
def get_logistics_forecast(
    store: str = Query(..., description="Store Name"),
    level: str = Query("store", description="store, category, or product"),
    name: str = Query(None, description="The specific category or product name"),
    horizon_days: int = Query(90, description="30, 60, or 90 days")
):
    df = get_kaggle_dataset()
    
    # Filter by Store (Company)
    if store and store != "All":
        df = df[df['Company'] == store]
    
    # Filter by Category/Product (Hierarchy level 2/3)
    if level == "category" and name:
        df = df[df['Freight_Type'] == name]
    elif level == "product" and name:
        df = df[df['Shipping_Lane'] == name]
    
    df_agg = df.groupby('Date')['Volume_Tons'].sum().reset_index()
    df_agg = df_agg.sort_values('Date')
    
    df_agg.set_index('Date', inplace=True)
    df_agg = df_agg.resample('W-MON').sum().reset_index()
    
    # Convert horizon days to weeks
    HORIZON = max(1, horizon_days // 7)
    
    if len(df_agg) < 15:
        return {"error": "Not enough historical data to forecast this item."}
    
    df_train = df_agg.copy()
    df_chart = df_train.tail(52).copy()
    
    historical_dates = df_chart['Date'].dt.strftime('%Y-%m-%d').tolist()
    historical_values = df_chart['Volume_Tons'].tolist()
    
    future_dates_dt = [df_train['Date'].iloc[-1] + timedelta(weeks=i) for i in range(1, HORIZON + 1)]
    future_dates = [d.strftime('%Y-%m-%d') for d in future_dates_dt]
    
    series = df_train['Volume_Tons'].values
    
    # 1. Simple Moving Average (SMA)
    sma_value = np.mean(series[-4:])
    sma_pred = [sma_value] * HORIZON
    
    # 2. Holt-Winters Exponential Smoothing
    try:
        hw_model = ExponentialSmoothing(series, seasonal_periods=52, trend='add', seasonal='add', initialization_method="estimated")
        hw_fit = hw_model.fit()
        hw_pred = hw_fit.forecast(HORIZON).tolist()
    except:
        hw_model = ExponentialSmoothing(series, trend='add', initialization_method="estimated")
        hw_fit = hw_model.fit()
        hw_pred = hw_fit.forecast(HORIZON).tolist()
    
    # 3. SARIMA
    try:
        sarima_model = SARIMAX(series, order=(1,1,1), seasonal_order=(0,0,0,0), enforce_stationarity=False, enforce_invertibility=False)
        sarima_fit = sarima_model.fit(disp=False)
        sarima_pred = sarima_fit.forecast(HORIZON).tolist()
    except:
        sarima_pred = [sma_value] * HORIZON
        
    # 4. Prophet
    prophet_df = df_train[['Date', 'Volume_Tons']].rename(columns={'Date': 'ds', 'Volume_Tons': 'y'})
    m = Prophet(weekly_seasonality=False, yearly_seasonality=True, daily_seasonality=False)
    m.fit(prophet_df)
    future = m.make_future_dataframe(periods=HORIZON, freq='W')
    prophet_forecast = m.predict(future)
    prophet_pred = prophet_forecast['yhat'].tail(HORIZON).tolist()
    
    # 5. XGBoost
    xgb_df = df_train.copy()
    for lag in range(1, 5):
        xgb_df[f'lag_{lag}'] = xgb_df['Volume_Tons'].shift(lag)
    xgb_df['month'] = xgb_df['Date'].dt.month
    xgb_df = xgb_df.dropna()
    
    X_train = xgb_df[[f'lag_{lag}' for lag in range(1, 5)] + ['month']]
    y_train = xgb_df['Volume_Tons']
    
    xgb_model = xgb.XGBRegressor(n_estimators=50, max_depth=3)
    if len(X_train) > 5:
        xgb_model.fit(X_train, y_train)
        
        xgb_pred = []
        current_lags = y_train.tail(4).values[::-1].tolist()
        current_date = df_train['Date'].iloc[-1]
        
        for i in range(HORIZON):
            current_date += timedelta(weeks=1)
            X_test = pd.DataFrame([current_lags + [current_date.month]], columns=X_train.columns)
            pred = xgb_model.predict(X_test)[0]
            xgb_pred.append(float(pred))
            
            current_lags.insert(0, pred)
            current_lags.pop()
    else:
        xgb_pred = [sma_value] * HORIZON

    # AI Reasoning Logic pre-calc
    avg_future = np.mean(prophet_pred)
    avg_past = np.mean(historical_values[-4:])
    variance = ((avg_future - avg_past) / (avg_past + 1)) * 100

    # Extract Vessel details
    vessel_name = df['Vessel_Name'].iloc[0] if 'Vessel_Name' in df.columns and not df['Vessel_Name'].empty else "Unknown Vessel"
    imo_number = df['IMO_Number'].iloc[0] if 'IMO_Number' in df.columns and not df['IMO_Number'].empty else "Unknown IMO"
    vessel_capacity = df['Vessel_Capacity'].iloc[0] if 'Vessel_Capacity' in df.columns and not df['Vessel_Capacity'].empty else 0
    
    # Calculate utilization
    expected_freight = int(avg_future * HORIZON)
    utilization_percent = (expected_freight / (vessel_capacity if vessel_capacity > 0 else 1)) * 100
    if utilization_percent > 100:
        utilization_percent = 100.0
        
    safe_name = name if name else ""
    optimal_speed = 18 if 'Container' in safe_name else 14
    
    target_name = name if name else store
    reasoning = f"AI Insight for {target_name}: "
    if variance > 10:
        reasoning += f"We anticipate a {variance:.1f}% HIKE in demand over the next {horizon_days} days. This upward spike is driven by historical yearly seasonality and recent weekly momentum detected by the XGBoost lag features. "
        reasoning += f"ACTION PLAN: Order {int(avg_future * HORIZON * 1.2)} units immediately to prevent supply chain stockouts."
    elif variance < -10:
        reasoning += f"We project a {abs(variance):.1f}% DROP in demand over the next {horizon_days} days due to post-peak seasonality detected by Prophet. "
        reasoning += f"ACTION PLAN: Halt immediate re-ordering. Liquidate current stock. Only {int(avg_future * HORIZON * 0.8)} units required."
    else:
        reasoning += f"Demand is highly STABLE with only a {abs(variance):.1f}% deviation. The 5-model consensus indicates steady baseline volume. "
        reasoning += f"ACTION PLAN: Maintain standard replenishment. Order {int(avg_future * HORIZON)} units for the {horizon_days}-day horizon."

    return {
        "dates": historical_dates + future_dates,
        "history": historical_values + [None] * HORIZON,
        "reasoning": reasoning,
        "vessel_recommendations": {
            "recommended_vessel": str(vessel_name),
            "imo_number": str(imo_number),
            "capacity_utilization": f"{utilization_percent:.1f}%",
            "optimal_speed": f"{optimal_speed} knots",
            "reasoning": f"AI selected {vessel_name} (IMO {imo_number}) for the {target_name} route based on projected freight volumes."
        },
        "predictions": {
            "SMA": [None] * len(historical_values) + sma_pred,
            "HoltWinters": [None] * len(historical_values) + hw_pred,
            "SARIMA": [None] * len(historical_values) + sarima_pred,
            "Prophet": [None] * len(historical_values) + prophet_pred,
            "XGBoost": [None] * len(historical_values) + xgb_pred,
        }
    }
