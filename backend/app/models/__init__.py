"""
SQLAlchemy ORM Models for all database tables
"""
from sqlalchemy import (Column, String, Integer, Float, Boolean, DateTime,
                         Text, ForeignKey, Enum, Index, UniqueConstraint)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class GenderEnum(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"
    prefer_not_to_say = "prefer_not_to_say"


# ─── Users ───────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(50), nullable=True)
    country = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    university = Column(String(200), nullable=True)
    department = Column(String(200), nullable=True)
    semester = Column(Integer, nullable=True)
    cgpa = Column(Float, nullable=True)
    career_goal = Column(String(200), nullable=True)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    assessments = relationship("Assessment", back_populates="user", cascade="all, delete-orphan")
    progress = relationship("Progress", back_populates="user", cascade="all, delete-orphan")
    recommendations = relationship("Recommendation", back_populates="user", cascade="all, delete-orphan")
    learning_paths = relationship("LearningPath", back_populates="user", cascade="all, delete-orphan")
    quiz_history = relationship("QuizHistory", back_populates="user", cascade="all, delete-orphan")
    coding_challenges = relationship("CodingChallenge", back_populates="user", cascade="all, delete-orphan")
    chat_history = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    coding_attempts = relationship("CodingAttempt", back_populates="user", cascade="all, delete-orphan")


# ─── Courses ─────────────────────────────────────────────────────────────────
class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(String(20), unique=True, index=True, nullable=False)
    course_name = Column(String(300), nullable=False)
    provider = Column(String(100), nullable=False)
    category = Column(String(100), nullable=False, index=True)
    sub_category = Column(String(100), nullable=True)
    level = Column(String(50), nullable=True)
    duration_hours = Column(Integer, nullable=True)
    rating = Column(Float, nullable=True)
    total_reviews = Column(Integer, nullable=True)
    enrolled_students = Column(Integer, nullable=True)
    price = Column(Float, nullable=True)
    language = Column(String(50), nullable=True)
    certificate_available = Column(Boolean, default=False)
    prerequisites = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    release_year = Column(Integer, nullable=True)
    last_updated = Column(String(20), nullable=True)
    url = Column(String(500), nullable=True)

    # Relationships
    progress = relationship("Progress", back_populates="course")
    recommendations = relationship("Recommendation", back_populates="course")
    course_skills = relationship("CourseSkill", back_populates="course")


# ─── Skills ──────────────────────────────────────────────────────────────────
class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, index=True)
    skill_id = Column(String(20), unique=True, index=True, nullable=False)
    skill_name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)
    difficulty = Column(String(50), nullable=True)

    # Relationships
    course_skills = relationship("CourseSkill", back_populates="skill")
    assessment_skills = relationship("AssessmentSkill", back_populates="skill")
    job_skills = relationship("JobSkill", back_populates="skill")


class CourseSkill(Base):
    __tablename__ = "course_skills"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    importance = Column(String(20), nullable=True)

    course = relationship("Course", back_populates="course_skills")
    skill = relationship("Skill", back_populates="course_skills")


