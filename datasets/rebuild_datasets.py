import pandas as pd
import numpy as np
import os
from datetime import timedelta, date

DATA_DIR = os.path.dirname(__file__)

def rebuild_grocery():
    dates = pd.date_range(start="2022-01-01", end="2025-01-01", freq="D")
    stores = ["Whole Foods", "Trader Joes", "Kroger"]
    categories = ["Produce", "Dairy", "Meat"]
    products = {
        "Produce": ["Apples", "Bananas", "Carrots"],
        "Dairy": ["Milk", "Cheese", "Yogurt"],
        "Meat": ["Chicken", "Beef", "Pork"]
    }
    
    rows = []
    for d in dates:
        for store in stores:
            for cat in categories:
                for prod in products[cat]:
                    # Base volume with some noise
                    base = np.random.randint(100, 500)
                    if d.month in [11, 12]:
                        base = int(base * 1.5)
                    if cat == "Produce":
                        base += np.random.randint(50, 150)
                    rows.append({
                        "Date": d,
                        "Store": store,
                        "Category": cat,
                        "Product": prod,
                        "Demand_Volume": base
                    })
    
    df = pd.DataFrame(rows)
    df.to_csv(os.path.join(DATA_DIR, "grocery_forecast.csv"), index=False)
    print("Grocery dataset rebuilt.")

def rebuild_logistics():
    dates = pd.date_range(start="2022-01-01", end="2025-01-01", freq="D")
    stores = ["Maersk", "MSC", "CMA CGM", "Hapag-Lloyd"]
    categories = ["Container_TEU", "Bulk_Cargo"]
    products = {
        "Container_TEU": ["China_to_USA", "Asia_to_Europe", "Europe_to_USA"],
        "Bulk_Cargo": ["Australia_to_China", "Brazil_to_Europe"]
    }
    
    # Pre-assign specific vessels to routes and companies for realism
    vessel_map = {
        "Maersk_Container_TEU_China_to_USA": {"name": "Madrid Maersk", "imo": "IMO9778791", "capacity": 20568},
        "Maersk_Container_TEU_Asia_to_Europe": {"name": "Morten Maersk", "imo": "IMO9632064", "capacity": 18270},
        "Maersk_Container_TEU_Europe_to_USA": {"name": "Maguen Maersk", "imo": "IMO9394806", "capacity": 10100},
        "Maersk_Bulk_Cargo_Australia_to_China": {"name": "Maersk Tianjin", "imo": "IMO9388833", "capacity": 45000},
        "Maersk_Bulk_Cargo_Brazil_to_Europe": {"name": "Maersk Tokyo", "imo": "IMO9388845", "capacity": 45000},
        
        "MSC_Container_TEU_China_to_USA": {"name": "MSC Oscar", "imo": "IMO9703291", "capacity": 19224},
        "MSC_Container_TEU_Asia_to_Europe": {"name": "MSC Gulsun", "imo": "IMO9839430", "capacity": 23756},
        "MSC_Container_TEU_Europe_to_USA": {"name": "MSC Zoe", "imo": "IMO9703318", "capacity": 19224},
        "MSC_Bulk_Cargo_Australia_to_China": {"name": "MSC Bulk Alpha", "imo": "IMO9500011", "capacity": 55000},
        "MSC_Bulk_Cargo_Brazil_to_Europe": {"name": "MSC Bulk Beta", "imo": "IMO9500022", "capacity": 55000},
        
        "CMA CGM_Container_TEU_China_to_USA": {"name": "CMA CGM Antoine de Saint Exupery", "imo": "IMO9776418", "capacity": 20954},
        "CMA CGM_Container_TEU_Asia_to_Europe": {"name": "CMA CGM Jacques Saade", "imo": "IMO9839179", "capacity": 23000},
        "CMA CGM_Container_TEU_Europe_to_USA": {"name": "CMA CGM Kerguelen", "imo": "IMO9702132", "capacity": 17722},
        "CMA CGM_Bulk_Cargo_Australia_to_China": {"name": "CMA CGM Bulk 1", "imo": "IMO9100033", "capacity": 60000},
        "CMA CGM_Bulk_Cargo_Brazil_to_Europe": {"name": "CMA CGM Bulk 2", "imo": "IMO9100044", "capacity": 60000},

        "Hapag-Lloyd_Container_TEU_China_to_USA": {"name": "Al Zubara", "imo": "IMO9708875", "capacity": 19870},
        "Hapag-Lloyd_Container_TEU_Asia_to_Europe": {"name": "Barzan", "imo": "IMO9708851", "capacity": 19870},
        "Hapag-Lloyd_Container_TEU_Europe_to_USA": {"name": "Tihama", "imo": "IMO9736107", "capacity": 19870},
        "Hapag-Lloyd_Bulk_Cargo_Australia_to_China": {"name": "HL Bulk Sydney", "imo": "IMO9200055", "capacity": 50000},
        "Hapag-Lloyd_Bulk_Cargo_Brazil_to_Europe": {"name": "HL Bulk Rio", "imo": "IMO9200066", "capacity": 50000},
    }
    
    rows = []
    for d in dates:
        for store in stores:
            for cat in categories:
                for prod in products[cat]:
                    # Base volume with noise
                    base = np.random.randint(5000, 15000)
                    
                    # Holiday rush for containers
                    if cat == "Container_TEU" and d.month in [10, 11, 12]:
                        base = int(base * 1.5)
                        
                    # Chinese New Year dip
                    if d.month == 2 and "China" in prod:
                        base = int(base * 0.6)
                        
                    vessel = vessel_map[f"{store}_{cat}_{prod}"]
                        
                    rows.append({
                        "Date": d,
                        "Company": store,
                        "Freight_Type": cat,
                        "Shipping_Lane": prod,
                        "Vessel_Name": vessel["name"],
                        "IMO_Number": vessel["imo"],
                        "Vessel_Capacity": vessel["capacity"],
                        "Volume_Tons": base
                    })
    
    df = pd.DataFrame(rows)
    df.to_csv(os.path.join(DATA_DIR, "logistics_forecast.csv"), index=False)
    print("Logistics (Maritime Shipping) dataset rebuilt.")

def rebuild_insurance():
    dates = pd.date_range(start="2022-01-01", end="2025-01-01", freq="D")
    stores = ["Geico", "StateFarm", "Allstate"]
    categories = ["Auto", "Home", "Life"]
    products = {
        "Auto": ["Comprehensive", "Liability"],
        "Home": ["Property", "Renters"],
        "Life": ["Term", "Whole"]
    }
    
    rows = []
    for d in dates:
        for store in stores:
            for cat in categories:
                for prod in products[cat]:
                    base = np.random.randint(50, 300)
                    if cat == "Auto":
                        base += np.random.randint(20, 80)
                    rows.append({
                        "Date": d,
                        "Agency": store,
                        "Policy_Type": cat,
                        "Coverage": prod,
                        "Conversions": base
                    })
    
    df = pd.DataFrame(rows)
    df.to_csv(os.path.join(DATA_DIR, "insurance_forecast.csv"), index=False)
    print("Insurance dataset rebuilt.")

if __name__ == "__main__":
    rebuild_grocery()
    rebuild_logistics()
    rebuild_insurance()
