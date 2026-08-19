import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

# Common Config
NUM_DAYS = 1460 # 4 years of history
START_DATE = datetime(2022, 1, 1)
DATES = [START_DATE + timedelta(days=i) for i in range(NUM_DAYS)]

def generate_multi_store_retail():
    print("Generating Multi-Store Retail Dataset...")
    stores = ["Decathlon", "Superstore", "MegaMart"]
    categories = ["Furniture", "Technology", "Office Supplies"]
    
    # Pre-define products for categories
    products = {
        "Furniture": ["Bookcases", "Chairs", "Tables", "Furnishings"],
        "Technology": ["Phones", "Accessories", "Machines", "Copiers"],
        "Office Supplies": ["Binders", "Paper", "Art", "Envelopes"]
    }
    
    data = []
    for store in stores:
        store_multiplier = random.uniform(0.8, 1.5)
        for cat in categories:
            cat_multiplier = random.uniform(0.5, 2.0)
            for prod in products[cat]:
                base_sales = random.randint(10, 50)
                for i, date in enumerate(DATES):
                    # Add noise, weekly seasonality, yearly seasonality
                    noise = random.randint(-5, 5)
                    weekly_seasonality = 15 if date.weekday() >= 5 else 0 # Weekend spike
                    yearly_seasonality = 30 if date.month in [11, 12] else 0 # Holiday spike
                    
                    sales = max(0, int((base_sales + noise + weekly_seasonality + yearly_seasonality) * store_multiplier * cat_multiplier))
                    
                    data.append({
                        "Order Date": date.strftime('%Y-%m-%d'),
                        "Store": store,
                        "Category": cat,
                        "Sub-Category": prod,
                        "Sales": sales,
                        "Quantity": max(1, int(sales / 10))
                    })
    
    df = pd.DataFrame(data)
    df.to_csv("retail_multistore.csv", index=False)
    print(f"Saved retail_multistore.csv with {len(df)} rows.")

def generate_grocery():
    print("Generating Grocery Dataset...")
    categories = ["Produce", "Dairy", "Meat", "Bakery", "Frozen"]
    products = {
        "Produce": ["Apples", "Bananas", "Carrots"],
        "Dairy": ["Milk", "Cheese", "Eggs"],
        "Meat": ["Chicken", "Beef", "Pork"],
        "Bakery": ["Bread", "Bagels", "Croissants"],
        "Frozen": ["Pizza", "Ice Cream", "Veggies"]
    }
    
    data = []
    for cat in categories:
        for prod in products[cat]:
            base_demand = random.randint(100, 500)
            for date in DATES:
                noise = random.randint(-20, 20)
                weekly_seasonality = 100 if date.weekday() in [5, 6] else 0 # Weekend grocery shopping
                # Spoilage logic: high demand means high stock needed to prevent spoilage
                demand = max(0, base_demand + noise + weekly_seasonality)
                data.append({
                    "Date": date.strftime('%Y-%m-%d'),
                    "Category": cat,
                    "Product": prod,
                    "Demand_Volume": demand
                })
                
    df = pd.DataFrame(data)
    df.to_csv("grocery_forecast.csv", index=False)
    print(f"Saved grocery_forecast.csv with {len(df)} rows.")

def generate_logistics():
    print("Generating Logistics Dataset...")
    lanes = ["LA_to_NY", "Chicago_to_Dallas", "Seattle_to_Miami", "Houston_to_Atlanta"]
    freight_types = ["Standard", "Express", "Refrigerated"]
    
    data = []
    for lane in lanes:
        for ftype in freight_types:
            base_freight = random.randint(1000, 5000)
            for date in DATES:
                noise = random.randint(-200, 200)
                yearly_seasonality = 1500 if date.month in [10, 11, 12] else 0 # Q4 shipping spike
                volume = max(0, base_freight + noise + yearly_seasonality)
                data.append({
                    "Date": date.strftime('%Y-%m-%d'),
                    "Shipping_Lane": lane,
                    "Freight_Type": ftype,
                    "Volume_Tons": volume
                })
    df = pd.DataFrame(data)
    df.to_csv("logistics_forecast.csv", index=False)
    print(f"Saved logistics_forecast.csv with {len(df)} rows.")

def generate_maintenance():
    print("Generating Predictive Maintenance Dataset...")
    # 10 malls, 2 escalators each = 20 escalators
    malls = [f"Mall_{i}" for i in range(1, 11)]
    escalators = ["Escalator_A", "Escalator_B"]
    
    data = []
    for mall in malls:
        for esc in escalators:
            equipment_id = f"{mall}_{esc}"
            
            # Simulate degradation over time
            current_vibration = random.uniform(1.0, 2.0)
            current_temp = random.uniform(30.0, 40.0)
            
            for date in DATES:
                # Gradual degradation
                current_vibration += random.uniform(0.0, 0.05)
                current_temp += random.uniform(0.0, 0.1)
                
                # Maintenance event resets degradation
                if current_vibration > 10.0 or current_temp > 80.0:
                    failure = 1
                    current_vibration = random.uniform(1.0, 2.0)
                    current_temp = random.uniform(30.0, 40.0)
                else:
                    failure = 0
                
                # Add random noise
                vib = current_vibration + random.uniform(-0.5, 0.5)
                temp = current_temp + random.uniform(-2.0, 2.0)
                
                # Calculate RUL (Remaining Useful Life) - simplified for dataset
                # We will just predict failure probability in next 7 days in the model
                data.append({
                    "Date": date.strftime('%Y-%m-%d'),
                    "Mall": mall,
                    "Equipment_ID": equipment_id,
                    "Vibration_mm_s": round(max(0, vib), 2),
                    "Temperature_C": round(max(0, temp), 2),
                    "Failure_Occurred": failure
                })
                
    df = pd.DataFrame(data)
    df.to_csv("maintenance_records.csv", index=False)
    print(f"Saved maintenance_records.csv with {len(df)} rows.")

if __name__ == "__main__":
    generate_multi_store_retail()
    generate_grocery()
    generate_logistics()
    generate_maintenance()
    print("All datasets generated successfully!")