# ─── Assessments ──────────────────────────────────────────────────────────────
class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cgpa = Column(Float, nullable=True)
    semester = Column(Integer, nullable=True)
    experience_years = Column(Float, nullable=True)
    career_goal = Column(String(200), nullable=True)
    skill_level = Column(String(50), nullable=True)  # Beginner/Intermediate/Advanced
    programming_score = Column(Integer, nullable=True)
    ml_score = Column(Integer, nullable=True)
    statistics_score = Column(Integer, nullable=True)
    data_engineering_score = Column(Integer, nullable=True)
    cloud_score = Column(Integer, nullable=True)
    visualization_score = Column(Integer, nullable=True)
    soft_skills_score = Column(Integer, nullable=True)
    overall_score = Column(Float, nullable=True)
    performance_prediction = Column(String(50), nullable=True)
    recommended_path = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="assessments")
    skills = relationship("AssessmentSkill", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentSkill(Base):
    __tablename__ = "assessment_skills"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("assessments.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)
    proficiency = Column(String(50), nullable=True)
    score = Column(Integer, nullable=True)

    assessment = relationship("Assessment", back_populates="skills")
    skill = relationship("Skill", back_populates="assessment_skills")


# ─── Progress ─────────────────────────────────────────────────────────────────
class Progress(Base):
    __tablename__ = "progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    enrollment_date = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed_at = Column(DateTime(timezone=True), nullable=True)
    completion_date = Column(DateTime(timezone=True), nullable=True)
    progress_percent = Column(Float, default=0.0)
    completion_status = Column(String(50), default="Not Started")
    score = Column(Float, nullable=True)
    certificate_earned = Column(Boolean, default=False)
    time_spent_hours = Column(Float, default=0.0)
    time_spent_seconds = Column(Integer, default=0)
    completed_lessons = Column(Integer, default=0)
    total_lessons = Column(Integer, default=10)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="progress")
    course = relationship("Course", back_populates="progress")
    certificates = relationship("Certificate", back_populates="progress", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('user_id', 'course_id', name='uq_user_course'),
        Index('idx_progress_user_status', 'user_id', 'completion_status'),
    )


# ─── Certificates ──────────────────────────────────────────────────────────────
class Certificate(Base):
    __tablename__ = "certificates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    progress_id = Column(Integer, ForeignKey("progress.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    original_filename = Column(String(500), nullable=True)
    file_path = Column(String(1000), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    content_type = Column(String(100), nullable=True)
    verification_status = Column(String(50), default="Pending")  # Pending, Verified, Likely Valid, Needs Manual Review, Rejected
    verification_confidence = Column(Float, nullable=True)
    verification_reason = Column(Text, nullable=True)
    extracted_name = Column(String(200), nullable=True)
    extracted_course = Column(String(500), nullable=True)
    extracted_issuer = Column(String(200), nullable=True)
    extracted_date = Column(String(100), nullable=True)
    extracted_cert_id = Column(String(200), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    verified_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
    progress = relationship("Progress", back_populates="certificates")
    course = relationship("Course")


# ─── Recommendations ──────────────────────────────────────────────────────────
class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    recommendation_score = Column(Float, nullable=True)
    reason = Column(String(300), nullable=True)
    model_version = Column(String(50), nullable=True)
    is_dismissed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="recommendations")
    course = relationship("Course", back_populates="recommendations")


# ─── Learning Paths ───────────────────────────────────────────────────────────
class LearningPath(Base):
    __tablename__ = "learning_paths"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    career_goal = Column(String(200), nullable=False)
    path_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    total_courses = Column(Integer, default=0)
    estimated_weeks = Column(Integer, default=0)
    completion_percent = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="learning_paths")
    steps = relationship("LearningPathStep", back_populates="learning_path", cascade="all, delete-orphan",
                         order_by="LearningPathStep.step_order")


class LearningPathStep(Base):
    __tablename__ = "learning_path_steps"

    id = Column(Integer, primary_key=True, index=True)
    learning_path_id = Column(Integer, ForeignKey("learning_paths.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    status = Column(String(50), default="Pending")
    is_mandatory = Column(Boolean, default=True)

    learning_path = relationship("LearningPath", back_populates="steps")
    course = relationship("Course")


# ─── Career Paths ─────────────────────────────────────────────────────────────
class CareerPath(Base):
    __tablename__ = "career_paths"

    id = Column(Integer, primary_key=True, index=True)
    career_id = Column(String(20), unique=True, index=True)
    career_name = Column(String(200), nullable=False)
    required_skills = Column(Text, nullable=True)
    average_salary = Column(Integer, nullable=True)
    job_growth = Column(String(20), nullable=True)
    description = Column(Text, nullable=True)


# ─── Job Skills ───────────────────────────────────────────────────────────────
class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(String(20), unique=True, index=True)
    job_title = Column(String(200), nullable=False)
    company = Column(String(200), nullable=True)
    location = Column(String(200), nullable=True)
    country = Column(String(100), nullable=True)
    salary_min = Column(Integer, nullable=True)
    salary_max = Column(Integer, nullable=True)
    experience = Column(String(50), nullable=True)
    employment_type = Column(String(50), nullable=True)
    education = Column(String(100), nullable=True)
    skills_required = Column(Text, nullable=True)
    remote = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    posted_date = Column(String(20), nullable=True)

    job_skills = relationship("JobSkill", back_populates="job")


class JobSkill(Base):
    __tablename__ = "job_skills"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    skill_id = Column(Integer, ForeignKey("skills.id"), nullable=False)

    job = relationship("Job", back_populates="job_skills")
    skill = relationship("Skill", back_populates="job_skills")


# ─── Quiz History ─────────────────────────────────────────────────────────────
class QuizHistory(Base):
    __tablename__ = "quiz_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic = Column(String(200), nullable=False)
    difficulty = Column(String(50), nullable=True)
    num_questions = Column(Integer, default=5)
    score = Column(Float, nullable=True)
    max_score = Column(Float, nullable=True)
    percentage = Column(Float, nullable=True)
    time_taken_seconds = Column(Integer, nullable=True)
    questions_data = Column(Text, nullable=True)  # JSON string
    answers_data = Column(Text, nullable=True)     # JSON string
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="quiz_history")


# ─── Coding Challenges ────────────────────────────────────────────────────────
class CodingChallenge(Base):
    __tablename__ = "coding_challenges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    topic = Column(String(200), nullable=False)
    difficulty = Column(String(50), nullable=True)
    language = Column(String(50), default="Python")
    challenge_title = Column(String(300), nullable=True)
    challenge_description = Column(Text, nullable=True)
    starter_code = Column(Text, nullable=True)
    solution_code = Column(Text, nullable=True)
    user_code = Column(Text, nullable=True)
    test_cases = Column(Text, nullable=True)  # JSON string
    hidden_test_cases = Column(Text, nullable=True)  # JSON string
    ai_feedback = Column(Text, nullable=True)
    is_completed = Column(Boolean, default=False)
    score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="coding_challenges")


# ─── Chat History ─────────────────────────────────────────────────────────────
class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String(100), nullable=True, index=True)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    message_type = Column(String(50), default="text")  # text, quiz, code, etc.
    metadata_json = Column(Text, nullable=True)  # additional data as JSON
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="chat_history")

    __table_args__ = (
        Index('idx_chat_user_session', 'user_id', 'session_id'),
    )


# ─── Sessions ─────────────────────────────────────────────────────────────────
class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(500), nullable=False, unique=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")


# ─── Notifications ────────────────────────────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # e.g., course_enrolled, challenge_evaluated, quiz_completed
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, index=True)
    related_entity_type = Column(String(100), nullable=True)
    related_entity_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="notifications")


# ─── Coding Attempts ──────────────────────────────────────────────────────────
class CodingAttempt(Base):
    __tablename__ = "coding_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    challenge_id = Column(Integer, ForeignKey("coding_challenges.id"), nullable=False, index=True)
    submitted_code = Column(Text, nullable=False)
    language = Column(String(50), nullable=False)
    score = Column(Float, nullable=False)
    test_cases_passed = Column(Integer, default=0)
    test_cases_total = Column(Integer, default=0)
    ai_feedback = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="coding_attempts")
    challenge = relationship("CodingChallenge")

