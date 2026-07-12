"""
Database configuration and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all_tables():
    """Create all tables defined in the ORM models"""
    from app.models import (User, Course, Skill, CourseSkill, Assessment,
                            AssessmentSkill, Progress, Recommendation,
                            LearningPath, LearningPathStep, CareerPath,
                            Job, JobSkill, QuizHistory, CodingChallenge,
                            ChatHistory, Session)
    Base.metadata.create_all(bind=engine)
