"""
Data Preprocessing Pipeline for Personalized Learning Platform
Loads, cleans, merges and engineers features from all 9 CSV datasets
"""
import os
import sys
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.impute import SimpleImputer
import joblib
import json

DATASET_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'datasets')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'artifacts')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_datasets():
    print("Loading datasets...")
    datasets = {}
    files = {
        'students': 'students.csv',
        'courses': 'courses.csv',
        'skills': 'skills.csv',
        'student_courses': 'student_courses.csv',
        'student_skills': 'student_skills.csv',
        'course_skills': 'course_skills.csv',
        'career_paths': 'career_paths.csv',
        'jobs': 'jobs.csv',
        'recommendations': 'recommendations.csv'
    }
    for name, fname in files.items():
        path = os.path.join(DATASET_DIR, fname)
        df = pd.read_csv(path)
        datasets[name] = df
        print(f"  Loaded {name}: {df.shape}")
    return datasets


def clean_datasets(datasets):
    print("\nCleaning datasets...")
    cleaned = {}
    for name, df in datasets.items():
        original_rows = len(df)
        df = df.drop_duplicates()
        df = df.reset_index(drop=True)
        # Fill missing numeric values with median
        num_cols = df.select_dtypes(include=[np.number]).columns
        for col in num_cols:
            df[col] = df[col].fillna(df[col].median())
        # Fill missing string values with 'Unknown'
        str_cols = df.select_dtypes(include=['object']).columns
        for col in str_cols:
            df[col] = df[col].fillna('Unknown')
        removed = original_rows - len(df)
        print(f"  {name}: {original_rows} -> {len(df)} rows (removed {removed} duplicates)")
        cleaned[name] = df
    return cleaned


