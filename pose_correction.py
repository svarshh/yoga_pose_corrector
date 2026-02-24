import cv2
import mediapipe as mp
import numpy as np
import argparse
import sys

def calculate_angle(a, b, c):
    """
    Calculate the angle between three points.
    """
    a = np.array(a) # First
    b = np.array(b) # Mid
    c = np.array(c) # End
    
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians*180.0/np.pi)
    
    if angle > 180.0:
        angle = 360 - angle
        
    return angle

def get_landmark(landmarks, mp_pose, name):
    lm = landmarks[getattr(mp_pose.PoseLandmark, name).value]
    return [lm.x, lm.y]


def check_boat(landmarks, mp_pose):
    # Boat Pose (Navasana): V-shape balance on sit-bones
    l_shldr = get_landmark(landmarks, mp_pose, 'LEFT_SHOULDER')
    l_hip = get_landmark(landmarks, mp_pose, 'LEFT_HIP')
    l_knee = get_landmark(landmarks, mp_pose, 'LEFT_KNEE')
    l_ankle = get_landmark(landmarks, mp_pose, 'LEFT_ANKLE')
    
    # 1. Hip Angle (The "V"): Should be fairly tight but manageable
    angle_v = calculate_angle(l_shldr, l_hip, l_knee) 
    
    # 2. Knee Angle: Standard navasana has straight legs, but modified (sahaja) is bent.
    # We will be more forgiving here (> 130 instead of 150)
    angle_knee = calculate_angle(l_hip, l_knee, l_ankle)
    
    # 3. Balance Check: Torso and legs must be lifted.
    # In MediaPipe Y: smaller is higher up. Shoulder and Knee should both be higher than the Hip.
    balanced = l_shldr[1] < l_hip[1] - 0.05 and l_knee[1] < l_hip[1] - 0.05
    
    # Wider range for the V-angle (70-130 degrees)
    is_correct = 70 < angle_v < 130 and angle_knee > 130 and balanced
    
    return is_correct, [
        ("V-Angle", angle_v, l_hip), 
        ("Knee", angle_knee, l_knee),
        ("Lifted", 1.0 if balanced else 0.0, l_shldr)
    ], None

def check_corpse(landmarks, mp_pose):
    # Corpse Pose (Savasana): Lying flat
    l_shldr = get_landmark(landmarks, mp_pose, 'LEFT_SHOULDER')
    l_hip = get_landmark(landmarks, mp_pose, 'LEFT_HIP')
    l_knee = get_landmark(landmarks, mp_pose, 'LEFT_KNEE')
    l_ankle = get_landmark(landmarks, mp_pose, 'LEFT_ANKLE')
    
    angle_hip = calculate_angle(l_shldr, l_hip, l_knee)
    angle_knee = calculate_angle(l_hip, l_knee, l_ankle)
    
    # Check if body is horizontal (Y coordinates of shoulder and ankle are similar)
    is_horizontal = abs(l_shldr[1] - l_ankle[1]) < 0.15
    is_straight = angle_hip > 165 and angle_knee > 165
    
    is_correct = is_horizontal and is_straight
    return is_correct, [("Hip", angle_hip, l_hip), ("Knee", angle_knee, l_knee)], None

