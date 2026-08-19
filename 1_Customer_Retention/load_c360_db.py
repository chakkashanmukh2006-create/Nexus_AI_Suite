import pandas as pd
from sqlalchemy import text
from app.database.session import SessionLocal, engine
from app.models.customer_360 import Customer360Profile, Customer360Policy

def load_data():
    print("Loading Customer 360 data into SQLite DB...")
    
    # Read generated CSVs (from Insure_AI_Ecosystem/datasets)
    profiles_df = pd.read_csv("../datasets/customer_360_profiles.csv")
    policies_df = pd.read_csv("../datasets/customer_360_policies.csv")
    
    db = SessionLocal()
    
    # Clear existing data
    db.execute(text("DELETE FROM customer_360_policies"))
    db.execute(text("DELETE FROM customer_360_profiles"))
    db.commit()
    
    # Insert profiles
    for _, row in profiles_df.iterrows():
        prof = Customer360Profile(
            customer_id=row['customer_id'],
            name=row['name'],
            age=row['age'],
            city=row['city'],
            feedback_notes=row['feedback_notes'],
            sentiment_label=row['sentiment_label']
        )
        db.add(prof)
        
    # Insert policies
    for _, row in policies_df.iterrows():
        pol = Customer360Policy(
            transaction_id=row['transaction_id'],
            customer_id=row['customer_id'],
            policy_type=row['policy_type'],
            start_date=row['start_date'],
            end_date=row['end_date'],
            premium_amount=row['premium_amount'],
            status=row['status'],
            claim_history=row['claim_history']
        )
        db.add(pol)
        
    db.commit()
    print("Data successfully loaded!")

if __name__ == "__main__":
    load_data()
