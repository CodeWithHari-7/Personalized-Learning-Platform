"""
PyTorch ANN Training Pipeline - Alternative Local Deep Learning for Student Performance Prediction
Trains a Multi-Layer Perceptron (ANN) to classify student performance (High/Medium/Low)
"""
import os
import sys
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import pandas as pd
import numpy as np
import joblib

sys.path.insert(0, os.path.dirname(__file__))
from preprocess import main as preprocess_main

# Set device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'artifacts')
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Define the Neural Network Architecture (ANN)
class StudentPerformanceANN(nn.Module):
    def __init__(self, input_dim, output_dim):
        super(StudentPerformanceANN, self).__init__()
        # Fully Connected Layer 1
        self.fc1 = nn.Linear(input_dim, 64)
        self.relu1 = nn.ReLU()
        self.dropout1 = nn.Dropout(0.2)
        
        # Fully Connected Layer 2
        self.fc2 = nn.Linear(64, 32)
        self.relu2 = nn.ReLU()
        self.dropout2 = nn.Dropout(0.2)
        
        # Output Layer (logits for 3 classes: High, Medium, Low)
        self.fc3 = nn.Linear(32, output_dim)
        
    def forward(self, x):
        x = self.dropout1(self.relu1(self.fc1(x)))
        x = self.dropout2(self.relu2(self.fc2(x)))
        out = self.fc3(x)
        return out

def main():
    print("=" * 60)
    print("PyTorch ANN Training Pipeline - Student Performance")
    print("=" * 60)
    
    # 2. Load preprocessed features
    X, y_perf, _, preprocessor, _ = preprocess_main()
    
    input_dim = X.shape[1]
    output_dim = len(np.unique(y_perf)) # 3 classes
    
    print(f"  Input Features: {input_dim}")
    print(f"  Target Classes: {output_dim}")
    
    # 3. Convert data to PyTorch Tensors
    X_tensor = torch.tensor(X.values, dtype=torch.float32)
    y_tensor = torch.tensor(y_perf, dtype=torch.long)
    
    # Train / Test Split (80/20)
    dataset_size = len(X_tensor)
    indices = list(range(dataset_size))
    split = int(np.floor(0.2 * dataset_size))
    np.random.seed(42)
    np.random.shuffle(indices)
    
    train_indices, val_indices = indices[split:], indices[:split]
    
    X_train, y_train = X_tensor[train_indices], y_tensor[train_indices]
    X_val, y_val = X_tensor[val_indices], y_tensor[val_indices]
    
    # Create DataLoaders
    train_dataset = TensorDataset(X_train, y_train)
    val_dataset = TensorDataset(X_val, y_val)
    
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
    
    # 4. Initialize model, loss function, and optimizer
    model = StudentPerformanceANN(input_dim, output_dim).to(device)
    criterion = nn.CrossEntropyLoss() # Standard loss for multi-class classification
    optimizer = optim.Adam(model.parameters(), lr=0.005) # Adam optimizer
    
    # 5. Training Loop
    epochs = 50
    print(f"  Training for {epochs} epochs on device: {device}...")
    
    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        for data, targets in train_loader:
            data, targets = data.to(device), targets.to(device)
            
            # Forward pass
            outputs = model(data)
            loss = criterion(outputs, targets)
            
            # Backward pass & Optimization
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * data.size(0)
            
        train_loss /= len(train_loader.dataset)
        
        # Validation
        model.eval()
        val_loss = 0.0
        correct = 0
        with torch.no_grad():
            for data, targets in val_loader:
                data, targets = data.to(device), targets.to(device)
                outputs = model(data)
                loss = criterion(outputs, targets)
                val_loss += loss.item() * data.size(0)
                
                _, preds = torch.max(outputs, 1)
                correct += torch.sum(preds == targets).item()
                
        val_loss /= len(val_loader.dataset)
        val_acc = correct / len(val_loader.dataset)
        
        if epoch % 10 == 0 or epoch == 1:
            print(f"    Epoch {epoch:02d}/{epochs}: Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.4%}")
            
    # 6. Save the trained PyTorch Model
    model_save_path = os.path.join(OUTPUT_DIR, 'student_ann.pth')
    torch.save(model.state_dict(), model_save_path)
    print(f"\n[OK] Model successfully saved to {model_save_path}")

if __name__ == '__main__':
    main()
