"""
TRAINING SCRIPT FOR PUSH-UP AND TREE POSE ML MODELS
=====================================================

DATASETS NEEDED:
1. Push-Up:  https://www.kaggle.com/datasets/shoreefuddin/pushup-exercise
             Structure: pushup/up/, pushup/down/, pushup/else/

2. Tree Pose: https://www.kaggle.com/datasets/niharika41298/yoga-poses-dataset
             Structure: DATASET/train/tree/, DATASET/test/tree/
             (also has: downdog, goddess, plank, warrior)

SETUP:
------
1. Download both datasets from Kaggle
2. Place them in the same folder as this script:
   - pushup-exercise/     ← from dataset 1
   - yoga-poses-dataset/  ← from dataset 2

3. Run:
   pip install mediapipe opencv-python scikit-learn pandas numpy
   python train_models.py

OUTPUT:
-------
Saves these files to web/server/static/model/:
   - push_up_model.pkl
   - push_up_input_scaler.pkl
   - tree_pose_model.pkl
   - tree_pose_input_scaler.pkl
"""

import os
import cv2
import pickle
import numpy as np
import pandas as pd
import mediapipe as mp
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

# ─── Config ───────────────────────────────────────────────────────────────────

# Change these paths to where you extracted the Kaggle datasets
PUSHUP_DATASET_PATH = "./pushup-exercise"          # contains: up/, down/, else/
YOGA_DATASET_PATH   = "./yoga-poses-dataset/DATASET" # contains: train/tree/, test/tree/

# Where to save the trained models (your Django project)
MODEL_OUTPUT_PATH = "./web/server/static/model"

# ─── MediaPipe Setup ──────────────────────────────────────────────────────────
mp_pose = mp.solutions.pose

def extract_landmarks_from_image(image_path: str) -> list:
    """
    Run MediaPipe on a single image and return 33 landmarks as flat list.
    Returns None if no person detected.
    """
    img = cv2.imread(image_path)
    if img is None:
        return None

    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    with mp_pose.Pose(
        static_image_mode=True,
        min_detection_confidence=0.5
    ) as pose:
        results = pose.process(rgb)

    if not results.pose_landmarks:
        return None

    # Flatten all 33 landmarks → [x0,y0,z0,v0, x1,y1,z1,v1, ... x32,y32,z32,v32]
    row = []
    for lm in results.pose_landmarks.landmark:
        row.extend([lm.x, lm.y, lm.z, lm.visibility])

    return row  # 132 values total


def process_folder(folder_path: str, label: str, data: list, skipped: list):
    """
    Process all images in a folder, extract landmarks, append to data list.
    """
    if not os.path.exists(folder_path):
        print(f"  ⚠️  Folder not found: {folder_path}")
        return

    files = [f for f in os.listdir(folder_path)
             if f.lower().endswith((".jpg", ".jpeg", ".png", ".bmp", ".webp"))]

    print(f"  Processing {len(files)} images from: {folder_path} → label='{label}'")

    for fname in files:
        path = os.path.join(folder_path, fname)
        landmarks = extract_landmarks_from_image(path)
        if landmarks is None:
            skipped.append(path)
            continue
        data.append(landmarks + [label])


def train_and_save(data: list, exercise_name: str, label_map: dict):
    """
    Train RandomForest on extracted landmark data, save model + scaler.
    label_map: e.g. {"correct": 1, "incorrect": 0}
    """
    print(f"\n{'='*50}")
    print(f"  Training model: {exercise_name}")
    print(f"{'='*50}")

    if len(data) < 10:
        print(f"  ❌ Not enough data ({len(data)} samples). Need at least 10.")
        return

    # Build DataFrame
    num_features = 132  # 33 landmarks × 4 values
    cols = [f"f{i}" for i in range(num_features)] + ["label"]
    df = pd.DataFrame(data, columns=cols)

    print(f"  Total samples: {len(df)}")
    print(f"  Label distribution:\n{df['label'].value_counts().to_string()}")

    # Map labels to numbers
    df["target"] = df["label"].map(label_map)
    df = df.dropna(subset=["target"])  # drop any unmapped labels

    X = df[[f"f{i}" for i in range(num_features)]].values
    y = df["target"].values.astype(int)

    # Train / test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Scale features
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test  = scaler.transform(X_test)

    # Train Random Forest
    print(f"\n  Training RandomForestClassifier...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\n  ✅ Accuracy: {acc*100:.1f}%")
    print(f"\n  Classification Report:")
    print(classification_report(y_test, y_pred,
          target_names=[k for k,v in sorted(label_map.items(), key=lambda x: x[1])]))

    # Save
    os.makedirs(MODEL_OUTPUT_PATH, exist_ok=True)
    model_path  = os.path.join(MODEL_OUTPUT_PATH, f"{exercise_name}_model.pkl")
    scaler_path = os.path.join(MODEL_OUTPUT_PATH, f"{exercise_name}_input_scaler.pkl")

    with open(model_path,  "wb") as f: pickle.dump(model,  f)
    with open(scaler_path, "wb") as f: pickle.dump(scaler, f)

    print(f"\n  💾 Saved: {model_path}")
    print(f"  💾 Saved: {scaler_path}")


