import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Star, RefreshCw, X, Home } from "lucide-react";
import { useGame } from "../context/GameContext";

/** ---------------- Types ---------------- */
type Metric = { name: string; value: number; ok?: boolean; target?: string; hint?: string };
type InterpretedMetric = Metric & { ok: boolean; target: string; hint: string };

type PoseKey = "boat" | "crow" | "corpse";

/** ---------------- Helpers ---------------- */
function normKey(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function getPassedCount(interpreted: InterpretedMetric[]) {
  const m = interpreted.find((x) => normKey(x.name) === "checks passed");
  return m ? Number(m.value) : null;
}

function winThresholdForPose(poseKey: PoseKey) {
  if (poseKey === "boat") return 2;
  if (poseKey === "crow") return 3;
  return null; // corpse: no threshold shortcut
}

function formatValue(name: string, value: number) {
  const n = normKey(name);
  const isDegrees = n.includes("angle") || n.includes("hip") || n.includes("knee") || n.includes("elbow") || n.includes("tuck");
  if (isDegrees) return `${Number(value).toFixed(0)}°`;

  if (n.includes("lift") || n.includes("feet") || n.includes("horizontal") || n.includes("level")) {
    return value >= 0.5 ? "Yes" : "No";
  }
  return Number(value).toFixed(2);
}

/**
 * Values you NEVER want to treat as real measurements.
 * If required metrics have these -> forced defeat.
 */
function isClearlyInvalidMetricValue(labelOrName: string, value: number) {
  const label = normKey(labelOrName);
  if (!Number.isFinite(value)) return true;

  // boat / corpse knee extension sanity
  if (label.includes("knee extension") || label === "knee") return value <= 8;

  // crow knee tuck: < 25° is almost always bogus (bad detection)
  if (label.includes("knee tuck") || label.includes("tuck")) return value < 25;

  // boat v-shape sanity
  if (label.includes("v shape") || label.includes("v-angle") || label.includes("v angle")) return value <= 5 || value >= 179;

  // hip extension sanity (if ever shown)
  if (label.includes("hip extension") || label === "hip") return value <= 20;

  // elbow sanity (tiny values are usually noise)
  if (label.includes("elbow")) return value < 10;

  return false;
}

function interpretMetric(poseKey: PoseKey, m: Metric): InterpretedMetric | null {
  const rawName = m.name ?? "";
  const n = normKey(rawName);
  const v = Number(m.value);

  // hide internal/debug
  if (n.includes("sideused")) return null;

  // if backend already provides ok/target/hint, trust it (but still normalize)
  if (typeof m.ok === "boolean" || m.target || m.hint) {
    return {
      ...m,
      name: rawName,
      value: v,
      ok: m.ok ?? true,
      target: m.target ?? "",
      hint: m.hint ?? "",
    };
  }

  // defaults
  let ok = false;
  let target = "";
  let hintGood = "Looks good.";
  let hintBad = "Needs improvement.";
  let displayName = rawName;

  /** ------------ BOAT ------------ */
  if (poseKey === "boat") {
    if (n.includes("v-angle") || n.includes("v angle") || n.includes("vshape") || n.includes("v shape")) {
      displayName = "V shape";
      target = "45°–160°";
      ok = v >= 45 && v <= 160;
      hintGood = `Nice V shape (${v.toFixed(0)}°).`;
      hintBad = "Lean back a bit and lift knees to form a clearer V (45°–160°).";
    } else if (n.includes("knee")) {
      displayName = "Knee extension";
      target = "≥ 95°";
      ok = v >= 95;
      hintGood = `Leg extension looks solid (${v.toFixed(0)}°).`;
      hintBad = "Straighten legs a bit more (aim for ≥ 95°).";
    } else if (
      n.includes("leg lift") ||
      n.includes("leglift") ||
      n.includes("lifted") ||
      n.includes("lift") ||
      n.includes("feet")
    ) {
      displayName = "Leg lift";
      target = "Yes";
      ok = v >= 0.5;
      hintGood = "Good lift — knees/legs are elevated.";
      hintBad = "Lift knees/feet a little higher; keep chest proud.";
    } else if (n.includes("passedcount") || n.includes("checks passed")) {
      displayName = "Checks passed";
      target = "≥ 2";
      ok = v >= 2;
      hintGood = "Most key checks passed.";
      hintBad = "Try to pass at least 2 key checks consistently.";
    }
  }

  /** ------------ CORPSE ------------ */
  if (poseKey === "corpse") {
    // hide hip (noisy / not meaningful lying down)
    if (n.includes("hip")) return null;

    if (n.includes("knee")) {
      displayName = "Knee extension";
      target = "≥ 140°";
      ok = v >= 140;
      hintGood = `Legs look straight (${v.toFixed(0)}°).`;
      hintBad = "Relax legs and straighten knees a bit (≥ 140°).";
    } else if (n.includes("horizontal") || n.includes("level")) {
      displayName = "Body level";
      target = "Yes";
      ok = v >= 0.5;
      hintGood = "Body looks level — nice alignment.";
      hintBad = "Center your full body in frame and hold still briefly.";
    } else if (n.includes("passedcount") || n.includes("checks passed")) {
      // Some backends send this; we don't require it for corpse, but we can display it if present.
      displayName = "Checks passed";
      target = "≥ 1";
      ok = v >= 1;
      hintGood = "Core checks look good.";
      hintBad = "Hold still and keep your full body visible.";
    }
  }

  /** ------------ CROW ------------ */
  if (poseKey === "crow") {
    if (n.includes("elbow")) {
      displayName = "Elbow bend";
      target = "55°–115°";

      // Treat tiny values as noise
      if (v < 10) {
        ok = false;
        hintBad = "Elbow angle looks unrealistically small — likely detection noise. Re-center body and hold still.";
      } else {
        ok = v >= 55 && v <= 115;
        hintGood = `Elbows look supportive (${v.toFixed(0)}°).`;
        hintBad = "Bend elbows less (keep ≤ 115°) and lean forward to stack shoulders over hands.";
      }
    } else if (n.includes("tuck")) {
      displayName = "Knee tuck";
      target = "25°–124°";

      if (v < 25) {
        ok = false;
        hintBad =
          "Tuck angle looks unrealistically small — likely a detection/camera issue. Try full body in frame and hold still.";
      } else {
        ok = v < 125;
        hintGood = `Great tuck (${v.toFixed(0)}°).`;
        hintBad = "Pull knees tighter toward arms/chest to improve balance.";
      }
    } else if (n.includes("torso")) {
      displayName = "Torso level";
      target = "< 32";
      ok = v < 32;
      hintGood = "Torso control looks steady.";
      hintBad = "Keep shoulders/hips more level; shift weight slightly forward.";
    } else if (n.includes("feet")) {
      displayName = "Feet lifted";
      target = "Yes";
      ok = v >= 0.5;
      hintGood = "Feet are lifting — nice!";
      hintBad = "Shift weight forward + squeeze knees into arms to float feet.";
    } else if (n.includes("passedcount") || n.includes("checks passed")) {
      displayName = "Checks passed";
      target = "≥ 2–3";
      ok = v >= 2;
      hintGood = "Several key checks passed.";
      hintBad = "Focus on failed checks for a cleaner hold.";
    }
  }

  return { ...m, name: displayName, value: v, ok, target, hint: ok ? hintGood : hintBad };
}

/**
 * Dedupe rules:
 * 1) If one value is clearly invalid and the other isn't -> keep the valid one.
 * 2) Otherwise prefer failures over passes (prevents contradictions).
 * 3) Otherwise keep the one with more info (target+hint).
 */
function dedupeByNamePreferFailures(list: InterpretedMetric[]) {
  const map = new Map<string, InterpretedMetric>();

  for (const m of list) {
    const key = normKey(m.name);

    if (!map.has(key)) {
      map.set(key, m);
      continue;
    }

    const prev = map.get(key)!;

    const prevInvalid = isClearlyInvalidMetricValue(prev.name, prev.value);
    const currInvalid = isClearlyInvalidMetricValue(m.name, m.value);

    if (prevInvalid && !currInvalid) {
      map.set(key, m);
      continue;
    }
    if (!prevInvalid && currInvalid) {
      continue;
    }

    if (prev.ok && !m.ok) {
      map.set(key, m);
      continue;
    }

    const prevInfo = (prev.target ? 1 : 0) + (prev.hint ? 1 : 0);
    const newInfo = (m.target ? 1 : 0) + (m.hint ? 1 : 0);
    if (newInfo > prevInfo) map.set(key, m);
  }

  return Array.from(map.values());
}

/** ---------------- Core metric config ---------------- */
const CORE_METRICS_BY_POSE: Record<PoseKey, string[]> = {
  boat: ["V shape", "Knee extension", "Leg lift", "Checks passed"],
  crow: ["Elbow bend", "Knee tuck", "Torso level", "Feet lifted", "Checks passed"],
  corpse: ["Knee extension", "Body level"], // no checks passed required/displayed by default
};

const REQUIRED_CORE_BY_POSE: Record<PoseKey, string[]> = {
  boat: ["V shape", "Knee extension", "Checks passed"],
  crow: ["Elbow bend", "Knee tuck", "Torso level", "Checks passed"],
  corpse: ["Body level"], // only required for corpse
};

function coreMetricsValid(poseKey: PoseKey, interpreted: InterpretedMetric[]) {
  const required = REQUIRED_CORE_BY_POSE[poseKey] ?? [];
  const map = new Map<string, InterpretedMetric>();
  for (const m of interpreted) map.set(normKey(m.name), m);

  for (const label of required) {
    const metric = map.get(normKey(label));
    if (!metric) return false; // missing
    if (isClearlyInvalidMetricValue(label, metric.value)) return false; // invalid
  }
  return true;
}

function allRequiredCoreOk(poseKey: PoseKey, interpreted: InterpretedMetric[]) {
  const required = REQUIRED_CORE_BY_POSE[poseKey] ?? [];
  const map = new Map<string, InterpretedMetric>();
  for (const m of interpreted) map.set(normKey(m.name), m);

  for (const label of required) {
    const metric = map.get(normKey(label));
    if (!metric) return false;
    if (isClearlyInvalidMetricValue(label, metric.value)) return false;
    if (!metric.ok) return false;
  }
  return true;
}

function buildCoreMetrics(poseKey: PoseKey, interpreted: InterpretedMetric[]) {
  const wanted = CORE_METRICS_BY_POSE[poseKey] ?? [];
  const map = new Map<string, InterpretedMetric>();
  for (const m of interpreted) map.set(normKey(m.name), m);

  return wanted.map((label) => ({ label, metric: map.get(normKey(label)) ?? null }));
}

/** ---------------- Component ---------------- */
export default function Result() {
  const { poseId } = useParams<{ poseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getPose } = useGame();

  const correct = location.state?.correct as boolean | undefined;
  const score = (location.state?.score as number | undefined) ?? 0;
  const videoUrl = location.state?.videoUrl as string | undefined;
  const poseKey = location.state?.poseKey as string | undefined;
  const metrics = (location.state?.metrics as Metric[] | undefined) ?? [];

  const pose = getPose(poseId || "");
  if (!pose) return null;

  const inferredPoseKey: PoseKey =
    poseKey === "boat" || poseKey === "crow" || poseKey === "corpse"
      ? poseKey
      : pose.name?.toLowerCase().includes("boat")
      ? "boat"
      : pose.name?.toLowerCase().includes("crow")
      ? "crow"
      : "corpse";

  const [tipsPage, setTipsPage] = useState<"good" | "improve">("good");
  const [showRewards, setShowRewards] = useState(false);

  useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(videoUrl);
        } catch {
          // ignore
        }
      }
    };
  }, [videoUrl]);

  const interpreted = useMemo(() => {
    const raw = metrics
      .map((m) => interpretMetric(inferredPoseKey, m))
      .filter((m): m is InterpretedMetric => m !== null);

    // ✅ Boat fallback: if Leg lift missing, infer from other signals
    if (inferredPoseKey === "boat") {
      const hasLegLift = raw.some((m) => normKey(m.name) === "leg lift");
      if (!hasLegLift) {
        const vShape = raw.find((m) => normKey(m.name) === "v shape");
        const knee = raw.find((m) => normKey(m.name) === "knee extension");
        const inferredOk = !!vShape?.ok && !!knee?.ok;

        raw.push({
          name: "Leg lift",
          value: inferredOk ? 1 : 0,
          ok: inferredOk,
          target: "Yes",
          hint: inferredOk
            ? "Leg lift looks good (inferred from V shape + knee extension)."
            : "Lift knees/feet a little higher; keep chest proud.",
        });
      }
    }

    return dedupeByNamePreferFailures(raw);
  }, [metrics, inferredPoseKey]);

  const passedCount = getPassedCount(interpreted);
  const threshold = winThresholdForPose(inferredPoseKey);
  const meetsThreshold = threshold !== null && passedCount !== null && passedCount >= threshold;

  const coreValid = coreMetricsValid(inferredPoseKey, interpreted);
  const requiredOk = allRequiredCoreOk(inferredPoseKey, interpreted);

  const isSuccess =
    inferredPoseKey === "corpse"
      ? requiredOk && coreValid
      : (correct === true || meetsThreshold || requiredOk) && coreValid;

  useEffect(() => {
    if (isSuccess) setShowRewards(true);
  }, [isSuccess]);

  const trophiesEarned = isSuccess ? Math.floor(pose.trophyReward * (score / 100)) : 0;

  const coreRows = useMemo(() => buildCoreMetrics(inferredPoseKey, interpreted), [inferredPoseKey, interpreted]);

  const good = useMemo(() => interpreted.filter((m) => m.ok), [interpreted]);
  const improve = useMemo(() => interpreted.filter((m) => !m.ok), [interpreted]);
  const activeList = tipsPage === "good" ? good : improve;

  const showNoImproveButDefeatNote = !isSuccess && improve.length === 0 && good.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 20, opacity: 0.2 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className={`w-64 h-64 rounded-full blur-3xl ${isSuccess ? "bg-yellow-500" : "bg-red-500"}`}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-6 pt-5 pb-6">
        {videoUrl && (
          <div className="w-full max-w-xs mx-auto mb-3 rounded-2xl overflow-hidden border border-slate-800 shadow-lg">
            <video src={videoUrl} controls playsInline className="w-full h-auto max-h-36 object-cover" />
          </div>
        )}

        <div className="w-full max-w-sm mx-auto flex items-center justify-between mb-3">
          <button
            onClick={() => navigate("/")}
            className="w-11 h-11 rounded-full border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 flex items-center justify-center shadow-md transition active:scale-95"
            aria-label="Home"
          >
            <Home className="w-5 h-5" />
          </button>

          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="relative"
          >
            {isSuccess ? (
              <div className="relative">
                <Star className="w-28 h-28 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-black text-yellow-900 drop-shadow-sm">{score}</span>
                </div>
              </div>
            ) : (
              <X className="w-28 h-28 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]" />
            )}
          </motion.div>

          <button
            onClick={() => navigate(`/battle/${poseId}`)}
            className={`w-11 h-11 rounded-full border border-slate-700 bg-slate-900/70 hover:bg-slate-800 text-slate-200 flex items-center justify-center shadow-md transition active:scale-95 ${
              isSuccess ? "opacity-60" : ""
            }`}
            aria-label="Try Again"
            title="Try Again"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <motion.h1
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-4xl font-black text-white mb-1 uppercase tracking-wide drop-shadow-lg text-center"
        >
          {isSuccess ? "Victory!" : "Defeat"}
        </motion.h1>

        <motion.p
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-slate-300 font-medium mb-3 max-w-[320px] mx-auto text-center"
        >
          {isSuccess ? "Your form was excellent! Keep it up." : "Nice effort — check tips and try again."}
        </motion.p>

        {/* Key Metrics */}
        {coreRows.length > 0 && (
          <div className="w-full max-w-sm mx-auto mb-3 bg-slate-900/70 border border-slate-700 rounded-2xl p-4 text-left">
            <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">🎯 Key metrics</div>

            <div className="space-y-2">
              {coreRows.map(({ label, metric }) => {
                const ok = metric?.ok ?? false;
                const showTarget = !!metric?.target?.length;

                return (
                  <div key={label} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-white font-semibold">{label}</div>

                        <span
                          className={`text-[10px] font-black px-2 py-1 rounded-full border ${
                            metric
                              ? ok
                                ? "bg-green-500/10 text-green-300 border-green-500/30"
                                : "bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {metric ? (ok ? "PASS" : "FIX") : "MISSING"}
                        </span>
                      </div>

                      <div className="text-slate-400 text-[11px] leading-snug">
                        {metric ? metric.hint : "Missing metric this run (camera/frame/confidence)."}
                      </div>

                      {metric && showTarget ? (
                        <div className="text-slate-500 text-[11px] leading-snug">Target: {metric.target}</div>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-slate-300 font-mono text-sm">
                      {metric ? formatValue(metric.name, metric.value) : "--"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tips */}
        {interpreted.length > 0 && (
          <div className="w-full max-w-sm mx-auto flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => setTipsPage("good")}
                className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition ${
                  tipsPage === "good"
                    ? "bg-slate-800 border-slate-600 text-white"
                    : "bg-slate-900/30 border-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                ✅ Good
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTipsPage("good")}
                  className={`w-2 h-2 rounded-full ${tipsPage === "good" ? "bg-white" : "bg-slate-600"}`}
                  aria-label="Good page"
                />
                <button
                  onClick={() => setTipsPage("improve")}
                  className={`w-2 h-2 rounded-full ${tipsPage === "improve" ? "bg-white" : "bg-slate-600"}`}
                  aria-label="Improve page"
                />
              </div>

              <button
                onClick={() => setTipsPage("improve")}
                className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition ${
                  tipsPage === "improve"
                    ? "bg-slate-800 border-slate-600 text-white"
                    : "bg-slate-900/30 border-slate-800 text-slate-300 hover:text-white"
                }`}
              >
                🔧 Improve
              </button>
            </div>

            <div className="bg-slate-900/70 border border-slate-700 rounded-2xl p-4 text-left flex-1 overflow-y-auto">
              <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">
                {tipsPage === "good" ? "✅ What you did well" : "🔧 Improve next time"}
              </div>

              {activeList.length === 0 ? (
                <div className="text-slate-400 text-sm">
                  {tipsPage === "good" ? "No strong signals yet — keep practicing." : "Great form — nothing major to fix."}
                </div>
              ) : (
                activeList.map((m) => (
                  <div key={`${m.name}-${m.value}`} className="mb-3">
                    <div className="flex items-center justify-between">
                      <div className="text-white font-semibold">{m.name}</div>
                      <div className="text-slate-300 font-mono text-sm">{formatValue(m.name, m.value)}</div>
                    </div>
                    <div className="text-slate-400 text-xs leading-snug">{m.hint}</div>
                    {m.target ? <div className="text-slate-500 text-[11px] leading-snug">Target: {m.target}</div> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {showNoImproveButDefeatNote && (
          <div className="w-full max-w-sm mx-auto mt-3 bg-slate-800/50 border border-slate-700 rounded-2xl px-4 py-3 text-left">
            <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Why this is “Defeat”</div>
            <div className="text-slate-200 text-sm">
              Your form checks look good, but required pose metrics were missing/invalid, or the detector marked it incorrect.
              Try full body in frame and hold still briefly.
            </div>
          </div>
        )}

        {/* Rewards popup */}
        <AnimatePresence>
          {isSuccess && showRewards && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRewards(false)}
              className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-50 cursor-pointer px-6"
            >
              <motion.div
                initial={{ scale: 0.7, y: 30, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.85, y: -10, opacity: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="bg-slate-800 rounded-3xl p-8 border-2 border-yellow-400 shadow-2xl text-center w-full max-w-xs"
              >
                <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4 animate-bounce" />
                <div className="text-yellow-400 font-black text-3xl mb-2">+{trophiesEarned}</div>
                <div className="text-white font-semibold text-sm mb-3">Rewards Unlocked!</div>
                <div className="text-xs text-slate-400">Tap anywhere to continue</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}