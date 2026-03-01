"""
Model Service - Load and run yoga pose classification model
"""
import numpy as np
import os
from pathlib import Path

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# Try to import TensorFlow (may not be available on Python 3.13)
try:
    import tensorflow as tf
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("⚠ TensorFlow not available - using fallback classification")

try:
    from sklearn.preprocessing import StandardScaler
except ImportError:
    StandardScaler = None


class YogaClassifier:
    def __init__(self, model_path: str = None, labels_path: str = None):
        """Initialize the yoga pose classifier."""
        # Find project root
        self.project_root = Path(__file__).parent.parent
        
        # Default paths
        if model_path is None:
            model_path = self.project_root / "yoga_classifier_v2.h5"
        if labels_path is None:
            labels_path = self.project_root / "pose_labels_v2.npy"
        
        self.model = None
        self.labels = None
        self.scaler = StandardScaler() if StandardScaler else None
        self._scaler_fitted = False
        
        # Load model and labels
        self._load_model(model_path)
        self._load_labels(labels_path)
    
    def _load_model(self, model_path):
        """Load the Keras model."""
        if not TF_AVAILABLE:
            print("⚠ TensorFlow not available - model not loaded")
            self.model = None
            return
            
        try:
            # Try loading with compile=False for better compatibility
            self.model = tf.keras.models.load_model(str(model_path), compile=False)
            print(f"✓ Model loaded from {model_path}")
        except Exception as e:
            print(f"⚠ Could not load model with default method: {e}")
            # Try alternative loading method
            try:
                import keras
                self.model = keras.models.load_model(str(model_path), compile=False)
                print(f"✓ Model loaded using keras directly")
            except Exception as e2:
                print(f"⚠ Could not load model: {e2}")
                self.model = None
    
    def _load_labels(self, labels_path):
        """Load pose labels."""
        try:
            self.labels = np.load(str(labels_path), allow_pickle=True)
            print(f"✓ Labels loaded: {len(self.labels)} poses")
        except Exception as e:
            print(f"⚠ Could not load labels: {e}")
            # Fallback to common yoga poses
            self.labels = np.array([
                "Adho Mukha Svanasana", "Anjaneyasana", "Ardha Chandrasana",
                "Ardha Matsyendrasana", "Baddha Konasana", "Bakasana",
                "Balasana", "Bitilasana", "Dhanurasana", "Garudasana",
                "Halasana", "Marjaryasana", "Navasana", "Padmasana",
                "Paschimottanasana", "Phalakasana", "Setu Bandha Sarvangasana",
                "Trikonasana", "Urdhva Dhanurasana", "Utkatasana",
                "Ustrasana", "Vasisthasana", "Virabhadrasana One",
                "Virabhadrasana Two", "Vrksasana"
            ])
    
    def preprocess_features(self, features: list) -> np.ndarray:
        """Preprocess features for model input."""
        features = np.array(features).reshape(1, -1)
        
        # Only use the 132 landmark features (exclude any extra columns)
        if features.shape[1] > 132:
            features = features[:, :132]
        
        # Normalize using StandardScaler if available
        if self.scaler is not None:
            if not self._scaler_fitted:
                # Fit on first sample (ideally should use training data stats)
                self.scaler.fit(features)
                self._scaler_fitted = True
            features = self.scaler.transform(features)
        
        return features
    
    def predict(self, features: list) -> dict:
        """Predict yoga pose from features."""
        if self.model is None:
            # Return a message indicating model isn't available
            # but still return success so the API can provide landmark data
            return {
                "success": True,
                "predicted_pose": "Unknown (model not loaded)",
                "confidence": 0.0,
                "top_predictions": [],
                "note": "TensorFlow not available - install tensorflow to enable pose classification"
            }
        
        try:
            # Preprocess
            features_processed = self.preprocess_features(features)
            
            # Predict
            predictions = self.model.predict(features_processed, verbose=0)
            
            # Get top prediction
            predicted_idx = np.argmax(predictions[0])
            confidence = float(predictions[0][predicted_idx])
            
            # Get pose name
            if predicted_idx < len(self.labels):
                predicted_pose = str(self.labels[predicted_idx])
            else:
                predicted_pose = f"Unknown Pose (class {predicted_idx})"
            
            # Get top 3 predictions
            top_indices = np.argsort(predictions[0])[-3:][::-1]
            top_predictions = []
            for idx in top_indices:
                pose_name = str(self.labels[idx]) if idx < len(self.labels) else f"Class {idx}"
                top_predictions.append({
                    "pose": pose_name,
                    "confidence": round(float(predictions[0][idx]) * 100, 2)
                })
            
            return {
                "success": True,
                "predicted_pose": predicted_pose,
                "confidence": round(confidence * 100, 2),
                "top_predictions": top_predictions
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "predicted_pose": None,
                "confidence": 0.0
            }
    
    def get_available_poses(self) -> list:
        """Return list of poses the model can classify."""
        if self.labels is not None:
            return [str(label) for label in self.labels]
        return []


# Singleton instance
_classifier_instance = None

def get_classifier() -> YogaClassifier:
    """Get or create the classifier singleton."""
    global _classifier_instance
    if _classifier_instance is None:
        _classifier_instance = YogaClassifier()
    return _classifier_instance
