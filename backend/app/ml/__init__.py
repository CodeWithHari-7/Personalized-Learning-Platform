"""
ML Model Service - loads trained models and provides prediction functions
"""
import os
import json
import numpy as np
import pandas as pd
import joblib
from typing import Optional, List, Dict, Any
from app.config import get_settings

settings = get_settings()

_model_bundle = None
_preprocessor = None
_skill_gap_data = None
_eda_report = None


def _load_models():
    global _model_bundle, _preprocessor, _skill_gap_data, _eda_report
    if _model_bundle is not None:
        return

    model_dir = settings.ML_MODEL_DIR
    model_path = os.path.join(model_dir, 'model.pkl')
    preprocessor_path = os.path.join(model_dir, 'preprocessor.pkl')
    skill_gap_path = os.path.join(model_dir, 'skill_gap_data.json')
    eda_path = os.path.join(model_dir, 'eda_report.json')

    if os.path.exists(model_path):
        _model_bundle = joblib.load(model_path)
    else:
        print(f"[WARNING] model.pkl not found at {model_path}. Using fallback predictions.")
        _model_bundle = None

    if os.path.exists(preprocessor_path):
        _preprocessor = joblib.load(preprocessor_path)
    
    if os.path.exists(skill_gap_path):
        with open(skill_gap_path, 'r') as f:
            _skill_gap_data = json.load(f)
    
    if os.path.exists(eda_path):
        with open(eda_path, 'r') as f:
            _eda_report = json.load(f)


def get_performance_prediction(
    cgpa: float,
    avg_score: float,
    completion_rate: float,
    num_skills: int,
    semester: int = 4,
    age: int = 22,
    num_courses_enrolled: int = 5,
    avg_proficiency: float = 2.0,
    **kwargs
) -> str:
    """Predict student performance level: High / Medium / Low"""
    _load_models()
    
    # Rule-based fallback (also used when model not available)
    # Combine weighted score
    composite = (avg_score * 0.5) + (cgpa * 5 * 0.3) + (completion_rate * 100 * 0.2)
    
    if _model_bundle is None or _preprocessor is None:
        if composite >= 80:
            return "High"
        elif composite >= 60:
            return "Medium"
        else:
            return "Low"
    
    try:
        # Build feature vector matching training schema
        dept_choices = ['Computer Science', 'Data Science', 'Information Technology',
                        'Statistics', 'Business Analytics', 'Electrical Engineering']
        country_choices = ['India', 'USA', 'Canada', 'Germany', 'Australia', 'UK', 'Singapore']
        
        row = {
            'age_scaled': (age - 18) / 10.0,
            'semester_scaled': (semester - 1) / 7.0,
            'cgpa_scaled': (cgpa - 5.0) / 5.0,
            'num_courses_enrolled_scaled': num_courses_enrolled / 20.0,
            'num_completed_scaled': num_courses_enrolled * completion_rate / 20.0,
            'completion_rate_scaled': completion_rate,
            'avg_score_scaled': avg_score / 100.0,
            'avg_progress_scaled': avg_score / 100.0,
            'num_certificates_scaled': 0.1,
            'num_skills_scaled': num_skills / 8.0,
            'avg_assessment_score_scaled': avg_score / 100.0,
            'avg_proficiency_scaled': avg_proficiency / 4.0,
            'total_projects_scaled': 0.2,
            'total_certifications_scaled': 0.1,
            'total_time_spent_scaled': 100.0 / 1000.0,
            'gender_enc': 0,
            'country_enc': 0,
            'department_enc': 0,
            'top_skill_category_enc': 0,
            'last_course_category_enc': 0,
            'last_course_level_enc': 1,
        }
        
        X_columns = _preprocessor.get('X_columns', list(row.keys()))
        feature_vector = [row.get(col, 0.0) for col in X_columns]
        X = np.array(feature_vector).reshape(1, -1)
        
        model = _model_bundle.get('performance_model')
        if model:
            pred = model.predict(X)[0]
            le = _preprocessor['encoders']['performance_label']
            return le.inverse_transform([pred])[0]
    except Exception as e:
        print(f"[ML] Prediction error: {e}, using rule-based fallback")
    
    # Rule-based fallback
    if composite >= 80:
        return "High"
    elif composite >= 60:
        return "Medium"
    return "Low"