def check_crow(landmarks, mp_pose):
    # Crow Pose (Bakasana): Arm balance
    l_shldr = get_landmark(landmarks, mp_pose, 'LEFT_SHOULDER')
    l_elbow = get_landmark(landmarks, mp_pose, 'LEFT_ELBOW')
    l_wrist = get_landmark(landmarks, mp_pose, 'LEFT_WRIST')
    l_hip = get_landmark(landmarks, mp_pose, 'LEFT_HIP')
    l_knee = get_landmark(landmarks, mp_pose, 'LEFT_KNEE')
    l_ankle = get_landmark(landmarks, mp_pose, 'LEFT_ANKLE')
    
    # 1. Elbows must be bent (approx 70-130 deg)
    angle_elbow = calculate_angle(l_shldr, l_elbow, l_wrist)
    
    # 2. Knees tucked toward shoulders
    angle_tuck = calculate_angle(l_hip, l_knee, l_shldr) 
    
    # 3. Torso horizontal (Shoulder and Hip Y are close)
    # MediaPipe Y: 0 top, 1 bottom. If standing, this is ~0.3+. 
    torso_diff = abs(l_shldr[1] - l_hip[1])
    
    # 4. Feet off ground (Ankle significantly higher than wrist)
    # Wrists are on ground (large Y), feet must be lifted (smaller Y).
    feet_up = l_ankle[1] < l_wrist[1] - 0.05
    
    is_correct = (70 < angle_elbow < 140) and (angle_tuck < 100) and (torso_diff < 0.2) and feet_up
    
    return is_correct, [
        ("Elbow", angle_elbow, l_elbow), 
        ("Tuck", angle_tuck, l_knee),
        ("TorsoLevel", torso_diff * 100, l_hip),
        ("FeetUp", 1.0 if feet_up else 0.0, l_ankle)
    ], None

def main():
    parser = argparse.ArgumentParser(description='Yoga Pose Corrector')
    parser.add_argument('pose', choices=['boat', 'corpse', 'crow'], 
                        help='Choose the yoga pose to practice: boat, corpse, or crow')
    args = parser.parse_args()
    
    pose_info = {
        'boat': {'name': 'Boat Pose (Navasana)', 'diff': 'Medium', 'func': check_boat},
        'corpse': {'name': 'Corpse Pose (Savasana)', 'diff': 'Easy', 'func': check_corpse},
        'crow': {'name': 'Crow Pose (Bakasana)', 'diff': 'Hard', 'func': check_crow},
    }
    
    selected = pose_info[args.pose]
    
    mp_drawing = mp.solutions.drawing_utils
    mp_pose = mp.solutions.pose
    
    # Start video capture
    cap = cv2.VideoCapture(0)
    
    # Setup mediapipe instance
    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        print(f"Starting {selected['name']} analysis (Difficulty: {selected['diff']})...")
        print("Press 'q' to quit.")
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                continue
                
            # Get video dimensions
            h, w, _ = frame.shape
            
            # Recolor image to RGB
            image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image.flags.writeable = False
          
            # Make detection
            results = pose.process(image)
        
            # Recolor back to BGR
            image.flags.writeable = True
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)
            
            try:
                if results.pose_landmarks:
                    landmarks = results.pose_landmarks.landmark
                    
                    # Run pose check
                    is_correct, angle_data, extra = selected['func'](landmarks, mp_pose)
                    
                    # Feedback color
                    main_color = (0, 255, 0) if is_correct else (0, 165, 255)
                    
                    # Draw UI HUD
                    cv2.rectangle(image, (0,0), (320, 120), (245, 117, 16), -1)
                    cv2.putText(image, f"POSE: {selected['name']}", (10, 30), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
                    cv2.putText(image, f"DIFFICULTY: {selected['diff']}", (10, 65), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
                    
                    status = "CORRECT" if is_correct else "ADJUSTING..."
                    cv2.putText(image, f"STATUS: {status}", (10, 100), 
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, main_color, 2, cv2.LINE_AA)
                    
                    # Render angles on body
                    for label, angle, coord in angle_data:
                        cv2.putText(image, f"{label}: {int(angle)}deg", 
                                    (int(coord[0]*w) + 10, int(coord[1]*h) - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, main_color, 2, cv2.LINE_AA)
                    
                
            except Exception as e:
                # Silence errors to keep the loop running if landmarks aren't found
                pass
            
            # Render pose connections
            if results.pose_landmarks:
                mp_drawing.draw_landmarks(image, results.pose_landmarks, mp_pose.POSE_CONNECTIONS,
                                        mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=2), 
                                        mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2) 
                                         )               
            
            cv2.imshow('Yoga Pose Analyzer', image)
    
            if cv2.waitKey(10) & 0xFF == ord('q'):
                break
                
    cap.release()
    cv2.destroyAllWindows()

if __name__ == '__main__':
    main()
