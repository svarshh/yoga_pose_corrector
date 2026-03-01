"""
Yoga Pose Correction API
FastAPI backend for pose detection, classification, and correction feedback
"""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import base64

from pose_processor import PoseProcessor
from model_service import get_classifier

# Initialize FastAPI app
app = FastAPI(
    title="Yoga Pose Correction API",
    description="Upload images to detect yoga poses and get correction feedback",
    version="1.0.0"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
pose_processor = PoseProcessor()
classifier = get_classifier()


# Request/Response Models
class Base64ImageRequest(BaseModel):
    image: str  # Base64 encoded image
    target_pose: Optional[str] = None  # Optional: specific pose to check against


class PoseResponse(BaseModel):
    success: bool
    predicted_pose: Optional[str] = None
    confidence: Optional[float] = None
    top_predictions: Optional[list] = None
    correction: Optional[dict] = None
    landmarks: Optional[list] = None
    error: Optional[str] = None


@app.get("/")
async def root():
    """API health check."""
    return {
        "status": "running",
        "api": "Yoga Pose Correction API",
        "version": "1.0.0",
        "pose_processor_available": pose_processor.available,
        "endpoints": {
            "/api/analyze": "POST - Analyze uploaded image",
            "/api/analyze-base64": "POST - Analyze base64 encoded image",
            "/api/poses": "GET - List available poses"
        }
    }


@app.get("/api/poses")
async def get_poses():
    """Get list of yoga poses the model can classify."""
    poses = classifier.get_available_poses()
    return {
        "count": len(poses),
        "poses": poses
    }


@app.post("/api/analyze", response_model=PoseResponse)
async def analyze_image(
    file: UploadFile = File(...),
    target_pose: Optional[str] = None
):
    """
    Analyze an uploaded image for yoga pose detection.
    
    - **file**: Image file (JPEG, PNG)
    - **target_pose**: Optional specific pose to check form against
    
    Returns predicted pose, confidence, and correction feedback.
    """
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image bytes
        image_bytes = await file.read()
        
        # Process image to extract landmarks
        pose_result = pose_processor.process_image_bytes(image_bytes)
        
        if not pose_result["success"]:
            return PoseResponse(
                success=False,
                error=pose_result["error"]
            )
        
        # Classify pose
        features = pose_result["features"]
        classification = classifier.predict(features)
        
        if not classification["success"]:
            return PoseResponse(
                success=False,
                error=classification["error"],
                landmarks=pose_result["landmarks"]
            )
        
        # Determine which pose to check for corrections
        check_pose = target_pose or classification["predicted_pose"]
        
        # Get pose corrections
        correction = pose_processor.get_pose_correction(
            pose_result["raw_landmarks"],
            check_pose
        )
        
        return PoseResponse(
            success=True,
            predicted_pose=classification["predicted_pose"],
            confidence=classification["confidence"],
            top_predictions=classification["top_predictions"],
            correction=correction,
            landmarks=pose_result["landmarks"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze-base64", response_model=PoseResponse)
async def analyze_base64_image(request: Base64ImageRequest):
    """
    Analyze a base64 encoded image for yoga pose detection.
    
    - **image**: Base64 encoded image string
    - **target_pose**: Optional specific pose to check form against
    
    Returns predicted pose, confidence, and correction feedback.
    """
    try:
        # Process base64 image
        pose_result = pose_processor.process_base64(request.image)
        
        if not pose_result["success"]:
            return PoseResponse(
                success=False,
                error=pose_result["error"]
            )
        
        # Classify pose
        features = pose_result["features"]
        classification = classifier.predict(features)
        
        if not classification["success"]:
            return PoseResponse(
                success=False,
                error=classification["error"],
                landmarks=pose_result["landmarks"]
            )
        
        # Determine which pose to check for corrections
        check_pose = request.target_pose or classification["predicted_pose"]
        
        # Get pose corrections
        correction = pose_processor.get_pose_correction(
            pose_result["raw_landmarks"],
            check_pose
        )
        
        return PoseResponse(
            success=True,
            predicted_pose=classification["predicted_pose"],
            confidence=classification["confidence"],
            top_predictions=classification["top_predictions"],
            correction=correction,
            landmarks=pose_result["landmarks"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Run with: uvicorn app:app --reload --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
