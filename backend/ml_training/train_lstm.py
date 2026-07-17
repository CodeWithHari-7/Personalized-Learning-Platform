"""
PyTorch LSTM Training Pipeline - Sequential Deep Learning for Course Path Prediction
Given a sequence of course categories a student has previously enrolled in,
predicts the next course category they are likely to take.
"""
import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import pandas as pd
import numpy as np

# Set device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
DATASET_DIR = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'datasets')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'artifacts')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Define the Recurrent Network Architecture (LSTM)
class CourseSequenceLSTM(nn.Module):
    def __init__(self, vocab_size, embedding_dim, hidden_dim, output_dim):
        super(CourseSequenceLSTM, self).__init__()
        # Embedding layer to convert integer category indices into dense vectors
        self.embedding = nn.Embedding(vocab_size, embedding_dim)
        
        # LSTM layer to process the sequence of category vectors
        self.lstm = nn.LSTM(embedding_dim, hidden_dim, batch_first=True, num_layers=1)
        
        # Fully connected output layer to predict logits for the next category class
        self.fc = nn.Linear(hidden_dim, output_dim)
        
    def forward(self, x):
        # x shape: [batch_size, seq_len]
        embeds = self.embedding(x)
        # embeds shape: [batch_size, seq_len, embedding_dim]
        
        lstm_out, (h_n, c_n) = self.lstm(embeds)
        # lstm_out shape: [batch_size, seq_len, hidden_dim]
        
        # Extract the hidden state of the very last time step in the sequence
        last_time_step_out = lstm_out[:, -1, :] # shape: [batch_size, hidden_dim]
        
        logits = self.fc(last_time_step_out)
        return logits

# 2. Custom Dataset class for sequences
class CourseSequenceDataset(Dataset):
    def __init__(self, sequences, targets):
        self.sequences = torch.tensor(sequences, dtype=torch.long)
        self.targets = torch.tensor(targets, dtype=torch.long)
        
    def __len__(self):
        return len(self.targets)
        
    def __getitem__(self, idx):
        return self.sequences[idx], self.targets[idx]

def prepare_sequence_data():
    print("Loading and preparing student course sequences...")
    student_courses_path = os.path.join(DATASET_DIR, 'student_courses.csv')
    courses_path = os.path.join(DATASET_DIR, 'courses.csv')
    
    if not os.path.exists(student_courses_path) or not os.path.exists(courses_path):
        raise FileNotFoundError("Raw CSV datasets not found in the datasets folder.")
        
    df_sc = pd.read_csv(student_courses_path)
    df_c = pd.read_csv(courses_path)
    
    # Merge student course history with course category details
    df_merged = df_sc.merge(df_c[['course_id', 'category']], on='course_id', how='left')
    df_merged['category'] = df_merged['category'].fillna('Unknown')
    
    # Sort chronologically per student
    df_merged = df_merged.sort_values(by=['student_id', 'enrollment_date'])
    
    # Group categories taken by each student into sequence lists
    student_sequences = df_merged.groupby('student_id')['category'].apply(list).to_dict()
    
    # Construct unique token mapping dictionary for categories
    unique_categories = sorted(list(df_c['category'].unique()) + ['Unknown', '<PAD>'])
    category_to_idx = {cat: idx for idx, cat in enumerate(unique_categories)}
    idx_to_category = {idx: cat for cat, idx in category_to_idx.items()}
    
    # Save vocabulary dictionary mapping for real-time predictions
    with open(os.path.join(OUTPUT_DIR, 'lstm_categories.json'), 'w') as f:
        json.dump({
            'category_to_idx': category_to_idx,
            'idx_to_category': idx_to_category
        }, f, indent=2)
    
    # Generate sequential data points
    # E.g., sequence: [A, B, C, D] -> input: [PAD, PAD, A, B], target: C
    max_seq_len = 5
    pad_token_idx = category_to_idx['<PAD>']
    
    inputs = []
    targets = []
    
    for student_id, cats in student_sequences.items():
        if len(cats) < 2:
            continue # Needs at least 2 courses to form a history -> target sequence
            
        # Convert category strings to indices
        cat_indices = [category_to_idx[c] for c in cats]
        
        # Build rolling history sequences
        for i in range(1, len(cat_indices)):
            sub_seq = cat_indices[:i]
            target_val = cat_indices[i]
            
            # Pad sequence if it is shorter than max_seq_len, else slice the last max_seq_len elements
            if len(sub_seq) < max_seq_len:
                padded = [pad_token_idx] * (max_seq_len - len(sub_seq)) + sub_seq
            else:
                padded = sub_seq[-max_seq_len:]
                
            inputs.append(padded)
            targets.append(target_val)
            
    print(f"  Generated {len(targets)} sequence pairs.")
    return np.array(inputs), np.array(targets), len(unique_categories)

def main():
    print("=" * 60)
    print("PyTorch LSTM Course Prediction Pipeline")
    print("=" * 60)
    
    try:
        inputs, targets, vocab_size = prepare_sequence_data()
    except Exception as e:
        print(f"Error preparing datasets: {e}")
        return
        
    # Split into train/validation sets (80/20)
    dataset_size = len(inputs)
    indices = list(range(dataset_size))
    split = int(np.floor(0.2 * dataset_size))
    np.random.seed(42)
    np.random.shuffle(indices)
    
    train_indices, val_indices = indices[split:], indices[:split]
    
    X_train, y_train = inputs[train_indices], targets[train_indices]
    X_val, y_val = inputs[val_indices], targets[val_indices]
    
    # Package into DataLoaders
    train_dataset = CourseSequenceDataset(X_train, y_train)
    val_dataset = CourseSequenceDataset(X_val, y_val)
    
    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=64, shuffle=False)
    
    # Model dimensions
    embedding_dim = 32
    hidden_dim = 64
    output_dim = vocab_size
    
    # Initialize networks
    model = CourseSequenceLSTM(vocab_size, embedding_dim, hidden_dim, output_dim).to(device)
    criterion = nn.CrossEntropyLoss(ignore_index=0) # Ignore <PAD> index when computing loss
    optimizer = optim.Adam(model.parameters(), lr=0.003)
    
    epochs = 15
    print(f"  Training LSTM for {epochs} epochs on device: {device}...")
    
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        for seqs, lbls in train_loader:
            seqs, lbls = seqs.to(device), lbls.to(device)
            
            # Forward execution
            outputs = model(seqs)
            loss = criterion(outputs, lbls)
            
            # Optimization steps
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * seqs.size(0)
            
        train_loss /= len(train_loader.dataset)
        
        # Validation checks
        model.eval()
        val_loss = 0.0
        correct = 0
        with torch.no_grad():
            for seqs, lbls in val_loader:
                seqs, lbls = seqs.to(device), lbls.to(device)
                outputs = model(seqs)
                loss = criterion(outputs, lbls)
                val_loss += loss.item() * seqs.size(0)
                
                _, preds = torch.max(outputs, 1)
                correct += torch.sum(preds == lbls).item()
                
        val_loss /= len(val_loader.dataset)
        val_acc = correct / len(val_loader.dataset)
        
        print(f"    Epoch {epoch:02d}/{epochs}: Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val Accuracy: {val_acc:.2%}")
        
    # Save the trained parameters
    model_save_path = os.path.join(OUTPUT_DIR, 'course_lstm.pth')
    torch.save(model.state_dict(), model_save_path)
    print(f"\n[OK] LSTM Model successfully saved to {model_save_path}")

if __name__ == '__main__':
    main()