# ─── PUSH-UP Training ─────────────────────────────────────────────────────────
def train_pushup():
    """
    Push-Up dataset has 3 folders:
      up/   → top of push-up (arms extended) = correct
      down/ → bottom of push-up (chest near floor) = correct
      else/ → transitional/bad frames = incorrect

    We label:
      up   → "correct" (1)
      down → "correct" (1)
      else → "incorrect" (0)
    """
    print("\n" + "="*60)
    print("  PUSH-UP MODEL TRAINING")
    print("="*60)

    data    = []
    skipped = []

    # "up" and "down" positions = correct push-up form
    process_folder(os.path.join(PUSHUP_DATASET_PATH, "up"),   "correct", data, skipped)
    process_folder(os.path.join(PUSHUP_DATASET_PATH, "down"), "correct", data, skipped)

    # "else" = transitional/incorrect
    process_folder(os.path.join(PUSHUP_DATASET_PATH, "else"), "incorrect", data, skipped)

    print(f"\n  Total extracted: {len(data)} | Skipped (no person): {len(skipped)}")

    train_and_save(
        data=data,
        exercise_name="push_up",
        label_map={"correct": 1, "incorrect": 0}
    )


# ─── TREE POSE Training ───────────────────────────────────────────────────────
def train_tree_pose():
    """
    Yoga dataset has 5 poses: downdog, goddess, plank, tree, warrior
    We use:
      tree/    → "correct" (1)  ← the pose we want to detect
      others/  → "incorrect" (0) ← everything else = wrong pose

    This teaches the model: "is this person doing tree pose or not?"
    """
    print("\n" + "="*60)
    print("  TREE POSE MODEL TRAINING")
    print("="*60)

    data    = []
    skipped = []

    # Tree pose images = correct
    for split in ["train", "test"]:
        tree_path = os.path.join(YOGA_DATASET_PATH, split, "tree")
        process_folder(tree_path, "correct", data, skipped)

    # All other poses = incorrect (not tree pose)
    other_poses = ["downdog", "goddess", "plank", "warrior"]
    for split in ["train", "test"]:
        for pose in other_poses:
            pose_path = os.path.join(YOGA_DATASET_PATH, split, pose)
            process_folder(pose_path, "incorrect", data, skipped)

    print(f"\n  Total extracted: {len(data)} | Skipped (no person): {len(skipped)}")

    train_and_save(
        data=data,
        exercise_name="tree_pose",
        label_map={"correct": 1, "incorrect": 0}
    )


# ─── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n🏋️  EXERCISE ML MODEL TRAINER")
    print("================================")

    # Check dataset paths exist
    errors = []
    if not os.path.exists(PUSHUP_DATASET_PATH):
        errors.append(f"Push-up dataset not found at: {PUSHUP_DATASET_PATH}")
    if not os.path.exists(YOGA_DATASET_PATH):
        errors.append(f"Yoga dataset not found at: {YOGA_DATASET_PATH}")

    if errors:
        print("\n❌ ERRORS — please fix before running:")
        for e in errors:
            print(f"   - {e}")
        print("\nExpected folder structure:")
        print("  ./pushup-exercise/")
        print("      up/       ← push-up top position images")
        print("      down/     ← push-up bottom position images")
        print("      else/     ← other/transitional images")
        print("")
        print("  ./yoga-poses-dataset/DATASET/")
        print("      train/")
        print("          tree/     ← tree pose images")
        print("          downdog/  ← other yoga poses")
        print("          goddess/")
        print("          plank/")
        print("          warrior/")
        print("      test/")
        print("          tree/")
        print("          ... (same structure)")
        exit(1)

    # Train both models
    train_pushup()
    train_tree_pose()

    print("\n\n✅ ALL DONE!")
    print("="*60)
    print("Models saved to:", MODEL_OUTPUT_PATH)
    print("\nNext steps:")
    print("1. Restart Django server")
    print("2. The models load automatically via get_models() in views.py")
    print("3. Add push_up and tree_pose to ML_SUPPORTED list in upload_video()")
    print("="*60)
