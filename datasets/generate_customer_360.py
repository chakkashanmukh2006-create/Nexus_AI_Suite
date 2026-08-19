import pandas as pd
import numpy as np
import uuid
import random
from datetime import datetime, timedelta
import os

# Configuration
NUM_CUSTOMERS = 500
POLICY_TYPES = ["Health Insurance", "Life Insurance", "Motor Insurance", "Accidental Insurance"]
YEARS_HISTORY = 5
BASE_DATE = datetime(2026, 7, 1)

REALISTIC_NAMES = [
    "James Smith", "Mary Johnson", "Robert Williams", "Patricia Brown", "John Jones", 
    "Jennifer Garcia", "Michael Miller", "Linda Davis", "David Rodriguez", "Elizabeth Martinez", 
    "William Hernandez", "Barbara Lopez", "Richard Gonzalez", "Susan Wilson", "Joseph Anderson", 
    "Jessica Thomas", "Thomas Taylor", "Sarah Moore", "Charles Jackson", "Karen Martin", 
    "Christopher Lee", "Nancy Perez", "Daniel Thompson", "Lisa White", "Matthew Harris", 
    "Betty Sanchez", "Anthony Clark", "Margaret Ramirez", "Mark Lewis", "Sandra Robinson", 
    "Donald Walker", "Ashley Young", "Steven Allen", "Kimberly King", "Paul Wright", 
    "Emily Scott", "Andrew Torres", "Donna Nguyen", "Kenneth Hill", "Michelle Flores", 
    "Joshua Green", "Carol Adams", "Kevin Nelson", "Amanda Baker", "Brian Hall", 
    "Melissa Rivera", "George Campbell", "Deborah Mitchell", "Edward Carter", "Stephanie Roberts", 
    "Ronald Gomez", "Rebecca Phillips", "Timothy Evans", "Sharon Turner", "Jason Diaz", 
    "Laura Parker", "Jeffrey Cruz", "Cynthia Edwards", "Ryan Collins", "Kathleen Reyes", 
    "Jacob Stewart", "Amy Morris", "Gary Morales", "Shirley Murphy", "Nicholas Cook", 
    "Angela Rogers", "Eric Gutierrez", "Helen Ortiz", "Jonathan Morgan", "Anna Cooper", 
    "Stephen Peterson", "Brenda Bailey", "Larry Reed", "Pamela Kelly", "Justin Howard", 
    "Nicole Ramos", "Scott Kim", "Emma Cox", "Brandon Ward", "Samantha Richardson", 
    "Benjamin Watson", "Katherine Brooks", "Samuel Chavez", "Christine Wood", "Gregory James", 
    "Debra Bennett", "Frank Gray", "Rachel Mendoza", "Alexander Ruiz", "Carolyn Hughes", 
    "Raymond Price", "Janet Alvarez", "Patrick Castillo", "Catherine Sanders", "Jack Patel", 
    "Maria Myers", "Dennis Long", "Heather Ross", "Jerry Foster", "Diane Jimenez"
]

def make_typo(name):
    # simple typo generator (swap characters)
    if len(name) < 4: return name
    chars = list(name)
    idx = random.randint(1, len(name) - 2)
    chars[idx], chars[idx+1] = chars[idx+1], chars[idx]
    return "".join(chars)
BASE_DATE = datetime(2026, 7, 1)

# NLP Feedback Dictionary
POSITIVE_FEEDBACK = [
    "I am very happy with the coverage and the easy claim process.",
    "The premium is affordable and the support team is excellent.",
    "Great experience so far. Highly recommend the health bundle.",
    "Quick responses. Thinking about upgrading my motor insurance.",
    "Very satisfied with the accidental coverage terms."
]
NEGATIVE_FEEDBACK = [
    "The premiums are too expensive and keep increasing every year.",
    "Terrible customer service. Waiting too long for claims.",
    "I am unhappy with the hidden fees in my life insurance policy.",
    "Thinking of cancelling. Found a cheaper motor insurance elsewhere.",
    "Very frustrating experience with the recent claim rejection."
]
NEUTRAL_FEEDBACK = [
    "Just renewing my standard policy for another year.",
    "No issues, everything is fine.",
    "I have some questions about the coverage limits, please call me.",
    "Standard service, nothing special to note.",
    "Need to update my address on the accidental policy."
]

