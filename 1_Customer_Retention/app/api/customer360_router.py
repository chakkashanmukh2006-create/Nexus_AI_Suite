from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from sklearn.feature_extraction.text import CountVectorizer
import json
import os
import csv
import io
import difflib

from app.database.session import get_db
from app.models.customer_360 import Customer360Profile, Customer360Policy
from app.models.prediction import CustomerPrediction

router = APIRouter()

# Simple positive/negative vocabulary lists to score BoW
POSITIVE_WORDS = ["happy", "excellent", "great", "satisfied", "quick", "affordable", "highly", "good"]
NEGATIVE_WORDS = ["expensive", "terrible", "unhappy", "frustrating", "cancelling", "bad", "rejection", "waiting"]

# Path to our Bag of Words correction dictionary
BOW_MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "trained_models", "bow_name_corrections.json")

def get_bow_corrections() -> dict:
    if os.path.exists(BOW_MODEL_PATH):
        try:
            with open(BOW_MODEL_PATH, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

VALID_NAMES = [
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

def get_valid_names(db: Session) -> List[str]:
    return VALID_NAMES

class PolicySchema(BaseModel):
    transaction_id: str
    policy_type: str
    start_date: str
    end_date: str
    premium_amount: float
    status: str
    claim_history: int

class Customer360Schema(BaseModel):
    customer_id: str
    name: str
    original_name: Optional[str] = None
    age: int
    city: str
    feedback_notes: Optional[str]
    sentiment_label: Optional[str]
    policies: List[PolicySchema]
    bow_sentiment_score: float
    behavioral_keywords: List[str]
    churn_risk_percent: float
    propensity_percent: float

@router.get("/{customer_id}", response_model=Customer360Schema)
def get_customer_360(customer_id: str, db: Session = Depends(get_db)):
    profile = db.query(Customer360Profile).filter(Customer360Profile.customer_id == customer_id).first()
    policies = []
    
    # If not found in C360 table, look in regular customers and mock the 360 profile on the fly!
    if not profile:
        from app.models.customer import Customer
        regular_cust = db.query(Customer).filter(Customer.customer_id == customer_id).first()
        if not regular_cust:
            raise HTTPException(status_code=404, detail="Customer not found in any database")
            
        # Create a mock C360 profile object in memory
        profile = Customer360Profile(
            customer_id=regular_cust.customer_id,
            name=regular_cust.name,
            age=regular_cust.age or 35,
            city="Dynamically Generated",
            feedback_notes=regular_cust.feedback or "Customer had general inquiries regarding policy details and premium structures. Slightly concerned about pricing.",
            sentiment_label="Neutral"
        )
        
        # Mock 5 years of transactions for this regular customer
        import uuid
        import random
        base_year = 2019
        for i in range(5):
            year = base_year + i
            policies.append(Customer360Policy(
                transaction_id=f"TXN-DYN-{uuid.uuid4().hex[:6]}",
                customer_id=customer_id,
                policy_type=regular_cust.policy_type or "Health Insurance",
                start_date=f"{year}-01-01",
                end_date=f"{year+1}-01-01",
                premium_amount=regular_cust.premium_amount or 1000.0,
                status="Active" if i == 4 else "Expired",
                claim_history=random.randint(0, 1)
            ))
    else:
        policies = db.query(Customer360Policy).filter(Customer360Policy.customer_id == customer_id).all()
    
    # NLP Bag of Words Analysis
    bow_sentiment_score = 50.0 # Neutral base
    behavioral_keywords = []
    
    if profile.feedback_notes:
        try:
            vectorizer = CountVectorizer(stop_words='english', lowercase=True)
            word_counts = vectorizer.fit_transform([profile.feedback_notes]).toarray()[0]
            vocab = vectorizer.get_feature_names_out()
            
            pos_hits = sum(1 for w in vocab if w in POSITIVE_WORDS)
            neg_hits = sum(1 for w in vocab if w in NEGATIVE_WORDS)
            
            # Simple weighting: +10 for pos, -10 for neg, clamp 0-100
            bow_sentiment_score = max(0, min(100, bow_sentiment_score + (pos_hits * 10) - (neg_hits * 10)))
            behavioral_keywords = list(vocab)[:5] # top 5 words
        except Exception as e:
            pass # fallback to 50 if BoW fails (e.g. text too short)
            
    # Mock some churn risk / propensity based on original prediction table if it exists, or generate based on sentiment
    # Look for original prediction
    pred = db.query(CustomerPrediction).filter(CustomerPrediction.customer_id == customer_id).order_by(CustomerPrediction.prediction_timestamp.desc()).first()
    
    churn_risk_percent = (pred.churn_ratio * 100) if pred and pred.churn_ratio else (100.0 - bow_sentiment_score) * 0.8
    propensity_percent = (100.0 - churn_risk_percent) * 0.9 # Inverse relationship approximation
    
    policy_schemas = [
        PolicySchema(
            transaction_id=p.transaction_id,
            policy_type=p.policy_type,
            start_date=p.start_date,
            end_date=p.end_date,
            premium_amount=p.premium_amount,
            status=p.status,
            claim_history=p.claim_history
        ) for p in policies
    ]
    
    # Apply BoW Name Correction or Fuzzy Matching
    bow_corrections = get_bow_corrections()
    
    if profile.name in bow_corrections:
        corrected_name = bow_corrections[profile.name]
        original_name = profile.name
    else:
        # Fallback to fuzzy matching
        valid_names = get_valid_names(db)
        matches = difflib.get_close_matches(profile.name, valid_names, n=1, cutoff=0.8)
        if matches and matches[0] != profile.name:
            corrected_name = matches[0]
            original_name = profile.name
        else:
            corrected_name = profile.name
            original_name = None

    return Customer360Schema(
        customer_id=profile.customer_id,
        name=corrected_name,
        original_name=original_name,
        age=profile.age,
        city=profile.city,
        feedback_notes=profile.feedback_notes,
        sentiment_label=profile.sentiment_label,
        policies=policy_schemas,
        bow_sentiment_score=round(bow_sentiment_score, 2),
        behavioral_keywords=behavioral_keywords,
        churn_risk_percent=round(churn_risk_percent, 2),
        propensity_percent=round(propensity_percent, 2)
    )

@router.get("/search/{query}")
def search_360_customers(query: str, db: Session = Depends(get_db)):
    """Search for Customer 360 profiles using Fuzzy Bag of Words matching."""
    from app.models.customer import Customer
    from thefuzz import fuzz
    
    # 1. Exact or substring match in 360 Profiles
    results_360 = db.query(Customer360Profile).filter(
        (Customer360Profile.customer_id.ilike(f"%{query}%")) | 
        (Customer360Profile.name.ilike(f"%{query}%")) |
        (Customer360Profile.city.ilike(f"%{query}%")) |
        (Customer360Profile.feedback_notes.ilike(f"%{query}%"))
    ).limit(25).all()
    
    # 2. Fuzzy Bag-of-Words match across the massive 115k Customer Database
    # We use a 2-character prefix to rapidly narrow the search space, then score mathematically.
    prefix = query[:2] if len(query) >= 2 else query
    candidate_customers = db.query(Customer.customer_id, Customer.name).filter(
        Customer.name.ilike(f"{prefix}%")
    ).all()
    
    scored_results = []
    for cid, cname in candidate_customers:
        # WRatio handles case-insensitivity, partial matching, and out-of-order words (BoW)
        score = fuzz.WRatio(query.lower(), cname.lower())
        if score > 70:  # 70% confidence threshold for fuzzy match
            scored_results.append((score, {"customer_id": cid, "name": cname, "city": "Unknown"}))
            
    # Sort by highest fuzzy score
    scored_results.sort(key=lambda x: x[0], reverse=True)
    best_fuzzy_matches = [item[1] for item in scored_results[:25]]
    
    seen = set()
    combined = []
    
    for r in results_360:
        seen.add(r.customer_id)
        combined.append({"customer_id": r.customer_id, "name": r.name, "city": r.city})
        
    for r in best_fuzzy_matches:
        if r["customer_id"] not in seen:
            seen.add(r["customer_id"])
            combined.append(r)
            
    # Also add exact ID matches if they bypassed the prefix filter
    exact_id_matches = db.query(Customer.customer_id, Customer.name).filter(
        Customer.customer_id.ilike(f"%{query}%")
    ).limit(10).all()
    for cid, cname in exact_id_matches:
        if cid not in seen:
            seen.add(cid)
    # Apply BoW Name Correction or Fuzzy Matching before returning
    bow_corrections = get_bow_corrections()
    valid_names = get_valid_names(db)
    
    for item in combined:
        if item["name"] in bow_corrections:
            item["original_name"] = item["name"]
            item["name"] = bow_corrections[item["name"]]
        else:
            # Fallback to fuzzy matching
            matches = difflib.get_close_matches(item["name"], valid_names, n=1, cutoff=0.8)
            if matches and matches[0] != item["name"]:
                item["original_name"] = item["name"]
                item["name"] = matches[0]
            else:
                item["original_name"] = None
        
    return combined[:25]

@router.post("/retrain_bow")
async def retrain_bow_model(file: UploadFile = File(...)):
    """
    Accepts a CSV with 'wrong_name,correct_name' to retrain the BoW name correction module.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed.")
        
    contents = await file.read()
    try:
        csv_data = contents.decode('utf-8')
        reader = csv.DictReader(io.StringIO(csv_data))
        
        corrections = {}
        for row in reader:
            if 'wrong_name' in row and 'correct_name' in row:
                corrections[row['wrong_name']] = row['correct_name']
                
        # Ensure directory exists
        os.makedirs(os.path.dirname(BOW_MODEL_PATH), exist_ok=True)
        
        # Save trained BoW model
        with open(BOW_MODEL_PATH, "w") as f:
            json.dump(corrections, f, indent=4)
            
        return {"status": "success", "message": f"Successfully trained BoW model with {len(corrections)} name corrections."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")
