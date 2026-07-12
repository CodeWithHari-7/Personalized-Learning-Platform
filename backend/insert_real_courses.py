import pandas as pd
from sqlalchemy import create_engine, text
from app.config import get_settings
import random

EXCEL_PATH = "C:\\Users\\harih\\Downloads\\Data Science 2\\learning-platform\\DataScience_DataAnalytics_Courses.xlsx"

def seed_courses():
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)
    
    df = pd.read_excel(EXCEL_PATH, header=1)
    
    inserted = 0
    with engine.connect() as conn:
        for index, row in df.iterrows():
            c_name = str(row.get('Course Name')).strip()
            c_url = str(row.get('Link')).strip()
            if pd.isna(row.get('Course Name')) or not c_name or c_name == 'nan':
                continue
                
            provider = str(row.get('Platform')).strip()
            instructor = str(row.get('Provider/Instructor')).strip()
            
            level = str(row.get('Level')).strip()
            if 'Beginner' in level: level = 'Beginner'
            elif 'Advanced' in level: level = 'Advanced'
            else: level = 'Intermediate'
            
            # Simple category heuristic
            cat = 'Data Science'
            cat_lower = c_name.lower()
            if 'machine learning' in cat_lower or 'deep learning' in cat_lower or 'ai' in cat_lower or 'artificial intelligence' in cat_lower:
                cat = 'Machine Learning'
            elif 'analytics' in cat_lower or 'analyst' in cat_lower:
                cat = 'Data Analytics'
            elif 'engineering' in cat_lower or 'pipeline' in cat_lower or 'hadoop' in cat_lower or 'spark' in cat_lower:
                cat = 'Data Engineering'
            elif 'cloud' in cat_lower or 'aws' in cat_lower or 'azure' in cat_lower or 'gcp' in cat_lower:
                cat = 'Cloud'
            elif 'visualization' in cat_lower or 'tableau' in cat_lower or 'powerbi' in cat_lower:
                cat = 'Visualization'
            elif 'python' in cat_lower or 'r ' in cat_lower or 'programming' in cat_lower:
                cat = 'Programming'
            elif 'sql' in cat_lower or 'database' in cat_lower:
                cat = 'SQL'
            elif 'statistics' in cat_lower or 'math' in cat_lower:
                cat = 'Statistics'

            # Avoid duplicates
            exists = conn.execute(text("SELECT id FROM courses WHERE course_name = :name"), {"name": c_name}).fetchone()
            if exists:
                conn.execute(
                    text("UPDATE courses SET url = :url WHERE id = :id"),
                    {"url": c_url, "id": exists[0]}
                )
                continue

            course_id = f"REAL{inserted+1:03d}"
            
            conn.execute(
                text("""
                INSERT INTO courses (
                    course_id, course_name, provider, category, level, 
                    rating, price, certificate_available, url, duration_hours
                ) VALUES (
                    :cid, :name, :prov, :cat, :level, 
                    :rating, :price, :cert, :url, :dur
                )
                """),
                {
                    "cid": course_id,
                    "name": c_name,
                    "prov": provider if provider and provider != 'nan' else 'Unknown',
                    "cat": cat,
                    "level": level,
                    "rating": round(random.uniform(4.0, 5.0), 1),
                    "price": 0.0 if 'free' in c_url.lower() else float(random.randint(10, 100)),
                    "cert": True,
                    "url": c_url,
                    "dur": random.randint(5, 50)
                }
            )
            inserted += 1
            
        conn.commit()
    print(f"Inserted {inserted} real courses from Excel!")

if __name__ == "__main__":
    seed_courses()