def generate_360_datasets():
    profiles = []
    policies = []
    bow_corrections = []
    
    print("Generating Customer 360 Dataset...")
    
    # 20 names chosen for typos
    typo_names = random.sample(REALISTIC_NAMES, 20)
    
    for i in range(NUM_CUSTOMERS):
        cust_id = f"C360-100{i:03d}"
        
        correct_name = random.choice(REALISTIC_NAMES)
        
        # apply typo
        if correct_name in typo_names:
            name = make_typo(correct_name)
            # save mapping for BoW retraining upload dataset
            if {"wrong_name": name, "correct_name": correct_name} not in bow_corrections:
                bow_corrections.append({"wrong_name": name, "correct_name": correct_name})
        else:
            name = correct_name
            
        age = random.randint(25, 65)
        city = random.choice(["New York", "London", "Sydney", "Toronto", "Berlin"])
        
        # Determine sentiment & feedback
        sentiment_roll = random.random()
        if sentiment_roll > 0.7:
            feedback = random.choice(POSITIVE_FEEDBACK)
            sentiment_label = "Positive"
        elif sentiment_roll > 0.4:
            feedback = random.choice(NEUTRAL_FEEDBACK)
            sentiment_label = "Neutral"
        else:
            feedback = random.choice(NEGATIVE_FEEDBACK)
            sentiment_label = "Negative"
            
        profiles.append({
            "customer_id": cust_id,
            "name": name,
            "age": age,
            "city": city,
            "feedback_notes": feedback,
            "sentiment_label": sentiment_label
        })
        
        # Determine customer engagement level
        # highly engaged customers get all 4 policies for 5 years (20 records)
        engagement_level = random.choice(["High", "Medium", "Low"])
        
        active_policy_types = []
        if engagement_level == "High":
            active_policy_types = POLICY_TYPES # all 4
        elif engagement_level == "Medium":
            active_policy_types = random.sample(POLICY_TYPES, 2)
        else:
            active_policy_types = random.sample(POLICY_TYPES, 1)
            
        # Generate transactional records
        for p_type in active_policy_types:
            # Randomize premium amount base
            base_premium = random.randint(300, 1500)
            
            # Create a 5-year transactional history for this policy type
            for year in range(YEARS_HISTORY):
                start_date = BASE_DATE - timedelta(days=365 * (YEARS_HISTORY - year))
                end_date = start_date + timedelta(days=365)
                
                # If it's the current year, it's active. Past years are expired.
                status = "Active" if year == (YEARS_HISTORY - 1) else "Expired"
                
                # Simulate churn for some "Negative" customers (stop renewing)
                if sentiment_label == "Negative" and year == (YEARS_HISTORY - 1) and random.random() > 0.5:
                    status = "Cancelled"
                if sentiment_label == "Negative" and year < (YEARS_HISTORY - 1) and random.random() > 0.8:
                    break # Stop creating history, they churned early
                    
                # Adjust premium slightly per year
                premium = base_premium + (year * random.randint(10, 50))
                
                policies.append({
                    "transaction_id": f"TXN-{uuid.uuid4().hex[:8]}",
                    "customer_id": cust_id,
                    "policy_type": p_type,
                    "start_date": start_date.strftime("%Y-%m-%d"),
                    "end_date": end_date.strftime("%Y-%m-%d"),
                    "premium_amount": premium,
                    "status": status,
                    "claim_history": random.choices([0, 1, 2], weights=[0.8, 0.15, 0.05])[0]
                })

    df_profiles = pd.DataFrame(profiles)
    df_policies = pd.DataFrame(policies)
    df_bow = pd.DataFrame(bow_corrections)
    
    # Save to root datasets folder for easy upload testing
    df_profiles.to_csv("customer_360_profiles.csv", index=False)
    df_policies.to_csv("customer_360_policies.csv", index=False)
    df_bow.to_csv("name_corrections_dataset.csv", index=False)
    
    print(f"✅ Generated {len(df_profiles)} 360 profiles.")
    print(f"✅ Generated {len(df_policies)} transactional policy records.")
    print(f"✅ Generated {len(df_bow)} typo correction pairs (saved to name_corrections_dataset.csv).")
    
if __name__ == "__main__":
    generate_360_datasets()
