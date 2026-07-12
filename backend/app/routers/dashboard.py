"""
Dashboard & Career routers
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import (User, Progress, QuizHistory, CodingChallenge,
                         Assessment, ChatHistory, CareerPath, Course, Recommendation)
from app.schemas import DashboardResponse, CareerRecommendationResponse, CourseResponse, UserProfile
from app.utils.auth import get_current_user
from app.ml import analyze_skill_gap

router = APIRouter(tags=["Dashboard & Career"])


@router.get("/dashboard")
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive dashboard data"""
    # Progress stats
    all_progress = db.query(Progress).filter(Progress.user_id == current_user.id).all()
    total_enrolled = len(all_progress)
    completed = sum(1 for p in all_progress if p.completion_status == "Completed")
    in_progress = sum(1 for p in all_progress if p.completion_status == "In Progress")
    total_time = sum(p.time_spent_hours or 0 for p in all_progress)
    avg_progress = sum(p.progress_percent or 0 for p in all_progress) / max(total_enrolled, 1)

    # Quiz stats
    quizzes = db.query(QuizHistory).filter(
        QuizHistory.user_id == current_user.id,
        QuizHistory.percentage != None
    ).all()
    quiz_avg = sum(q.percentage or 0 for q in quizzes) / max(len(quizzes), 1)
    highest_quiz = max((q.percentage for q in quizzes), default=0) if quizzes else 0
    lowest_quiz = min((q.percentage for q in quizzes), default=0) if quizzes else 0
    quiz_completion_percentage = (sum(1 for q in quizzes if q.percentage and q.percentage >= 70) / max(len(quizzes), 1)) * 100

    # Coding challenge stats
    challenges = db.query(CodingChallenge).filter(CodingChallenge.user_id == current_user.id).all()
    challenges_completed = sum(1 for c in challenges if c.is_completed)
    completed_challenges_list = [c for c in challenges if c.is_completed and c.score is not None]
    avg_coding_score = sum(c.score for c in completed_challenges_list) / max(len(completed_challenges_list), 1)
    highest_coding_score = max((c.score for c in completed_challenges_list), default=0) if completed_challenges_list else 0
    coding_success_rate = (challenges_completed / max(len(challenges), 1)) * 100
    
    # Simple improvement trend calculation
    if len(completed_challenges_list) >= 2:
        recent_half = completed_challenges_list[len(completed_challenges_list)//2:]
        older_half = completed_challenges_list[:len(completed_challenges_list)//2]
        recent_avg = sum(c.score for c in recent_half) / max(len(recent_half), 1)
        older_avg = sum(c.score for c in older_half) / max(len(older_half), 1)
        coding_improvement_trend = "Improving" if recent_avg > older_avg else "Stable" if recent_avg == older_avg else "Needs Practice"
    else:
        coding_improvement_trend = "Not Enough Data"

    # Latest assessment
    assessment = db.query(Assessment).filter(
        Assessment.user_id == current_user.id
    ).order_by(Assessment.created_at.desc()).first()

    performance = assessment.performance_prediction if assessment else "Not Assessed"

    # Recent activity
    recent = []
    for p in sorted(all_progress, key=lambda x: x.enrollment_date or x.created_at or '', reverse=True)[:5]:
        course = db.query(Course).filter(Course.id == p.course_id).first()
        recent.append({
            "type": "course",
            "title": course.course_name if course else "Unknown",
            "status": p.completion_status,
            "date": str(p.updated_at or p.enrollment_date or ''),
            "progress": p.progress_percent
        })

    for q in sorted(quizzes, key=lambda x: x.created_at or '', reverse=True)[:3]:
        recent.append({
            "type": "quiz",
            "title": f"Quiz: {q.topic}",
            "status": "Completed",
            "date": str(q.created_at or ''),
            "score": q.percentage
        })

    recent.sort(key=lambda x: x.get("date", ""), reverse=True)

    # Top skill categories
    assessments_list = db.query(Assessment).filter(Assessment.user_id == current_user.id).all()
    top_skills = []
    if assessments_list:
        latest = assessments_list[-1]
        score_map = {
            "Programming": latest.programming_score or 0,
            "Machine Learning": latest.ml_score or 0,
            "Statistics": latest.statistics_score or 0,
            "Data Engineering": latest.data_engineering_score or 0,
            "Cloud": latest.cloud_score or 0,
            "Visualization": latest.visualization_score or 0,
        }
        top_skills = sorted(score_map.items(), key=lambda x: x[1], reverse=True)
        top_skills = [s[0] for s in top_skills[:3]]

    return {
        "user": {
            "id": current_user.id,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "email": current_user.email,
            "username": current_user.username,
            "career_goal": current_user.career_goal,
            "cgpa": current_user.cgpa,
            "department": current_user.department
        },
        "total_courses_enrolled": total_enrolled,
        "completed_courses": completed,
        "in_progress_courses": in_progress,
        "overall_progress_percent": round(avg_progress, 1),
        "total_time_spent_hours": round(total_time, 1),
        "quiz_avg_score": round(quiz_avg, 1),
        "quiz_attempts": len(quizzes),
        "highest_quiz_score": round(highest_quiz, 1),
        "lowest_quiz_score": round(lowest_quiz, 1),
        "quiz_completion_percentage": round(quiz_completion_percentage, 1),
        "coding_challenges_completed": challenges_completed,
        "coding_challenges_attempted": len(challenges),
        "average_coding_score": round(avg_coding_score, 1),
        "highest_coding_score": round(highest_coding_score, 1),
        "coding_success_rate": round(coding_success_rate, 1),
        "coding_improvement_trend": coding_improvement_trend,
        "top_skill_categories": top_skills,
        "recent_activity": recent[:8],
        "performance_level": performance,
        "career_goal": current_user.career_goal,
        "learning_streak_days": min(len(all_progress), 30)
    }


@router.get("/career-recommendation")
async def get_career_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get personalized career recommendations based on real user data, assessments, coding, and quiz performance."""
    # Check user country. If missing, return country_missing flag
    if not current_user.country:
        return {
            "country_missing": True,
            "user_country": None,
            "recommendations": []
        }

    user_country = current_user.country

    # 1. Gather all learning signals for the user
    assessments = db.query(Assessment).filter(
        Assessment.user_id == current_user.id
    ).order_by(Assessment.created_at.desc()).all()
    latest_assessment = assessments[0] if assessments else None

    # Assessment base scores
    prog_score = latest_assessment.programming_score if latest_assessment else 50
    ml_score = latest_assessment.ml_score if latest_assessment else 50
    stats_score = latest_assessment.statistics_score if latest_assessment else 50
    data_eng_score = latest_assessment.data_engineering_score if latest_assessment else 50
    cloud_score = latest_assessment.cloud_score if latest_assessment else 50
    vis_score = latest_assessment.visualization_score if latest_assessment else 50

    # Quizzes
    quizzes = db.query(QuizHistory).filter(QuizHistory.user_id == current_user.id).all()
    completed_quizzes = {q.topic.lower() for q in quizzes if q.percentage and q.percentage >= 70}
    developing_quizzes = {q.topic.lower() for q in quizzes if q.percentage and 40 <= q.percentage < 70}

    # Coding Challenges
    challenges = db.query(CodingChallenge).filter(CodingChallenge.user_id == current_user.id).all()
    completed_challenges = {c.topic.lower() for c in challenges if c.is_completed and c.score and c.score >= 70}
    developing_challenges = {c.topic.lower() for c in challenges if c.is_completed and c.score and 40 <= c.score < 70}

    # Course Progress
    progress_records = db.query(Progress).filter(Progress.user_id == current_user.id).all()
    completed_cids = [p.course_id for p in progress_records if p.completion_status == "Completed"]
    in_progress_cids = [p.course_id for p in progress_records if p.completion_status == "In Progress"]

    completed_courses = db.query(Course).filter(Course.id.in_(completed_cids)).all() if completed_cids else []
    in_progress_courses = db.query(Course).filter(Course.id.in_(in_progress_cids)).all() if in_progress_cids else []

    # Map categories
    completed_categories = {c.category.lower() for c in completed_courses}
    in_progress_categories = {c.category.lower() for c in in_progress_courses}

    # 2. Build detailed user skills profile
    strong_skills = set()
    developing_skills = set()

    # Base assessment categories mapping
    if prog_score >= 70: strong_skills.add("programming")
    elif prog_score >= 40: developing_skills.add("programming")

    if ml_score >= 70: strong_skills.add("machine learning")
    elif ml_score >= 40: developing_skills.add("machine learning")

    if stats_score >= 70: strong_skills.add("statistics")
    elif stats_score >= 40: developing_skills.add("statistics")

    if data_eng_score >= 70: strong_skills.add("data engineering")
    elif data_eng_score >= 40: developing_skills.add("data engineering")

    if cloud_score >= 70: strong_skills.add("cloud")
    elif cloud_score >= 40: developing_skills.add("cloud")

    if vis_score >= 70: strong_skills.add("visualization")
    elif vis_score >= 40: developing_skills.add("visualization")

    # Quizzes and coding topics normalization
    for topic in (completed_quizzes | completed_challenges):
        if "python" in topic or "programming" in topic:
            strong_skills.add("python")
            strong_skills.add("programming")
        if "sql" in topic or "database" in topic or "join" in topic:
            strong_skills.add("sql")
        if "pandas" in topic or "numpy" in topic or "data manipulation" in topic:
            strong_skills.add("pandas")
            strong_skills.add("data manipulation")
        if "machine learning" in topic or "ml" in topic:
            strong_skills.add("machine learning")
        if "deep learning" in topic:
            strong_skills.add("deep learning")
        if "statistics" in topic:
            strong_skills.add("statistics")
        if "visualization" in topic or "matplotlib" in topic or "power bi" in topic:
            strong_skills.add("visualization")

    for topic in (developing_quizzes | developing_challenges):
        if "python" in topic or "programming" in topic:
            developing_skills.add("python")
            developing_skills.add("programming")
        if "sql" in topic or "database" in topic or "join" in topic:
            developing_skills.add("sql")
        if "pandas" in topic or "numpy" in topic or "data manipulation" in topic:
            developing_skills.add("pandas")
            developing_skills.add("data manipulation")
        if "machine learning" in topic or "ml" in topic:
            developing_skills.add("machine learning")
        if "deep learning" in topic:
            developing_skills.add("deep learning")
        if "statistics" in topic:
            developing_skills.add("statistics")
        if "visualization" in topic or "matplotlib" in topic or "power bi" in topic:
            developing_skills.add("visualization")

    # Enrolled categories
    for cat in completed_categories:
        strong_skills.add(cat.strip().lower())
    for cat in in_progress_categories:
        developing_skills.add(cat.strip().lower())

    # Ensure python and programming map to each other for convenience
    if "python" in strong_skills: strong_skills.add("programming")
    if "programming" in strong_skills: strong_skills.add("python")

    # 3. Define target careers
    careers = [
        {
            "career_name": "Data Scientist",
            "required_skills": ["Python", "SQL", "Machine Learning", "Statistics", "Visualization"],
            "base_salary_usd": 125000,
            "job_growth": "15%",
            "description": "Analyze complex data to provide actionable insights and build predictive models."
        },
        {
            "career_name": "ML Engineer",
            "required_skills": ["Python", "Machine Learning", "Deep Learning", "DevOps"],
            "base_salary_usd": 145000,
            "job_growth": "22%",
            "description": "Design and deploy machine learning models at scale in production environments."
        },
        {
            "career_name": "Data Engineer",
            "required_skills": ["Python", "SQL", "Cloud", "Data Engineering", "Databases"],
            "base_salary_usd": 130000,
            "job_growth": "18%",
            "description": "Build and maintain data pipelines and infrastructure for analytics."
        },
        {
            "career_name": "AI Engineer",
            "required_skills": ["Python", "Machine Learning", "Deep Learning", "NLP", "Computer Vision"],
            "base_salary_usd": 150000,
            "job_growth": "25%",
            "description": "Build advanced AI systems including LLMs, computer vision, and NLP."
        },
        {
            "career_name": "Data Analyst",
            "required_skills": ["SQL", "Python", "Pandas", "Statistics", "Visualization"],
            "base_salary_usd": 75000,
            "job_growth": "12%",
            "description": "Transform data into insights through analysis and visualization."
        }
    ]

    from app.services.currency import convert_usd_salary
    from app.services.ai_tutor import get_ai_response
    from app.models import Job

    results = []
    for career in careers:
        # Match user skills to career requirements
        req_clean = [s.strip().lower() for s in career["required_skills"]]
        present = []
        developing = []
        missing = []

        for sk in req_clean:
            # Map clean skill name back to capitalized display name
            display_name = sk.capitalize()
            if sk == "sql": display_name = "SQL"
            elif sk == "nlp": display_name = "NLP"
            elif sk == "ml": display_name = "ML"

            if sk in strong_skills:
                present.append(display_name)
            elif sk in developing_skills:
                developing.append(display_name)
            else:
                missing.append(display_name)

        # Match scores: achieved = 100% weight, developing = 50% weight
        achieved_count = len(present)
        developing_count = len(developing)
        total_req = len(req_clean)
        
        readiness_pct = round(((achieved_count * 1.0 + developing_count * 0.5) / total_req) * 100)
        
        # Apply deterministic performance modification
        performance_mod = 0.0
        if quizzes:
            avg_q = sum(q.percentage or 0 for q in quizzes) / len(quizzes)
            performance_mod += (avg_q - 70.0) * 0.1 # quiz modifier
        if challenges:
            completed_ch = [c for c in challenges if c.is_completed and c.score]
            if completed_ch:
                avg_c = sum(c.score for c in completed_ch) / len(completed_ch)
                performance_mod += (avg_c - 70.0) * 0.1 # coding modifier

        match_score = min(max(round(readiness_pct + performance_mod), 10), 100)

        # 4. Local Salary ranges queried from dataset and converted
        job_matches = db.query(Job).filter(Job.job_title.ilike(f"%{career['career_name']}%")).all()
        if job_matches:
            avg_min = sum(j.salary_min or 0 for j in job_matches if j.salary_min) / len(job_matches)
            avg_max = sum(j.salary_max or 0 for j in job_matches if j.salary_max) / len(job_matches)
            salary_min_usd = avg_min or (career["base_salary_usd"] * 0.8)
            salary_max_usd = avg_max or (career["base_salary_usd"] * 1.2)
        else:
            salary_min_usd = career["base_salary_usd"] * 0.8
            salary_max_usd = career["base_salary_usd"] * 1.2

        conv_min = convert_usd_salary(salary_min_usd, user_country)
        conv_max = convert_usd_salary(salary_max_usd, user_country)

        local_salary_range = f"{conv_min['symbol']}{conv_min['value']:,} – {conv_max['symbol']}{conv_max['value']:,}"

        # 5. Roadmap Steps Creation
        roadmap_steps = []
        step_idx = 1

        # Completed items
        for pr in present:
            roadmap_steps.append({
                "step": f"Step {step_idx}",
                "title": f"Achieved: {pr}",
                "description": f"You have already mastered {pr} through assessments, challenges, or quizzes.",
                "status": "Completed"
            })
            step_idx += 1

        # Developing items
        for dv in developing:
            roadmap_steps.append({
                "step": f"Step {step_idx}",
                "title": f"Reinforce: {dv}",
                "description": f"You have basic exposure to {dv}. Practice more quizzes and coding modules.",
                "status": "In Progress"
            })
            step_idx += 1

        # Missing items
        for ms in missing:
            roadmap_steps.append({
                "step": f"Step {step_idx}",
                "title": f"Bridge Skill Gap: {ms}",
                "description": f"Learn core fundamentals of {ms}. Complete recommended courses and review tasks.",
                "status": "Pending"
            })
            step_idx += 1

        # Final milestones
        roadmap_steps.append({
            "step": f"Step {step_idx}",
            "title": "Complete Capstone Portfolio Project",
            "description": f"Apply {career['career_name']} skills to resolve a complete case study.",
            "status": "Pending"
        })
        step_idx += 1

        roadmap_steps.append({
            "step": f"Step {step_idx}",
            "title": "Get Certified",
            "description": "Upload a valid completion certificate for AI verification.",
            "status": "Pending"
        })

        # Recommended next actions
        next_actions = []
        if developing:
            next_actions.append(f"Improve your developing skill '{developing[0]}' by completing a practice quiz.")
        if missing:
            next_actions.append(f"Bridge the skill gap in '{missing[0]}' by enrolling in recommended courses.")
        next_actions.append("Practice coding challenges to strengthen your portfolio.")

        # 6. AI Explanation Generator
        explanation = f"{career['career_name']} matches your profile because of your skill alignment."
        try:
            strong_skills_str = ", ".join(present) if present else "None yet"
            developing_skills_str = ", ".join(developing) if developing else "None yet"
            missing_skills_str = ", ".join(missing) if missing else "None yet"

            prompt = f"""
            Write a professional, encouraging career match justification (exactly 2 sentences) for:
            Career: {career['career_name']}
            User Country: {user_country}
            User Achieved Skills: {strong_skills_str}
            User Developing Skills: {developing_skills_str}
            User Gaps: {missing_skills_str}
            Match Score: {match_score}%
            Readiness: {readiness_pct}%
            
            Do NOT mention any scores, numbers, or details not provided here. Keep it strictly focused on encouraging progress.
            """
            ai_exp = await get_ai_response(
                [{"role": "user", "content": prompt}],
                system="You are a career counselor helper. Be concise, professional, and encouraging."
            )
            explanation = ai_exp.strip()
        except Exception as e:
            print(f"[CAREER AI] Error: {e}")

        # Fetch actual courses to recommend
        # Match categories for this career
        category_match = "Machine Learning"
        if "sql" in req_clean: category_match = "SQL"
        elif "data engineering" in req_clean: category_match = "Data Engineering"
        elif "visualization" in req_clean: category_match = "Visualization"

        rec_courses = db.query(Course).filter(
            Course.category == category_match
        ).order_by(Course.rating.desc()).limit(3).all()
        if not rec_courses:
            rec_courses = db.query(Course).order_by(Course.rating.desc()).limit(3).all()

        results.append({
            "career_name": career["career_name"],
            "match_score": match_score,
            "readiness_percent": readiness_pct,
            "required_skills": career["required_skills"],
            "current_skills": present + developing,
            "skill_gaps": missing,
            "strong_skills": present,
            "developing_skills": developing,
            "average_salary_usd": career["base_salary_usd"],
            "local_salary_range": local_salary_range,
            "salary_currency": conv_min["currency_code"],
            "salary_symbol": conv_min["symbol"],
            "job_growth": career["job_growth"],
            "description": career["description"],
            "explanation": explanation,
            "roadmap": roadmap_steps,
            "next_actions": next_actions,
            "recommended_courses": [CourseResponse.from_orm(c).dict() for c in rec_courses]
        })

    # Sort by match score
    results.sort(key=lambda x: x["match_score"], reverse=True)

    return {
        "country_missing": False,
        "user_country": user_country,
        "recommendations": results
    }