def engineer_features(datasets):
    print("\nEngineering features...")
    students = datasets['students'].copy()
    courses = datasets['courses'].copy()
    student_courses = datasets['student_courses'].copy()
    student_skills = datasets['student_skills'].copy()
    skills = datasets['skills'].copy()
    recommendations = datasets['recommendations'].copy()

    # ── Student course aggregates ──
    sc_agg = student_courses.groupby('student_id').agg(
        num_courses_enrolled=('course_id', 'count'),
        num_completed=('completion_status', lambda x: (x == 'Completed').sum()),
        num_in_progress=('completion_status', lambda x: (x == 'In Progress').sum()),
        avg_score=('score', 'mean'),
        max_score=('score', 'max'),
        min_score=('score', 'min'),
        total_time_spent=('time_spent_hours', 'sum'),
        avg_progress=('progress', 'mean'),
        num_certificates=('certificate_earned', lambda x: (x == 'Yes').sum())
    ).reset_index()
    sc_agg['completion_rate'] = sc_agg['num_completed'] / sc_agg['num_courses_enrolled'].replace(0, 1)
    sc_agg['avg_score'] = sc_agg['avg_score'].round(2)

    # ── Student skill aggregates ──
    proficiency_map = {'Beginner': 1, 'Intermediate': 2, 'Advanced': 3, 'Expert': 4}
    student_skills['proficiency_num'] = student_skills['proficiency'].map(proficiency_map).fillna(1)
    
    ss_agg = student_skills.groupby('student_id').agg(
        num_skills=('skill_id', 'count'),
        avg_assessment_score=('assessment_score', 'mean'),
        avg_proficiency=('proficiency_num', 'mean'),
        total_projects=('projects_completed', 'sum'),
        total_certifications=('certifications', 'sum')
    ).reset_index()

    # ── Get top skill category per student ──
    student_skills_with_cat = student_skills.merge(skills[['skill_id', 'category']], on='skill_id', how='left')
    top_skill_cat = student_skills_with_cat.groupby('student_id')['category'].agg(
        lambda x: x.value_counts().index[0] if len(x) > 0 else 'Unknown'
    ).reset_index()
    top_skill_cat.columns = ['student_id', 'top_skill_category']

    # ── Merge everything onto students ──
    merged = students.merge(sc_agg, on='student_id', how='left')
    merged = merged.merge(ss_agg, on='student_id', how='left')
    merged = merged.merge(top_skill_cat, on='student_id', how='left')

    # Fill NaN for students without courses/skills
    fill_zeros = ['num_courses_enrolled', 'num_completed', 'num_in_progress',
                  'avg_score', 'max_score', 'min_score', 'total_time_spent',
                  'avg_progress', 'num_certificates', 'completion_rate',
                  'num_skills', 'avg_assessment_score', 'avg_proficiency',
                  'total_projects', 'total_certifications']
    for col in fill_zeros:
        merged[col] = merged[col].fillna(0)
    merged['top_skill_category'] = merged['top_skill_category'].fillna('Unknown')

    # ── Build course feature matrix ──
    # Map course category from student's last completed course
    last_course = student_courses[student_courses['completion_status'] == 'Completed'].sort_values('enrollment_date')
    last_course = last_course.groupby('student_id').last().reset_index()
    last_course = last_course.merge(courses[['course_id', 'category', 'level']], on='course_id', how='left')
    last_course = last_course.rename(columns={'category': 'last_course_category', 'level': 'last_course_level'})
    last_course = last_course[['student_id', 'last_course_category', 'last_course_level']]

    merged = merged.merge(last_course, on='student_id', how='left')
    merged['last_course_category'] = merged['last_course_category'].fillna('None')
    merged['last_course_level'] = merged['last_course_level'].fillna('Beginner')

    # ── Performance label: High / Medium / Low ──
    def label_performance(score):
        if score >= 80:
            return 'High'
        elif score >= 60:
            return 'Medium'
        else:
            return 'Low'

    merged['performance_label'] = merged['avg_score'].apply(label_performance)

    # ── Recommended next category (from recommendations dataset) ──
    rec_with_cat = recommendations.merge(courses[['course_id', 'category']], on='course_id', how='left')
    top_rec = rec_with_cat.groupby('student_id')['category'].agg(
        lambda x: x.value_counts().index[0] if len(x) > 0 else 'Unknown'
    ).reset_index()
    top_rec.columns = ['student_id', 'recommended_category']
    merged = merged.merge(top_rec, on='student_id', how='left')
    merged['recommended_category'] = merged['recommended_category'].fillna('Machine Learning')

    print(f"  Final merged dataset: {merged.shape}")
    print(f"  Performance distribution:\n{merged['performance_label'].value_counts()}")
    print(f"  Recommended category distribution:\n{merged['recommended_category'].value_counts().head()}")

    return merged, courses, skills


def encode_and_scale(df):
    print("\nEncoding and scaling features...")
    
    feature_cols = [
        'age', 'semester', 'cgpa',
        'num_courses_enrolled', 'num_completed', 'completion_rate',
        'avg_score', 'avg_progress', 'num_certificates',
        'num_skills', 'avg_assessment_score', 'avg_proficiency',
        'total_projects', 'total_certifications', 'total_time_spent',
        'gender', 'country', 'department',
        'top_skill_category', 'last_course_category', 'last_course_level'
    ]
    
    cat_cols = ['gender', 'country', 'department', 'top_skill_category',
                'last_course_category', 'last_course_level']
    num_cols = [c for c in feature_cols if c not in cat_cols]
    
    encoders = {}
    for col in cat_cols:
        le = LabelEncoder()
        df[f'{col}_enc'] = le.fit_transform(df[col].astype(str))
        encoders[col] = le
    
    scaler = StandardScaler()
    df_num = df[num_cols].copy()
    df_num_scaled = scaler.fit_transform(df_num)
    df_num_scaled = pd.DataFrame(df_num_scaled, columns=[f'{c}_scaled' for c in num_cols])
    
    enc_cols = [f'{c}_enc' for c in cat_cols]
    scaled_cols = [f'{c}_scaled' for c in num_cols]
    X = pd.concat([df_num_scaled.reset_index(drop=True), df[enc_cols].reset_index(drop=True)], axis=1)
    
    # Encode targets
    le_perf = LabelEncoder()
    le_rec = LabelEncoder()
    y_performance = le_perf.fit_transform(df['performance_label'])
    y_recommendation = le_rec.fit_transform(df['recommended_category'])
    
    encoders['performance_label'] = le_perf
    encoders['recommended_category'] = le_rec
    
    # Save preprocessor artifacts
    preprocessor = {
        'encoders': encoders,
        'scaler': scaler,
        'feature_cols': feature_cols,
        'cat_cols': cat_cols,
        'num_cols': num_cols,
        'X_columns': list(X.columns)
    }
    joblib.dump(preprocessor, os.path.join(OUTPUT_DIR, 'preprocessor.pkl'))
    print(f"  Feature matrix shape: {X.shape}")
    print(f"  Preprocessor saved to artifacts/preprocessor.pkl")
    
    return X, y_performance, y_recommendation, preprocessor