def get_course_recommendations(
    career_goal: str,
    skill_categories: List[str],
    preferred_level: Optional[str],
    courses_df: Optional[Any] = None,
    num_recs: int = 8
) -> List[Dict]:
    """
    Content-based recommendation using career goal and skill categories.
    Returns list of course_ids sorted by recommendation score.
    """
    _load_models()
    
    # Career goal to category mapping
    career_category_map = {
        'Data Scientist': ['Machine Learning', 'Statistics', 'Programming', 'Visualization', 'SQL'],
        'ML Engineer': ['Machine Learning', 'Deep Learning', 'DevOps', 'AI', 'Programming'],
        'Data Engineer': ['Data Engineering', 'SQL', 'Cloud', 'Databases', 'Programming'],
        'AI Engineer': ['Deep Learning', 'NLP', 'Computer Vision', 'AI', 'Programming'],
        'Data Analyst': ['SQL', 'Business Intelligence', 'Visualization', 'Statistics', 'Analytics'],
        'BI Developer': ['Business Intelligence', 'SQL', 'Visualization', 'Databases', 'Analytics'],
        'Business Analyst': ['Analytics', 'Business Intelligence', 'Soft Skills', 'SQL'],
        'Research Scientist': ['Mathematics', 'Statistics', 'Deep Learning', 'Machine Learning'],
        'MLOps Engineer': ['DevOps', 'Machine Learning', 'Cloud', 'Data Engineering'],
        'Cloud Data Engineer': ['Cloud', 'Data Engineering', 'SQL', 'DevOps'],
    }
    
    target_categories = career_category_map.get(
        career_goal, skill_categories or ['Machine Learning', 'Programming', 'SQL']
    )
    
    return {
        'target_categories': target_categories,
        'preferred_level': preferred_level,
        'num_recs': num_recs
    }


def analyze_skill_gap(
    career_goal: str,
    current_skill_names: List[str],
    assessment_scores: Dict[str, int]
) -> Dict:
    """Analyze skill gaps for a career goal"""
    _load_models()
    
    career_skill_map = {
        'Data Scientist': ['Python', 'SQL', 'Machine Learning', 'Statistics', 'Visualization',
                           'Feature Engineering', 'Hypothesis Testing', 'Matplotlib'],
        'ML Engineer': ['Python', 'Machine Learning', 'Deep Learning', 'Docker', 'Git',
                        'TensorFlow', 'PyTorch', 'Scikit-Learn'],
        'Data Engineer': ['Python', 'Apache Spark', 'Kafka', 'Airflow', 'ETL Pipelines',
                          'AWS', 'PostgreSQL', 'Snowflake'],
        'AI Engineer': ['Python', 'Deep Learning', 'NLP', 'Computer Vision', 'BERT',
                        'LLMs', 'PyTorch', 'Transformers'],
        'Data Analyst': ['SQL', 'Power BI', 'Tableau', 'Python', 'Statistics',
                         'A/B Testing', 'Matplotlib', 'Seaborn'],
        'Business Analyst': ['SQL', 'Power BI', 'Communication', 'Problem Solving', 'Agile Methodology'],
        'Research Scientist': ['Linear Algebra', 'Calculus', 'Bayesian Inference', 'Neural Networks',
                               'TensorFlow', 'Python'],
        'MLOps Engineer': ['Docker', 'Kubernetes', 'CI/CD', 'Git', 'AWS', 'Machine Learning'],
    }
    
    required_skills = career_skill_map.get(career_goal, ['Python', 'SQL', 'Machine Learning'])
    
    current_set = set(s.lower() for s in current_skill_names)
    required_set = set(s.lower() for s in required_skills)
    
    missing = [s for s in required_skills if s.lower() not in current_set]
    present = [s for s in required_skills if s.lower() in current_set]
    
    # Skill scores from assessment
    skill_area_scores = {
        'Programming': assessment_scores.get('programming_score', 50),
        'Machine Learning': assessment_scores.get('ml_score', 50),
        'Statistics': assessment_scores.get('statistics_score', 50),
        'Data Engineering': assessment_scores.get('data_engineering_score', 50),
        'Cloud': assessment_scores.get('cloud_score', 50),
        'Visualization': assessment_scores.get('visualization_score', 50),
        'Soft Skills': assessment_scores.get('soft_skills_score', 50),
    }
    
    readiness = (len(present) / max(len(required_skills), 1)) * 100
    
    return {
        'career_goal': career_goal,
        'required_skills': required_skills,
        'missing_skills': missing,
        'present_skills': present,
        'skill_area_scores': skill_area_scores,
        'readiness_percent': round(readiness, 1)
    }


def get_eda_report() -> Dict:
    _load_models()
    return _eda_report or {}
