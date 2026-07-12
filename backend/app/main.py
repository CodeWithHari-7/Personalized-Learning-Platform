"""
FastAPI Main Application Entry Point
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.database import create_all_tables

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    print("Starting Personalized Learning Platform API...")
    
    # Create database tables
    try:
        create_all_tables()
        print("[OK] Database tables created/verified")
    except Exception as e:
        print(f"[WARNING] DB init error: {e}")
    
    # Seed database from CSV if tables are empty
    try:
        from app.services.seeder import seed_database
        seed_database()
        print("[OK] Database seeding complete")
    except Exception as e:
        print(f"[WARNING] Seeding error: {e}")
    
    yield
    print("Shutting down...")


app = FastAPI(
    title="Personalized Learning Platform API",
    description="""
    ## AI-Powered Personalized Learning Platform for Data Science & ML Engineering
    
    ### Features:
    - **Authentication**: JWT-based register/login/logout
    - **Assessment**: AI-powered skill assessment with ML performance prediction
    - **Courses**: Browse 2000+ curated Data Science courses
    - **Recommendations**: ML-powered personalized course recommendations
    - **Progress Tracking**: Track course enrollment and completion
    - **Learning Paths**: Personalized career-based learning paths
    - **AI Tutor**: Conversational AI tutor (Gemini/Groq/OpenAI)
    - **Quiz Generator**: AI-generated quizzes on any DS/ML topic
    - **Coding Challenges**: AI-powered coding challenges with feedback
    - **Career Recommendations**: Career path matching with skill gap analysis
    - **Dashboard**: Comprehensive learning analytics
    """,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# ─── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Exception Handlers ────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"}
    )


# ─── Routers ──────────────────────────────────────────────────────────────────
from app.routers import auth, users, assessment, courses, recommendations, progress, chat, quiz, coding, dashboard, notifications

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(assessment.router)
app.include_router(courses.router)
app.include_router(recommendations.router)
app.include_router(progress.router)
app.include_router(chat.router)
app.include_router(quiz.router)
app.include_router(coding.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)


# ─── Health Check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {
        "message": "Personalized Learning Platform API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy", "version": settings.APP_VERSION}