def run_eda(df):
    """Quick EDA summary"""
    print("\n=== EDA Summary ===")
    print(f"Total students: {len(df)}")
    print(f"Avg CGPA: {df['cgpa'].mean():.2f}")
    print(f"Avg courses enrolled: {df['num_courses_enrolled'].mean():.1f}")
    print(f"Avg completion rate: {df['completion_rate'].mean():.2%}")
    print(f"Avg score: {df['avg_score'].mean():.1f}")
    print(f"Avg skills: {df['num_skills'].mean():.1f}")
    print(f"\nTop 5 departments:\n{df['department'].value_counts().head()}")
    print(f"\nTop 5 countries:\n{df['country'].value_counts().head()}")
    
    # Save EDA report
    eda_report = {
        'total_students': int(len(df)),
        'avg_cgpa': float(df['cgpa'].mean()),
        'avg_courses_enrolled': float(df['num_courses_enrolled'].mean()),
        'avg_completion_rate': float(df['completion_rate'].mean()),
        'avg_score': float(df['avg_score'].mean()),
        'avg_skills': float(df['num_skills'].mean()),
        'performance_distribution': df['performance_label'].value_counts().to_dict(),
        'top_departments': df['department'].value_counts().head(10).to_dict(),
        'top_countries': df['country'].value_counts().head(10).to_dict(),
        'top_skill_categories': df['top_skill_category'].value_counts().head(10).to_dict(),
        'recommended_category_distribution': df['recommended_category'].value_counts().head(10).to_dict()
    }
    with open(os.path.join(OUTPUT_DIR, 'eda_report.json'), 'w') as f:
        json.dump(eda_report, f, indent=2)
    print("\n  EDA report saved to artifacts/eda_report.json")
    return eda_report


def main():
    print("=" * 60)
    print("PREPROCESSING PIPELINE - Personalized Learning Platform")
    print("=" * 60)
    datasets = load_datasets()
    datasets = clean_datasets(datasets)
    merged_df, courses, skills = engineer_features(datasets)
    eda_report = run_eda(merged_df)
    X, y_perf, y_rec, preprocessor = encode_and_scale(merged_df)
    
    # Save processed data for training
    merged_df.to_parquet(os.path.join(OUTPUT_DIR, 'processed_students.parquet'), index=False)
    courses.to_parquet(os.path.join(OUTPUT_DIR, 'processed_courses.parquet'), index=False)
    skills.to_parquet(os.path.join(OUTPUT_DIR, 'processed_skills.parquet'), index=False)
    
    print("\n[OK] Preprocessing complete!")
    print(f"   Processed data saved to {OUTPUT_DIR}")
    return X, y_perf, y_rec, preprocessor, merged_df


if __name__ == '__main__':
    main()
