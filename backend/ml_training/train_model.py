"""
ML Model Training Pipeline - Random Forest for Personalized Learning Platform
Trains models for:
  1. Course Recommendation (predict recommended_category)
  2. Performance Prediction (predict performance_label: High/Medium/Low)
  3. Skill Gap Analysis (identify weak skill categories)
"""
import os
import sys
import warnings
warnings.filterwarnings('ignore')

import json
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_score
from sklearn.metrics import (accuracy_score, precision_score, recall_score, f1_score,
                              confusion_matrix, classification_report)
from sklearn.preprocessing import LabelEncoder

# Add parent to path
sys.path.insert(0, os.path.dirname(__file__))
from preprocess import main as preprocess_main

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'artifacts')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def train_and_evaluate(X, y, model_name, label_names, param_grid=None):
    """Train Random Forest with optional hyperparameter tuning and evaluation"""
    print(f"\n{'='*60}")
    print(f"Training: {model_name}")
    print(f"{'='*60}")
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"  Train: {X_train.shape}, Test: {X_test.shape}")
    
    # Base Random Forest
    rf = RandomForestClassifier(random_state=42, n_jobs=-1)
    
    if param_grid:
        print("  Tuning hyperparameters with GridSearchCV (3-fold)...")
        gs = GridSearchCV(rf, param_grid, cv=3, scoring='f1_weighted', n_jobs=-1, verbose=0)
        gs.fit(X_train, y_train)
        best_rf = gs.best_estimator_
        print(f"  Best params: {gs.best_params_}")
    else:
        print("  Training with default params...")
        best_rf = RandomForestClassifier(
            n_estimators=200, max_depth=15, min_samples_split=5,
            min_samples_leaf=2, random_state=42, n_jobs=-1
        )
        best_rf.fit(X_train, y_train)
    
    y_pred = best_rf.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, average='weighted', zero_division=0)
    rec = recall_score(y_test, y_pred, average='weighted', zero_division=0)
    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
    
    print(f"\n  Results:")
    print(f"    Accuracy:  {acc:.4f}")
    print(f"    Precision: {prec:.4f}")
    print(f"    Recall:    {rec:.4f}")
    print(f"    F1 Score:  {f1:.4f}")
    
    # Cross-validation
    cv_scores = cross_val_score(best_rf, X_train, y_train, cv=5, scoring='f1_weighted', n_jobs=-1)
    print(f"    CV F1 (5-fold): {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    
    # Confusion Matrix plot
    cm = confusion_matrix(y_test, y_pred)
    fig, ax = plt.subplots(figsize=(max(6, len(label_names)), max(5, len(label_names)-1)))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=label_names, yticklabels=label_names, ax=ax)
    ax.set_title(f'{model_name} - Confusion Matrix')
    ax.set_ylabel('True Label')
    ax.set_xlabel('Predicted Label')
    plt.tight_layout()
    safe_name = model_name.lower().replace(' ', '_')
    cm_path = os.path.join(OUTPUT_DIR, f'{safe_name}_confusion_matrix.png')
    plt.savefig(cm_path, dpi=100, bbox_inches='tight')
    plt.close()
    print(f"    Confusion matrix saved: {cm_path}")
    
    # Feature importance (top 20)
    feat_imp = pd.Series(best_rf.feature_importances_, index=X.columns)
    top20 = feat_imp.nlargest(20)
    fig, ax = plt.subplots(figsize=(10, 7))
    top20.sort_values().plot(kind='barh', ax=ax, color='steelblue')
    ax.set_title(f'{model_name} - Feature Importance (Top 20)')
    ax.set_xlabel('Importance')
    plt.tight_layout()
    fi_path = os.path.join(OUTPUT_DIR, f'{safe_name}_feature_importance.png')
    plt.savefig(fi_path, dpi=100, bbox_inches='tight')
    plt.close()
    print(f"    Feature importance plot saved: {fi_path}")
    
    metrics = {
        'model_name': model_name,
        'accuracy': float(acc),
        'precision': float(prec),
        'recall': float(rec),
        'f1_score': float(f1),
        'cv_f1_mean': float(cv_scores.mean()),
        'cv_f1_std': float(cv_scores.std()),
        'feature_importance': top20.to_dict(),
        'classification_report': classification_report(y_test, y_pred, target_names=label_names, output_dict=True)
    }
    
    return best_rf, metrics


def compare_with_gbm(X_train, X_test, y_train, y_test, rf_metrics, model_name):
    """Compare Random Forest vs Gradient Boosting"""
    print(f"\n  Comparing with Gradient Boosting...")
    gbm = GradientBoostingClassifier(n_estimators=100, max_depth=6, random_state=42)
    gbm.fit(X_train, y_train)
    y_pred_gbm = gbm.predict(X_test)
    gbm_f1 = f1_score(y_test, y_pred_gbm, average='weighted', zero_division=0)
    rf_f1 = rf_metrics['f1_score']
    
    comparison = {
        'random_forest_f1': rf_f1,
        'gradient_boosting_f1': float(gbm_f1),
        'winner': 'Random Forest' if rf_f1 >= gbm_f1 else 'Gradient Boosting',
        'difference': float(abs(rf_f1 - gbm_f1))
    }
    print(f"    RF F1: {rf_f1:.4f}, GBM F1: {gbm_f1:.4f}, Winner: {comparison['winner']}")
    return comparison


