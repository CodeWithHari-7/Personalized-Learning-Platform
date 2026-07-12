"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, validator, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import re


# ─── Auth Schemas ──────────────────────────────────────────────────────────────
class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    age: Optional[int] = Field(None, ge=16, le=80)
    gender: Optional[str] = None
    country: Optional[str] = None
    department: Optional[str] = None

    @validator('username')
    def username_alphanumeric(cls, v):
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username must be alphanumeric with underscores')
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


# ─── User Schemas ──────────────────────────────────────────────────────────────
class UserProfile(BaseModel):
    id: int
    email: str
    username: str
    first_name: str
    last_name: str
    age: Optional[int]
    gender: Optional[str]
    country: Optional[str]
    city: Optional[str]
    university: Optional[str]
    department: Optional[str]
    semester: Optional[int]
    cgpa: Optional[float]
    career_goal: Optional[str]
    bio: Optional[str]
    avatar_url: Optional[str]
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    age: Optional[int] = Field(None, ge=16, le=80)
    gender: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    university: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[int] = Field(None, ge=1, le=12)
    cgpa: Optional[float] = Field(None, ge=0.0, le=10.0)
    career_goal: Optional[str] = None
    bio: Optional[str] = None


# ─── Assessment Schemas ────────────────────────────────────────────────────────
class AssessmentCreate(BaseModel):
    cgpa: Optional[float] = Field(None, ge=0.0, le=10.0)
    semester: Optional[int] = Field(None, ge=1, le=12)
    experience_years: Optional[float] = Field(None, ge=0.0, le=50.0)
    career_goal: Optional[str] = None
    programming_score: Optional[int] = Field(None, ge=0, le=100)
    ml_score: Optional[int] = Field(None, ge=0, le=100)
    statistics_score: Optional[int] = Field(None, ge=0, le=100)
    data_engineering_score: Optional[int] = Field(None, ge=0, le=100)
    cloud_score: Optional[int] = Field(None, ge=0, le=100)
    visualization_score: Optional[int] = Field(None, ge=0, le=100)
    soft_skills_score: Optional[int] = Field(None, ge=0, le=100)


class AssessmentResponse(BaseModel):
    id: int
    user_id: int
    cgpa: Optional[float]
    career_goal: Optional[str]
    overall_score: Optional[float]
    performance_prediction: Optional[str]
    recommended_path: Optional[str]
    skill_gaps: Optional[List[str]] = []
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── Course Schemas ────────────────────────────────────────────────────────────
class CourseResponse(BaseModel):
    id: int
    course_id: str
    course_name: str
    provider: str
    category: str
    sub_category: Optional[str]
    level: Optional[str]
    duration_hours: Optional[int]
    rating: Optional[float]
    total_reviews: Optional[int]
    enrolled_students: Optional[int]
    price: Optional[float]
    language: Optional[str]
    certificate_available: Optional[bool]
    prerequisites: Optional[str]
    description: Optional[str]
    release_year: Optional[int]
    url: Optional[str] = None

    class Config:
        from_attributes = True


class CourseListResponse(BaseModel):
    courses: List[CourseResponse]
    total: int
    page: int
    page_size: int


# ─── Recommendation Schemas ────────────────────────────────────────────────────
class RecommendationRequest(BaseModel):
    career_goal: Optional[str] = None
    skill_areas: Optional[List[str]] = []
    preferred_level: Optional[str] = None
    max_duration_hours: Optional[int] = None
    num_recommendations: int = Field(default=5, ge=1, le=20)


class RecommendationResponse(BaseModel):
    id: int
    course: CourseResponse
    recommendation_score: Optional[float]
    reason: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── Progress Schemas ──────────────────────────────────────────────────────────
class ProgressCreate(BaseModel):
    course_id: str  # external course_id like CRS0001
    progress_percent: Optional[float] = Field(default=0.0, ge=0.0, le=100.0)
    score: Optional[float] = Field(None, ge=0.0, le=100.0)
    time_spent_hours: Optional[float] = None
    notes: Optional[str] = None


class ProgressUpdate(BaseModel):
    progress_percent: Optional[float] = Field(None, ge=0.0, le=100.0)
    score: Optional[float] = Field(None, ge=0.0, le=100.0)
    time_spent_hours: Optional[float] = None
    notes: Optional[str] = None
    completion_status: Optional[str] = None


class ProgressResponse(BaseModel):
    id: int
    user_id: int
    course: Optional[CourseResponse] = None
    # Flattened course fields for convenience
    course_name: Optional[str] = None
    provider: Optional[str] = None
    category: Optional[str] = None
    level: Optional[str] = None
    course_url: Optional[str] = None
    # Progress fields
    progress_percent: float
    completion_status: str
    score: Optional[float]
    certificate_earned: bool
    time_spent_hours: float
    time_spent_seconds: Optional[int] = 0
    completed_lessons: Optional[int] = 0
    total_lessons: Optional[int] = 10
    enrollment_date: Optional[datetime]
    last_accessed_at: Optional[datetime] = None
    completion_date: Optional[datetime]

    class Config:
        from_attributes = True


