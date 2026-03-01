# Yoga Pose Correction API - Backend

FastAPI backend for yoga pose detection, classification, and correction feedback.

## Features

- **Pose Detection**: Extract 33 body landmarks using MediaPipe
- **Pose Classification**: Classify into 40 yoga poses using TensorFlow model
- **Correction Feedback**: Get real-time form corrections for Boat, Corpse, and Crow poses

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/poses` | GET | List available yoga poses |
| `/api/analyze` | POST | Upload image file for analysis |
| `/api/analyze-base64` | POST | Send base64 encoded image |

## Setup

### Requirements
- Python 3.11 (required for MediaPipe compatibility)

### Installation

```bash
# Create virtual environment
py -3.11 -m venv venv311

# Activate (Windows)
.\venv311\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

### Run Server

```bash
cd backend
python app.py
```

Server runs at `http://localhost:8000`

## API Usage

### Analyze Image (Base64)

```python
import requests
import base64

with open("yoga_pose.jpg", "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

response = requests.post(
    "http://localhost:8000/api/analyze-base64",
    json={"image": b64}
)
print(response.json())
```

### Response Example

```json
{
  "success": true,
  "predicted_pose": "Vrksasana",
  "confidence": 87.5,
  "landmarks": [...],
  "correction": {
    "pose": "Tree Pose",
    "is_correct": true,
    "corrections": ["Great form! Hold the pose."]
  }
}
```

## Files

- `app.py` - FastAPI server
- `pose_processor.py` - MediaPipe landmark extraction
- `model_service.py` - TensorFlow model inference
- `requirements.txt` - Python dependencies

## Known Issues / TODO

### Bugs
- **MediaPipe module caching**: MediaPipe loads successfully at import time (`available=True`) but returns "MediaPipe/OpenCV not available" during API requests. This appears to be a module state caching issue between uvicorn worker processes.
  
- **Keras model compatibility**: The saved `.h5` model was created with a newer Keras version. Loading fails with `Unrecognized keyword arguments: ['batch_shape']` for the InputLayer. Need to either:
  - Re-export the model with TensorFlow 2.15 / Keras 2.x
  - Or update model_service.py to handle the version mismatch

### TODO
- [ ] Fix MediaPipe availability bug in API endpoints
- [ ] Re-train or re-export model with compatible Keras version
- [ ] Add unit tests for pose detection
- [ ] Integrate with React frontend
- [ ] Add WebSocket support for real-time video analysis


