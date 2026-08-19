from sqlalchemy import text
from app.database.session import SessionLocal

db = SessionLocal()
db.execute(text("INSERT INTO customer_360_profiles (customer_id, name, age, city, feedback_notes, sentiment_label) VALUES ('C360-TEST01', 'Wiliam Hernandez', 30, 'TestCity', 'good', 'Positive')"))
db.commit()
print("Inserted test record.")
