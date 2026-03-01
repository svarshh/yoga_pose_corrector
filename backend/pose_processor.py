"""
Pose Processor - Extract landmarks from images using MediaPipe
"""
import numpy as np
from PIL import Image
import io
import base64

# Try to import OpenCV and MediaPipe (may not work on Python 3.13)
CV2_AVAILABLE = False
MP_AVAILABLE = False

try:
    import cv2
    CV2_AVAILABLE = True
    print(f"✓ OpenCV loaded: {cv2.__version__}")
except ImportError as e:
    print(f"⚠ OpenCV not available: {e}")

try:
    import mediapipe as mp
    # Test if mediapipe is fully functional
    _ = mp.solutions.pose
    MP_AVAILABLE = True
    print(f"✓ MediaPipe loaded: {mp.__version__}")
except (ImportError, AttributeError) as e:
    print(f"⚠ MediaPipe not available: {e}")
    print("  MediaPipe requires Python 3.10 or 3.11")

print(f"Pose Processing Available: CV2={CV2_AVAILABLE}, MP={MP_AVAILABLE}")


class PoseProcessor:
    def __init__(self):
        self.available = MP_AVAILABLE and CV2_AVAILABLE
        
        if self.available:
            self.mp_pose = mp.solutions.pose
            self.pose = self.mp_pose.Pose(
                static_image_mode=True,
                min_detection_confidence=0.5,
                model_complexity=2
            )
        else:
            self.mp_pose = None
            self.pose = None
    
    def process_image_bytes(self, image_bytes: bytes) -> dict:
        """Process image from bytes and extract pose landmarks."""
        if not self.available:
            return {
                "success": False,
                "error": "MediaPipe/OpenCV not available. Requires Python 3.10 or 3.11",
                "landmarks": None,
                "features": None
            }
        
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return self.process_image(image)
    
    def process_base64(self, base64_string: str) -> dict:
        """Process base64 encoded image and extract pose landmarks."""
        if not self.available:
            return {
                "success": False,
                "error": "MediaPipe/OpenCV not available. Requires Python 3.10 or 3.11",
                "landmarks": None,
                "features": None
            }
        
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        image_bytes = base64.b64decode(base64_string)
        return self.process_image_bytes(image_bytes)
    
    def process_image(self, image: np.ndarray) -> dict:
        """Process OpenCV image and extract pose landmarks."""
        if not self.available:
            return {
                "success": False,
                "error": "MediaPipe/OpenCV not available. Requires Python 3.10 or 3.11",
                "landmarks": None,
                "features": None
            }
        
        # Convert BGR to RGB
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Process with MediaPipe
        results = self.pose.process(image_rgb)
        
        if not results.pose_landmarks:
            return {
                "success": False,
                "error": "No pose detected in image",
                "landmarks": None,
                "features": None
            }
        
        # Extract landmarks
        landmarks = results.pose_landmarks.landmark
        
        # Extract features (132 values: 33 landmarks × 4 values each)
        features = []
        landmark_data = []
        
        for i, lm in enumerate(landmarks):
            features.extend([lm.x, lm.y, lm.z, lm.visibility])
            landmark_data.append({
                "index": i,
                "name": self.mp_pose.PoseLandmark(i).name,
                "x": lm.x,
                "y": lm.y,
                "z": lm.z,
                "visibility": lm.visibility
            })
        
        return {
            "success": True,
            "landmarks": landmark_data,
            "features": features,
            "raw_landmarks": landmarks
        }
    
    def calculate_angle(self, a, b, c) -> float:
        """Calculate angle between three points."""
        a = np.array(a)
        b = np.array(b)
        c = np.array(c)
        
        radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
        angle = np.abs(radians * 180.0 / np.pi)
        
        if angle > 180.0:
            angle = 360 - angle
        
        return angle
    
    def get_landmark_coords(self, landmarks, name: str) -> list:
        """Get [x, y] coordinates for a named landmark."""
        lm = landmarks[getattr(self.mp_pose.PoseLandmark, name).value]
        return [lm.x, lm.y]
    
    def check_boat_pose(self, landmarks) -> dict:
        """Check Boat Pose (Navasana) form."""
        l_shldr = self.get_landmark_coords(landmarks, 'LEFT_SHOULDER')
        l_hip = self.get_landmark_coords(landmarks, 'LEFT_HIP')
        l_knee = self.get_landmark_coords(landmarks, 'LEFT_KNEE')
        l_ankle = self.get_landmark_coords(landmarks, 'LEFT_ANKLE')
        
        angle_v = self.calculate_angle(l_shldr, l_hip, l_knee)
        angle_knee = self.calculate_angle(l_hip, l_knee, l_ankle)
        balanced = l_shldr[1] < l_hip[1] - 0.05 and l_knee[1] < l_hip[1] - 0.05
        
        is_correct = 70 < angle_v < 130 and angle_knee > 130 and balanced
        
        corrections = []
        if not (70 < angle_v < 130):
            corrections.append(f"Adjust your V-angle (currently {angle_v:.1f}°, aim for 70-130°)")
        if angle_knee <= 130:
            corrections.append(f"Straighten your legs more (knee angle: {angle_knee:.1f}°)")
        if not balanced:
            corrections.append("Lift your torso and legs higher off the ground")
        
        return {
            "pose": "Boat Pose (Navasana)",
            "is_correct": is_correct,
            "angles": {
                "v_angle": round(angle_v, 1),
                "knee_angle": round(angle_knee, 1),
                "balanced": balanced
            },
            "corrections": corrections if not is_correct else ["Great form! Hold the pose."]
        }
    
    def check_corpse_pose(self, landmarks) -> dict:
        """Check Corpse Pose (Savasana) form."""
        l_shldr = self.get_landmark_coords(landmarks, 'LEFT_SHOULDER')
        l_hip = self.get_landmark_coords(landmarks, 'LEFT_HIP')
        l_knee = self.get_landmark_coords(landmarks, 'LEFT_KNEE')
        l_ankle = self.get_landmark_coords(landmarks, 'LEFT_ANKLE')
        
        angle_hip = self.calculate_angle(l_shldr, l_hip, l_knee)
        angle_knee = self.calculate_angle(l_hip, l_knee, l_ankle)
        is_horizontal = abs(l_shldr[1] - l_ankle[1]) < 0.15
        is_straight = angle_hip > 165 and angle_knee > 165
        
        is_correct = is_horizontal and is_straight
        
        corrections = []
        if not is_horizontal:
            corrections.append("Lie flat - your body should be horizontal")
        if angle_hip <= 165:
            corrections.append(f"Keep your hips straight (currently {angle_hip:.1f}°)")
        if angle_knee <= 165:
            corrections.append(f"Keep your legs straight (knee angle: {angle_knee:.1f}°)")
        
        return {
            "pose": "Corpse Pose (Savasana)",
            "is_correct": is_correct,
            "angles": {
                "hip_angle": round(angle_hip, 1),
                "knee_angle": round(angle_knee, 1),
                "is_horizontal": is_horizontal
            },
            "corrections": corrections if not is_correct else ["Perfect relaxation pose!"]
        }
    
    def check_crow_pose(self, landmarks) -> dict:
        """Check Crow Pose (Bakasana) form."""
        l_shldr = self.get_landmark_coords(landmarks, 'LEFT_SHOULDER')
        l_elbow = self.get_landmark_coords(landmarks, 'LEFT_ELBOW')
        l_wrist = self.get_landmark_coords(landmarks, 'LEFT_WRIST')
        l_hip = self.get_landmark_coords(landmarks, 'LEFT_HIP')
        l_knee = self.get_landmark_coords(landmarks, 'LEFT_KNEE')
        l_ankle = self.get_landmark_coords(landmarks, 'LEFT_ANKLE')
        
        angle_elbow = self.calculate_angle(l_shldr, l_elbow, l_wrist)
        angle_tuck = self.calculate_angle(l_hip, l_knee, l_shldr)
        torso_diff = abs(l_shldr[1] - l_hip[1])
        feet_up = l_ankle[1] < l_wrist[1] - 0.05
        
        is_correct = (70 < angle_elbow < 140) and (angle_tuck < 100) and (torso_diff < 0.2) and feet_up
        
        corrections = []
        if not (70 < angle_elbow < 140):
            corrections.append(f"Adjust elbow bend (currently {angle_elbow:.1f}°, aim for 70-140°)")
        if angle_tuck >= 100:
            corrections.append("Tuck your knees closer to your shoulders")
        if torso_diff >= 0.2:
            corrections.append("Keep your torso more level/horizontal")
        if not feet_up:
            corrections.append("Lift your feet off the ground")
        
        return {
            "pose": "Crow Pose (Bakasana)",
            "is_correct": is_correct,
            "angles": {
                "elbow_angle": round(angle_elbow, 1),
                "tuck_angle": round(angle_tuck, 1),
                "torso_level": round(torso_diff * 100, 1),
                "feet_lifted": feet_up
            },
            "corrections": corrections if not is_correct else ["Amazing balance! Hold steady."]
        }
    
    def get_pose_correction(self, landmarks, pose_name: str) -> dict:
        """Get pose-specific corrections based on detected pose."""
        pose_checks = {
            "boat": self.check_boat_pose,
            "navasana": self.check_boat_pose,
            "corpse": self.check_corpse_pose,
            "savasana": self.check_corpse_pose,
            "crow": self.check_crow_pose,
            "bakasana": self.check_crow_pose,
        }
        
        pose_key = pose_name.lower().replace(" ", "").replace("pose", "")
        
        for key, check_func in pose_checks.items():
            if key in pose_key:
                return check_func(landmarks)
        
        return {
            "pose": pose_name,
            "is_correct": None,
            "angles": {},
            "corrections": ["Pose correction not available for this pose yet."]
        }
