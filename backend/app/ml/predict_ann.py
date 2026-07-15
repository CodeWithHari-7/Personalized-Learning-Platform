"""
Inference helper for the PyTorch Student Performance ANN
"""
import os
import torch
import torch.nn as nn
import numpy as np
import joblib

# Re-define the exact model structure
class StudentPerformanceANN(nn.Module):
    def __init__(self, input_dim, output_dim):
        super(StudentPerformanceANN, self).__init__()
        self.fc1 = nn.Linear(input_dim, 64)
        self.relu1 = nn.ReLU()
        self.dropout1 = nn.Dropout(0.2)
        self.fc2 = nn.Linear(64, 32)
        self.relu2 = nn.ReLU()
        self.dropout2 = nn.Dropout(0.2)
        self.fc3 = nn.Linear(32, output_dim)
        
    def forward(self, x):
        x = self.dropout1(self.relu1(self.fc1(x)))
        x = self.dropout2(self.relu2(self.fc2(x)))
        return self.fc3(x)

# Path settings
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ml_training', 'artifacts')
MODEL_PATH = os.path.join(ARTIFACTS_DIR, 'student_ann.pth')
PREPROCESSOR_PATH = os.path.join(ARTIFACTS_DIR, 'preprocessor.pkl')

def predict_student_performance_ann(feature_dict: dict) -> str:
    """
    Takes raw student features dict, processes them, runs the PyTorch ANN,
    and returns predicted performance category (High/Medium/Low)
    """
    if not os.path.exists(MODEL_PATH) or not os.path.exists(PREPROCESSOR_PATH):
        # Fallback if PyTorch model is not trained yet
        return "Medium"
        
    try:
        # 1. Load Preprocessor and model
        preprocessor = joblib.load(PREPROCESSOR_PATH)
        
        # 2. Extract and format numerical features
        num_features = []
        for col in preprocessor['num_cols']:
            val = feature_dict.get(col, 0.0)
            num_features.append(float(val))
            
        # 3. Scale numerical features
        num_scaled = preprocessor['scaler'].transform([num_features])[0]
        
        # 4. Encode categorical features
        cat_encoded = []
        for col in preprocessor['cat_cols']:
            val = str(feature_dict.get(col, 'Unknown'))
            le = preprocessor['encoders'][col]
            # Handle unseen labels gracefully
            if val not in le.classes_:
                encoded_val = 0
            else:
                encoded_val = le.transform([val])[0]
            cat_encoded.append(encoded_val)
            
        # Combine into a single feature vector
        full_vector = np.concatenate([num_scaled, cat_encoded])
        
        # 5. Load PyTorch model and run prediction
        input_dim = len(full_vector)
        output_dim = 3 # High, Medium, Low
        
        model = StudentPerformanceANN(input_dim, output_dim)
        model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu')))
        model.eval()
        
        # Convert to Tensor
        input_tensor = torch.tensor([full_vector], dtype=torch.float32)
        
        with torch.no_grad():
            outputs = model(input_tensor)
            _, predicted_idx = torch.max(outputs, 1)
            predicted_class_idx = predicted_idx.item()
            
        # Map class index back to label name
        le_perf = preprocessor['encoders']['performance_label']
        predicted_label = le_perf.inverse_transform([predicted_class_idx])[0]
        return predicted_label
        
    except Exception as e:
        print(f"[ANN INFERENCE ERROR] {e}")
        return "Medium"
