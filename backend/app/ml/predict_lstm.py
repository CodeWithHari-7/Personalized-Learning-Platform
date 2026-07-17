"""
Inference helper for the PyTorch Course Sequence LSTM
"""
import os
import json
import torch
import torch.nn as nn
import numpy as np

# Re-define the exact model structure
class CourseSequenceLSTM(nn.Module):
    def __init__(self, vocab_size, embedding_dim, hidden_dim, output_dim):
        super(CourseSequenceLSTM, self).__init__()
        self.embedding = nn.Embedding(vocab_size, embedding_dim)
        self.lstm = nn.LSTM(embedding_dim, hidden_dim, batch_first=True, num_layers=1)
        self.fc = nn.Linear(hidden_dim, output_dim)
        
    def forward(self, x):
        embeds = self.embedding(x)
        lstm_out, (h_n, c_n) = self.lstm(embeds)
        last_time_step_out = lstm_out[:, -1, :]
        logits = self.fc(last_time_step_out)
        return logits

# Path settings
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'ml_training', 'artifacts')
MODEL_PATH = os.path.join(ARTIFACTS_DIR, 'course_lstm.pth')
CATEGORIES_PATH = os.path.join(ARTIFACTS_DIR, 'lstm_categories.json')

def predict_next_course_category_lstm(past_categories: list) -> str:
    """
    Takes a list of category strings the student took chronologically,
    runs the PyTorch LSTM model, and predicts the next category string.
    """
    if not os.path.exists(MODEL_PATH) or not os.path.exists(CATEGORIES_PATH):
        # Fallback if LSTM model is not trained yet
        return "Machine Learning"
        
    try:
        # 1. Load Categories Map
        with open(CATEGORIES_PATH, 'r') as f:
            mapping = json.load(f)
        category_to_idx = mapping['category_to_idx']
        idx_to_category = mapping['idx_to_category']
        
        # 2. Convert categories list to integer tokens
        cat_indices = []
        for cat in past_categories:
            if cat in category_to_idx:
                cat_indices.append(category_to_idx[cat])
            else:
                cat_indices.append(category_to_idx['Unknown'])
                
        if not cat_indices:
            return "Machine Learning"
            
        # 3. Pad/slice sequence to max_seq_len (5)
        max_seq_len = 5
        pad_token_idx = category_to_idx['<PAD>']
        
        if len(cat_indices) < max_seq_len:
            padded_seq = [pad_token_idx] * (max_seq_len - len(cat_indices)) + cat_indices
        else:
            padded_seq = cat_indices[-max_seq_len:]
            
        # 4. Load PyTorch model
        vocab_size = len(category_to_idx)
        embedding_dim = 32
        hidden_dim = 64
        output_dim = vocab_size
        
        model = CourseSequenceLSTM(vocab_size, embedding_dim, hidden_dim, output_dim)
        model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu')))
        model.eval()
        
        # Convert to Tensor
        input_tensor = torch.tensor([padded_seq], dtype=torch.long)
        
        # 5. Run prediction
        with torch.no_grad():
            outputs = model(input_tensor)
            _, predicted_idx = torch.max(outputs, 1)
            predicted_class_idx = str(predicted_idx.item())
            
        if predicted_class_idx in idx_to_category:
            return idx_to_category[predicted_class_idx]
        return "Machine Learning"
        
    except Exception as e:
        print(f"[LSTM INFERENCE ERROR] {e}")
        return "Machine Learning"