# ─── Certificate Schemas ───────────────────────────────────────────────────────
class CertificateResponse(BaseModel):
    id: int
    user_id: int
    progress_id: int
    course_id: int
    original_filename: Optional[str]
    verification_status: str
    verification_confidence: Optional[float]
    verification_reason: Optional[str]
    extracted_name: Optional[str]
    extracted_course: Optional[str]
    extracted_issuer: Optional[str]
    extracted_date: Optional[str]
    extracted_cert_id: Optional[str]
    uploaded_at: Optional[datetime]
    verified_at: Optional[datetime]
    # Nested
    course_name: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Learning Path Schemas ─────────────────────────────────────────────────────
class LearningPathStep(BaseModel):
    step_order: int
    course: CourseResponse
    status: str
    is_mandatory: bool

    class Config:
        from_attributes = True


class LearningPathResponse(BaseModel):
    id: int
    career_goal: str
    path_name: str
    description: Optional[str]
    total_courses: int
    estimated_weeks: int
    completion_percent: float
    is_active: bool
    steps: List[LearningPathStep] = []
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── Chat Schemas ──────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    session_id: Optional[str] = None
    message_type: Optional[str] = "text"


class ChatMessage(BaseModel):
    role: str
    content: str
    message_type: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    message: str
    session_id: str
    role: str = "assistant"


# ─── Quiz Schemas ──────────────────────────────────────────────────────────────
class QuizGenerateRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=200)
    difficulty: str = Field(default="Intermediate", pattern="^(Beginner|Intermediate|Advanced)$")
    num_questions: int = Field(default=5, ge=3, le=15)


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_answer: str
    explanation: str


class QuizSubmitRequest(BaseModel):
    quiz_history_id: int
    answers: Dict[str, str]  # {question_index: selected_answer}
    time_taken_seconds: Optional[int] = None


class QuizHistoryResponse(BaseModel):
    id: int
    topic: str
    difficulty: Optional[str]
    num_questions: int
    score: Optional[float]
    max_score: Optional[float]
    percentage: Optional[float]
    time_taken_seconds: Optional[int]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── Coding Challenge Schemas ──────────────────────────────────────────────────
class CodingChallengeRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=200)
    difficulty: str = Field(default="Intermediate", pattern="^(Beginner|Intermediate|Advanced)$")
    language: str = Field(default="Python", pattern="^(Python|SQL|R)$")


class CodingChallengeResponse(BaseModel):
    id: int
    topic: str
    difficulty: Optional[str]
    language: str
    challenge_title: Optional[str]
    challenge_description: Optional[str]
    starter_code: Optional[str]
    test_cases: Optional[str]
    user_code: Optional[str]
    ai_feedback: Optional[str]
    is_completed: bool
    score: Optional[float]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class CodeSubmitRequest(BaseModel):
    challenge_id: int
    user_code: str = Field(..., min_length=1)


# ─── Dashboard Schema ──────────────────────────────────────────────────────────
class DashboardResponse(BaseModel):
    user: UserProfile
    total_courses_enrolled: int
    completed_courses: int
    in_progress_courses: int
    overall_progress_percent: float
    total_time_spent_hours: float
    quiz_avg_score: float
    quiz_attempts: int
    highest_quiz_score: Optional[float] = None
    lowest_quiz_score: Optional[float] = None
    quiz_completion_percentage: Optional[float] = None
    coding_challenges_completed: int
    coding_challenges_attempted: int
    average_coding_score: Optional[float] = None
    highest_coding_score: Optional[float] = None
    coding_success_rate: Optional[float] = None
    coding_improvement_trend: Optional[str] = None
    top_skill_categories: List[str]
    recent_activity: List[Dict[str, Any]]
    performance_level: str
    career_goal: Optional[str]
    learning_streak_days: int


# ─── Career Recommendation Schema ─────────────────────────────────────────────
class CareerRecommendationResponse(BaseModel):
    career_name: str
    match_score: float
    required_skills: List[str]
    current_skills: List[str]
    skill_gaps: List[str]
    average_salary: Optional[int]
    job_growth: Optional[str]
    description: Optional[str]
    recommended_courses: List[CourseResponse]


# ─── Skill Gap Schema ─────────────────────────────────────────────────────────
class SkillGapResponse(BaseModel):
    career_goal: str
    current_skills: List[Dict[str, Any]]
    missing_skills: List[str]
    recommended_skill_categories: List[str]
    skill_scores: Dict[str, float]
    overall_readiness_percent: float
