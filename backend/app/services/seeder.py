"""
Database seeder: loads CSV data into PostgreSQL tables
"""
import os
import pandas as pd
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Course, Skill, CourseSkill, CareerPath, Job

DATASET_DIR = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', '..', 'datasets'
)


def seed_database():
    """Seed the database with CSV data if tables are empty"""
    db: Session = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Course).count() > 0:
            print("[OK] Database already seeded, skipping...")
            return

        print("Seeding database from CSV files...")

        # ── Seed Skills ──
        skills_path = os.path.join(DATASET_DIR, 'skills.csv')
        if os.path.exists(skills_path):
            skills_df = pd.read_csv(skills_path)
            skill_objs = []
            for _, row in skills_df.head(500).iterrows():
                skill = Skill(
                    skill_id=str(row['skill_id']),
                    skill_name=str(row['skill_name']),
                    category=str(row['category']),
                    difficulty=str(row['difficulty'])
                )
                skill_objs.append(skill)
            db.bulk_save_objects(skill_objs)
            db.commit()
            print(f"  Seeded {len(skill_objs)} skills")

        # ── Seed Courses ──
        courses_path = os.path.join(DATASET_DIR, 'courses.csv')
        if os.path.exists(courses_path):
            courses_df = pd.read_csv(courses_path)
            course_objs = []
            for _, row in courses_df.iterrows():
                cert = str(row.get('certificate_available', 'No')).strip().lower() == 'yes'
                course = Course(
                    course_id=str(row['course_id']),
                    course_name=str(row['course_name'])[:300],
                    provider=str(row['provider']),
                    category=str(row['category']),
                    sub_category=str(row.get('sub_category', '')) if pd.notna(row.get('sub_category')) else None,
                    level=str(row.get('level', 'Beginner')),
                    duration_hours=int(row['duration_hours']) if pd.notna(row.get('duration_hours')) else None,
                    rating=float(row['rating']) if pd.notna(row.get('rating')) else None,
                    total_reviews=int(row['total_reviews']) if pd.notna(row.get('total_reviews')) else None,
                    enrolled_students=int(row['enrolled_students']) if pd.notna(row.get('enrolled_students')) else None,
                    price=float(row['price']) if pd.notna(row.get('price')) else 0.0,
                    language=str(row.get('language', 'English')),
                    certificate_available=cert,
                    prerequisites=str(row.get('prerequisites', ''))[:500] if pd.notna(row.get('prerequisites')) else None,
                    description=str(row.get('description', ''))[:1000] if pd.notna(row.get('description')) else None,
                    release_year=int(row['release_year']) if pd.notna(row.get('release_year')) else None,
                    last_updated=str(row.get('last_updated', ''))
                )
                course_objs.append(course)
            db.bulk_save_objects(course_objs)
            db.commit()
            print(f"  Seeded {len(course_objs)} courses")

        # ── Seed Career Paths ──
        careers_path = os.path.join(DATASET_DIR, 'career_paths.csv')
        if os.path.exists(careers_path):
            careers_df = pd.read_csv(careers_path)
            career_objs = []
            for _, row in careers_df.head(20).iterrows():
                career = CareerPath(
                    career_id=str(row['career_id']),
                    career_name=str(row['career_name']),
                    required_skills=str(row.get('required_skills', '')),
                    average_salary=int(row['average_salary']) if pd.notna(row.get('average_salary')) else None,
                    job_growth=str(row.get('job_growth', '')),
                    description=str(row.get('description', ''))[:1000]
                )
                career_objs.append(career)
            db.bulk_save_objects(career_objs)
            db.commit()
            print(f"  Seeded {len(career_objs)} career paths")

        # ── Seed Jobs (limited) ──
        jobs_path = os.path.join(DATASET_DIR, 'jobs.csv')
        if os.path.exists(jobs_path):
            jobs_df = pd.read_csv(jobs_path)
            job_objs = []
            for _, row in jobs_df.head(500).iterrows():
                remote = str(row.get('remote', 'No')).strip().lower() == 'yes'
                job = Job(
                    job_id=str(row['job_id']),
                    job_title=str(row['job_title'])[:200],
                    company=str(row.get('company', ''))[:200],
                    location=str(row.get('location', ''))[:200],
                    country=str(row.get('country', ''))[:100],
                    salary_min=int(row['salary_min']) if pd.notna(row.get('salary_min')) else None,
                    salary_max=int(row['salary_max']) if pd.notna(row.get('salary_max')) else None,
                    experience=str(row.get('experience', ''))[:50],
                    employment_type=str(row.get('employment_type', ''))[:50],
                    education=str(row.get('education', ''))[:100],
                    skills_required=str(row.get('skills_required', ''))[:1000],
                    remote=remote,
                    description=str(row.get('description', ''))[:1000],
                    posted_date=str(row.get('posted_date', ''))[:20]
                )
                job_objs.append(job)
            db.bulk_save_objects(job_objs)
            db.commit()
            print(f"  Seeded {len(job_objs)} jobs")

        print("[OK] Database seeding complete!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()
