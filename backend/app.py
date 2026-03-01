import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.get("/poses")
def poses():
    return {"poses": ["boat", "corpse", "crow"]}

IDX = {
    "LEFT_SHOULDER": 11, "RIGHT_SHOULDER": 12,
    "LEFT_ELBOW": 13,    "RIGHT_ELBOW": 14,
    "LEFT_WRIST": 15,    "RIGHT_WRIST": 16,
    "LEFT_HIP": 23,      "RIGHT_HIP": 24,
    "LEFT_KNEE": 25,     "RIGHT_KNEE": 26,
    "LEFT_ANKLE": 27,    "RIGHT_ANKLE": 28,
}

def calculate_angle(a, b, c):
    a = np.array(a[:3]); b = np.array(b[:3]); c = np.array(c[:3])
    radians = np.arctan2(c[1]-b[1], c[0]-b[0]) - np.arctan2(a[1]-b[1], a[0]-b[0])
    angle = np.abs(radians * 180.0 / np.pi)
    if angle > 180.0:
        angle = 360 - angle
    return float(angle)

def get_point(landmarks, name):
    i = IDX[name]
    p = landmarks[i]
    if isinstance(p, dict):
        x = float(p["x"]); y = float(p["y"]); z = float(p.get("z", 0.0))
        vis = float(p.get("visibility", p.get("presence", 0.0)))
        return [x, y, z, vis]
    # list format: [x,y,z,vis] or [x,y,z]
    x = float(p[0]); y = float(p[1])
    z = float(p[2]) if len(p) > 2 else 0.0
    vis = float(p[3]) if len(p) > 3 else 0.0
    return [x, y, z, vis]

def best_side(landmarks):
    ls = get_point(landmarks, "LEFT_SHOULDER")[3]
    rs = get_point(landmarks, "RIGHT_SHOULDER")[3]
    lh = get_point(landmarks, "LEFT_HIP")[3]
    rh = get_point(landmarks, "RIGHT_HIP")[3]
    return "LEFT" if (ls + lh) >= (rs + rh) else "RIGHT"


# -----------------------------
# ✅ BOAT
# -----------------------------
def check_boat(landmarks):
    """
    Boat: try both LEFT and RIGHT side and accept whichever passes more checks.
    Conditions (forgiving):
      - V-angle between shoulder-hip-knee is between 45 and 160
      - Knee extension (hip-knee-ankle) is >= 85
      - Knee lifted: knee slightly above hip (y smaller) by 0.01
    Pass if >= 2 of the 3 conditions are true.
    """

    def boat_side(side: str):
        shldr = get_point(landmarks, f"{side}_SHOULDER")
        hip   = get_point(landmarks, f"{side}_HIP")
        knee  = get_point(landmarks, f"{side}_KNEE")
        ankle = get_point(landmarks, f"{side}_ANKLE")

        angle_v    = calculate_angle(shldr, hip, knee)      # torso/leg V shape
        angle_knee = calculate_angle(hip, knee, ankle)      # leg straightness

        knee_lifted = (knee[1] < hip[1] - 0.01)

        cond_v    = (45 < angle_v < 160)
        cond_knee = (angle_knee >= 85)

        conds = [cond_v, cond_knee, knee_lifted]
        passed = sum(1 for c in conds if c)

        is_ok = passed >= 2

        metrics = [
            {"name": "SideUsed", "value": 0 if side == "LEFT" else 1},
            {"name": "V-Angle", "value": float(angle_v)},
            {"name": "Knee", "value": float(angle_knee)},
            {"name": "KneeLifted", "value": 1.0 if knee_lifted else 0.0},
            {"name": "PassedCount", "value": float(passed)},
        ]
        return is_ok, passed, metrics

    ok_l, pass_l, m_l = boat_side("LEFT")
    ok_r, pass_r, m_r = boat_side("RIGHT")

    # Prefer the side that passes more checks (or any that passes)
    if ok_l and ok_r:
        return True, (m_l if pass_l >= pass_r else m_r)
    if ok_l:
        return True, m_l
    if ok_r:
        return True, m_r

    # Neither passed: return "closer" side for debugging
    return False, (m_l if pass_l >= pass_r else m_r)


# -----------------------------
# CORPSE / CROW (unchanged)
# -----------------------------
def check_corpse(landmarks):
    side = best_side(landmarks)
    shldr = get_point(landmarks, f"{side}_SHOULDER")
    hip   = get_point(landmarks, f"{side}_HIP")
    knee  = get_point(landmarks, f"{side}_KNEE")
    ankle = get_point(landmarks, f"{side}_ANKLE")

    angle_knee = calculate_angle(hip, knee, ankle)

    # strongest signal for corpse
    is_horizontal = abs(shldr[1] - ankle[1]) < 0.22

    # forgiving (used for feedback / passedcount, not required for success)
    knee_straight = angle_knee >= 140

    conds = [is_horizontal, knee_straight]
    passed = sum(1 for c in conds if c)

    # ✅ easiest: if you're horizontal, you win
    is_correct = is_horizontal

    metrics = [
        {"name": "SideUsed", "value": 0 if side == "LEFT" else 1},
        {"name": "Knee", "value": float(angle_knee)},
        {"name": "Horizontal", "value": 1.0 if is_horizontal else 0.0},
        {"name": "PassedCount", "value": float(passed)},  # ✅ add this
    ]
    return is_correct, metrics
def check_crow(landmarks):
    side = best_side(landmarks)

    shldr = get_point(landmarks, f"{side}_SHOULDER")
    elbow = get_point(landmarks, f"{side}_ELBOW")
    wrist = get_point(landmarks, f"{side}_WRIST")
    hip   = get_point(landmarks, f"{side}_HIP")
    knee  = get_point(landmarks, f"{side}_KNEE")
    ankle = get_point(landmarks, f"{side}_ANKLE")

    angle_elbow = calculate_angle(shldr, elbow, wrist)
    angle_tuck  = calculate_angle(hip, knee, shldr)
    torso_diff  = abs(shldr[1] - hip[1])

    feet_up = ankle[1] < wrist[1] - 0.01

    cond_elbow = (55 < angle_elbow < 155)
    cond_tuck  = (angle_tuck < 125)
    cond_torso = (torso_diff < 0.32)
    cond_feet  = feet_up

    conds = [cond_elbow, cond_tuck, cond_torso, cond_feet]
    passed = sum(1 for c in conds if c)

    is_correct = passed >= 3

    metrics = [
        {"name": "SideUsed", "value": 0 if side == "LEFT" else 1},
        {"name": "Elbow", "value": angle_elbow},
        {"name": "Tuck", "value": angle_tuck},
        {"name": "TorsoDiff", "value": torso_diff},
        {"name": "FeetUp", "value": 1.0 if feet_up else 0.0},
        {"name": "PassedCount", "value": float(passed)},
    ]
    return is_correct, metrics


CHECKS = {"boat": check_boat, "corpse": check_corpse, "crow": check_crow}

@app.post("/score_pose")
def score_pose():
    data = request.get_json() or {}
    pose = data.get("pose")
    landmarks = data.get("landmarks")

    if pose not in CHECKS:
        return jsonify({"error": "pose must be one of: boat, corpse, crow"}), 400
    if not isinstance(landmarks, list) or len(landmarks) != 33:
        return jsonify({"error": "landmarks must be a list of 33 points"}), 400

    correct, metrics = CHECKS[pose](landmarks)
    return jsonify({"pose": pose, "correct": bool(correct), "metrics": metrics})

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    app.run(debug=True)