def build_combined_model(models_dict):
    """Bundle all models + preprocessor into a single artifact"""
    combined = {
        'performance_model': models_dict['performance']['model'],
        'recommendation_model': models_dict['recommendation']['model'],
        'preprocessor': models_dict['preprocessor'],
        'version': '1.0.0',
        'description': 'Personalized Learning Platform ML Models'
    }
    return combined


def main():
    print("=" * 60)
    print("ML TRAINING PIPELINE - Personalized Learning Platform")
    print("=" * 60)
    
    # Run preprocessing
    X, y_perf, y_rec, preprocessor, merged_df = preprocess_main()
    
    # ── 1. Performance Prediction Model ──
    le_perf = preprocessor['encoders']['performance_label']
    perf_labels = list(le_perf.classes_)
    
    perf_param_grid = {
        'n_estimators': [100, 200],
        'max_depth': [10, 15, None],
        'min_samples_split': [2, 5]
    }
    
    rf_perf, perf_metrics = train_and_evaluate(
        X, y_perf, 'Performance Prediction', perf_labels, perf_param_grid
    )
    
    # ── 2. Course Recommendation Model ──
    le_rec = preprocessor['encoders']['recommended_category']
    rec_labels = list(le_rec.classes_)
    
    rec_param_grid = {
        'n_estimators': [100, 200],
        'max_depth': [10, 20],
        'min_samples_split': [2, 5]
    }
    
    rf_rec, rec_metrics = train_and_evaluate(
        X, y_rec, 'Course Recommendation', rec_labels, rec_param_grid
    )
    
    # ── 3. Skill Gap Analysis (rule-based + model) ──
    print("\n" + "=" * 60)
    print("Skill Gap Analysis")
    print("=" * 60)
    
    # Build skill gap reference data from the processed dataset
    skill_categories = [
        'Programming', 'SQL', 'Machine Learning', 'Deep Learning',
        'Computer Vision', 'NLP', 'Statistics', 'Mathematics',
        'Business Intelligence', 'Visualization', 'Cloud', 'Databases',
        'DevOps', 'Data Engineering', 'Soft Skills', 'AI', 'Analytics'
    ]
    
    # Skill gap is determined by: high-salary career required skills minus student's current skills
    career_skill_map = {
        'Data Scientist': ['Python', 'SQL', 'Machine Learning', 'Statistics', 'Visualization'],
        'ML Engineer': ['Python', 'Machine Learning', 'Deep Learning', 'DevOps', 'AI'],
        'Data Engineer': ['Python', 'SQL', 'Data Engineering', 'Cloud', 'Databases'],
        'AI Engineer': ['Python', 'Deep Learning', 'NLP', 'Computer Vision', 'AI'],
        'Data Analyst': ['SQL', 'Business Intelligence', 'Visualization', 'Python', 'Statistics'],
    }
    
    skill_gap_data = {
        'skill_categories': skill_categories,
        'career_skill_map': career_skill_map,
        'description': 'Skill gap analysis is computed dynamically per user assessment'
    }
    
    with open(os.path.join(OUTPUT_DIR, 'skill_gap_data.json'), 'w') as f:
        json.dump(skill_gap_data, f, indent=2)
    print("  Skill gap reference data saved to artifacts/skill_gap_data.json")
    
    # ── Save Models ──
    print("\n" + "=" * 60)
    print("Saving Models")
    print("=" * 60)
    
    models_bundle = {
        'performance_model': rf_perf,
        'recommendation_model': rf_rec,
        'preprocessor': preprocessor,
        'version': '1.0.0',
        'description': 'Personalized Learning Platform ML Models'
    }
    
    model_path = os.path.join(OUTPUT_DIR, 'model.pkl')
    preprocessor_path = os.path.join(OUTPUT_DIR, 'preprocessor.pkl')
    
    joblib.dump(models_bundle, model_path)
    joblib.dump(preprocessor, preprocessor_path)
    
    print(f"  [SAVED] model.pkl: {model_path}")
    print(f"  [SAVED] preprocessor.pkl: {preprocessor_path}")
    
    # ── Save Full Report ──
    all_metrics = {
        'performance_prediction': perf_metrics,
        'course_recommendation': rec_metrics,
        'models_saved': ['model.pkl', 'preprocessor.pkl'],
        'deployment_model': 'Random Forest (both tasks)'
    }
    
    with open(os.path.join(OUTPUT_DIR, 'model_report.json'), 'w') as f:
        json.dump(all_metrics, f, indent=2, default=str)
    
    print("[SUMMARY] Final Summary:")
    print(f"   Performance Model  - F1: {perf_metrics['f1_score']:.4f}")
    print(f"   Recommendation     - F1: {rec_metrics['f1_score']:.4f}")
    print(f"\n[DONE] Training complete! All artifacts saved to {OUTPUT_DIR}")
    
    return models_bundle


if __name__ == '__main__':
    main()
