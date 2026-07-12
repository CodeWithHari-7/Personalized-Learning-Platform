import pandas as pd
from sqlalchemy import create_engine, text
from app.config import get_settings

EXCEL_PATH = "C:\\Users\\harih\\Downloads\\Data Science 2\\learning-platform\\DataScience_DataAnalytics_Courses.xlsx"

def migrate():
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        print("Checking if 'url' column exists...")
        try:
            conn.execute(text("ALTER TABLE courses ADD COLUMN url VARCHAR(500)"))
            conn.commit()
            print("Added 'url' column to courses table.")
        except Exception as e:
            conn.rollback()
            if "already exists" in str(e).lower() or "duplicate column" in str(e).lower():
                print("'url' column already exists.")
            else:
                print(f"SQL Error: {e}")

        print(f"Reading excel file {EXCEL_PATH}...")
        df = pd.read_excel(EXCEL_PATH, header=1)

        updates = 0
        not_found = 0

        for index, row in df.iterrows():
            course_name = row.get('Course Name')
            url = row.get('Link')

            if pd.isna(course_name) or pd.isna(url):
                continue
                
            course_name = str(course_name).strip()
            url = str(url).strip()

            result = conn.execute(
                text("SELECT id FROM courses WHERE course_name = :name"),
                {"name": course_name}
            ).fetchone()

            if result:
                course_id = result[0]
                conn.execute(
                    text("UPDATE courses SET url = :url WHERE id = :id"),
                    {"url": url, "id": course_id}
                )
                updates += 1
            else:
                not_found += 1
                
        conn.commit()
        
    print(f"Migration complete! Updated {updates} courses. {not_found} courses from excel were not found in DB.")

if __name__ == "__main__":
    migrate()
