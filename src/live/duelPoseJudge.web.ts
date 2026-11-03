import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";

declare global {
  interface Window {
    immortalPoseVision?: typeof import("@mediapipe/tasks-vision");
  }
}

export type DuelExercise = "pushup" | "pullup";
export type PoseFeedbackKind = "loading" | "setup" | "ready" | "good" | "correct" | "not-visible" | "error";
export type PoseFeedback = { kind: PoseFeedbackKind; message: string; reps: number };

type Point = { x: number; y: number; visibility: number };
type Candidate = { side: "left" | "right"; shoulder: Point; elbow: Point; wrist: Point; hip: Point; knee: Point; ankle: Point; nose: Point; mouthLeft: Point; mouthRight: Point; score: number };
type Evaluation = { feedback: PoseFeedback; points: NormalizedLandmark[] | null; aligned: boolean; elbowAngle: number | null; barY: number | null };

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const MIN_VISIBILITY = 0.55;
const INFERENCE_INTERVAL_MS = 180;

async function loadPoseVision(): Promise<typeof import("@mediapipe/tasks-vision")> {
  if (window.immortalPoseVision) return window.immortalPoseVision;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-immortal-pose-vision="true"]');
    const onReady = () => resolve();
    const onFailure = () => reject(new Error("pose_model_script_failed"));
    window.addEventListener("immortal-pose-vision-ready", onReady, { once: true });
    if (existing) {
      existing.addEventListener("error", onFailure, { once: true });
      if (window.immortalPoseVision) resolve();
      return;
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/pose-vision-loader.js";
    script.dataset.immortalPoseVision = "true";
    script.addEventListener("error", onFailure, { once: true });
    script.addEventListener("load", () => {
      if (window.immortalPoseVision) resolve();
      else reject(new Error("pose_model_module_not_ready"));
    }, { once: true });
    document.head.appendChild(script);
  });
  if (!window.immortalPoseVision) throw new Error("pose_model_module_not_ready");
  return window.immortalPoseVision;
}

function point(landmarks: NormalizedLandmark[], index: number): Point {
  const p = landmarks[index];
  return { x: p.x, y: p.y, visibility: p.visibility ?? p.presence ?? 0 };
}

function angle(a: Point, b: Point, c: Point): number {
  const abx = a.x - b.x, aby = a.y - b.y;
  const cbx = c.x - b.x, cby = c.y - b.y;
  const denominator = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (denominator < 0.0001) return 0;
  const cosine = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / denominator));
  return Math.acos(cosine) * 180 / Math.PI;
}

function distanceFromLine(pointToCheck: Point, start: Point, end: Point): number {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < 0.001) return 1;
  return Math.abs((end.x - start.x) * (start.y - pointToCheck.y) - (start.x - pointToCheck.x) * (end.y - start.y)) / length / length;
}

function chooseSide(landmarks: NormalizedLandmark[], exercise: DuelExercise): Candidate | null {
  const options = [
    { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 },
    { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 },
  ].map((side, index) => {
    const candidate = {
      shoulder: point(landmarks, side.shoulder), elbow: point(landmarks, side.elbow),
      wrist: point(landmarks, side.wrist), hip: point(landmarks, side.hip),
      knee: point(landmarks, side.knee), ankle: point(landmarks, side.ankle), nose: point(landmarks, 0),
      mouthLeft: point(landmarks, 9), mouthRight: point(landmarks, 10),
    };
    const needed = exercise === "pullup"
      ? [candidate.shoulder, candidate.elbow, candidate.wrist, candidate.nose, candidate.mouthLeft, candidate.mouthRight]
      : [candidate.shoulder, candidate.elbow, candidate.wrist, candidate.hip, candidate.ankle];
    return { ...candidate, side: index === 0 ? "left" as const : "right" as const, score: Math.min(...needed.map((p) => p.visibility)) };
  }).sort((a, b) => b.score - a.score);
  return options[0].score >= MIN_VISIBILITY ? options[0] : null;
}

export class DuelPoseJudge {
  private landmarker: PoseLandmarker | null = null;
  private disposed = false;
  private raf = 0;
  private lastInferenceAt = 0;
  private lastVideoTime = -1;
  private phase: "waiting" | "top" | "descending" | "bottom" | "pulling" | "peak" = "waiting";
  private reps = 0;
  private barY: number | null = null;
  private feedback: PoseFeedback;
  private onRep: () => Promise<boolean>;
  private onUpdate: (feedback: PoseFeedback) => void;
  private clickHandler: ((event: PointerEvent) => void) | null = null;

  constructor(
    private video: HTMLVideoElement,
    private canvas: HTMLCanvasElement,
    private exercise: DuelExercise,
    initialReps: number,
    onRep: () => Promise<boolean>,
    onUpdate: (feedback: PoseFeedback) => void,
  ) {
    this.reps = initialReps;
    this.onRep = onRep;
    this.onUpdate = onUpdate;
    this.feedback = {
      kind: "loading",
      message: exercise === "pullup" ? "Prépare l’analyse, puis place le repère sur la barre." : "Prépare l’analyse de tes mouvements…",
      reps: initialReps,
    };
  }

  async start(): Promise<void> {
    this.emit(this.feedback);
    try {
      const { FilesetResolver, PoseLandmarker } = await loadPoseVision();
      const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
      if (this.disposed) return;
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.58,
        minPosePresenceConfidence: 0.58,
        minTrackingConfidence: 0.58,
      });
      if (this.disposed) { this.landmarker.close(); this.landmarker = null; return; }
      if (this.exercise === "pullup") {
        this.feedback = { kind: "setup", message: "Touchez l’image au niveau de la barre pour placer le repère.", reps: this.reps };
        this.clickHandler = (event) => {
          const rect = this.canvas.getBoundingClientRect();
          if (rect.height <= 0) return;
          this.barY = Math.min(0.92, Math.max(0.04, (event.clientY - rect.top) / rect.height));
          this.phase = "waiting";
          this.emit({ kind: "ready", message: "Repère placé. Pars bras tendus, puis dépasse la ligne avec le menton.", reps: this.reps });
        };
        this.canvas.addEventListener("pointerdown", this.clickHandler);
      } else {
        this.feedback = { kind: "ready", message: "Place-toi de profil, corps entier visible, puis commence en haut bras tendus.", reps: this.reps };
      }
      this.emit(this.feedback);
      this.raf = requestAnimationFrame(this.tick);
    } catch (error) {
      if (!this.disposed) {
        this.emit({ kind: "error", message: "Analyse caméra indisponible. Tu peux garder le comptage manuel.", reps: this.reps });
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    if (this.clickHandler) this.canvas.removeEventListener("pointerdown", this.clickHandler);
    this.landmarker?.close();
    this.landmarker = null;
    const context = this.canvas.getContext("2d");
    context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private emit(feedback: PoseFeedback): void {
    this.feedback = feedback;
    this.onUpdate(feedback);
  }

  private recordRep(): void {
    this.reps += 1;
    const acceptedCount = this.reps;
    void this.onRep().then((accepted) => {
      if (this.disposed) return;
      if (!accepted) {
        this.reps = Math.max(0, this.reps - 1);
        this.emit({ kind: "correct", message: "Répétition détectée mais non enregistrée. Le compteur n’a pas été mis à jour.", reps: this.reps });
      } else {
        this.emit({ kind: "good", message: `Répétition ${acceptedCount} ajoutée au score provisoire.`, reps: this.reps });
      }
    }).catch(() => {
      if (!this.disposed) {
        this.reps = Math.max(0, this.reps - 1);
        this.emit({ kind: "correct", message: "Répétition détectée mais non enregistrée. Vérifie ta connexion.", reps: this.reps });
      }
    });
  }

  private tick = (now: number): void => {
    if (this.disposed || !this.landmarker) return;
    this.raf = requestAnimationFrame(this.tick);
    if (this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || this.video.currentTime === this.lastVideoTime || now - this.lastInferenceAt < INFERENCE_INTERVAL_MS) return;
    this.lastInferenceAt = now;
    this.lastVideoTime = this.video.currentTime;
    try {
      const result = this.landmarker.detectForVideo(this.video, now);
      const landmarks = result.landmarks?.[0] ?? null;
      const evaluation = this.evaluate(landmarks);
      this.draw(evaluation);
      if (evaluation.feedback.kind !== this.feedback.kind || evaluation.feedback.message !== this.feedback.message || evaluation.feedback.reps !== this.feedback.reps) {
        this.emit(evaluation.feedback);
      }
    } catch {
      this.emit({ kind: "error", message: "L’analyse s’est interrompue. Réessaie de lancer la caméra.", reps: this.reps });
    }
  };

  private evaluate(landmarks: NormalizedLandmark[] | null): Evaluation {
    if (!landmarks) {
      this.phase = "waiting";
      return { feedback: { kind: "not-visible", message: "Corps non détecté. Recule la caméra et éclaire mieux la pièce.", reps: this.reps }, points: null, aligned: false, elbowAngle: null, barY: this.barY };
    }
    if (this.exercise === "pullup" && this.barY === null) {
      return { feedback: { kind: "setup", message: "Touchez l’image au niveau de la barre pour placer le repère.", reps: this.reps }, points: landmarks, aligned: true, elbowAngle: null, barY: null };
    }
    const side = chooseSide(landmarks, this.exercise);
    if (!side) {
      this.phase = "waiting";
      return { feedback: { kind: "not-visible", message: this.exercise === "pushup" ? "Épaules, hanches ou pieds masqués. Place la caméra de profil." : "Barre, bras ou visage mal visibles. Recule légèrement la caméra.", reps: this.reps }, points: landmarks, aligned: false, elbowAngle: null, barY: this.barY };
    }
    const elbowAngle = angle(side.shoulder, side.elbow, side.wrist);
    if (this.exercise === "pushup") {
      const alignmentError = distanceFromLine(side.hip, side.shoulder, side.ankle);
      const aligned = alignmentError <= 0.12;
      let feedback: PoseFeedback;
      if (!aligned) {
        if (this.phase === "descending" || this.phase === "bottom") this.phase = "waiting";
        feedback = { kind: "correct", message: "Garde les épaules, les hanches et les pieds alignés.", reps: this.reps };
      } else if (this.phase === "waiting" && elbowAngle >= 155) {
        this.phase = "top";
        feedback = { kind: "good", message: "Position de départ validée. Descends jusqu’au repère.", reps: this.reps };
      } else if (this.phase === "top" && elbowAngle < 140) {
        this.phase = "descending";
        feedback = { kind: "ready", message: elbowAngle > 105 ? "Descends encore un peu." : "Bonne profondeur, remonte et tends les bras.", reps: this.reps };
      } else if (this.phase === "descending" && elbowAngle <= 105) {
        this.phase = "bottom";
        feedback = { kind: "good", message: "Bonne profondeur, remonte et tends les bras.", reps: this.reps };
      } else if (this.phase === "descending" && elbowAngle > 155) {
        this.phase = "top";
        feedback = { kind: "correct", message: "Pas comptée : descends jusqu’au repère avant de remonter.", reps: this.reps };
      } else if (this.phase === "bottom" && elbowAngle >= 155) {
        this.phase = "top";
        this.recordRep();
        feedback = { kind: "good", message: "Mouvement validé. Enregistrement du score provisoire…", reps: this.reps };
      } else if (this.phase === "bottom") {
        feedback = { kind: "ready", message: "Remonte et tends complètement les bras.", reps: this.reps };
      } else {
        feedback = { kind: "ready", message: "Corps aligné. Descends jusqu’au repère.", reps: this.reps };
      }
      return { feedback, points: landmarks, aligned, elbowAngle, barY: this.barY };
    }

    const mouthCenter = { x: (side.mouthLeft.x + side.mouthRight.x) / 2, y: (side.mouthLeft.y + side.mouthRight.y) / 2, visibility: Math.min(side.mouthLeft.visibility, side.mouthRight.visibility) };
    const torsoLength = Math.hypot(side.shoulder.x - side.hip.x, side.shoulder.y - side.hip.y);
    // Pose Landmarker has no chin point. Estimate it a small distance below the mouth and keep the verdict provisional.
    const chinEstimate = { ...mouthCenter, y: mouthCenter.y + torsoLength * 0.035 };
    const aligned = true;
    const barPixelY = this.barY ?? 0;
    const chinPixelY = this.mapPoint(chinEstimate).y / Math.max(1, this.canvas.clientHeight);
    let feedback: PoseFeedback;
    if (this.phase === "waiting" && elbowAngle >= 155) {
      this.phase = "top";
      feedback = { kind: "good", message: "Départ bras tendus repéré. Tire vers la barre.", reps: this.reps };
    } else if (this.phase === "top" && elbowAngle < 140) {
      this.phase = "pulling";
      feedback = { kind: "ready", message: "Continue jusqu’à passer le menton au-dessus de la ligne.", reps: this.reps };
    } else if (this.phase === "pulling" && chinPixelY < barPixelY - 0.015) {
      this.phase = "peak";
      feedback = { kind: "good", message: "Haut du mouvement atteint. Redescends bras tendus.", reps: this.reps };
    } else if (this.phase === "pulling" && elbowAngle >= 155) {
      this.phase = "top";
      feedback = { kind: "correct", message: "Pas comptée : le visage n’a pas dépassé la ligne.", reps: this.reps };
    } else if (this.phase === "peak" && elbowAngle >= 155) {
      this.phase = "top";
      this.recordRep();
      feedback = { kind: "good", message: "Mouvement validé. Enregistrement du score provisoire…", reps: this.reps };
    } else if (this.phase === "peak") {
      feedback = { kind: "ready", message: "Redescends jusqu’à tendre complètement les bras.", reps: this.reps };
    } else {
      feedback = { kind: "ready", message: "Pars bras tendus, puis passe le visage au-dessus de la ligne.", reps: this.reps };
    }
    return { feedback, points: landmarks, aligned, elbowAngle, barY: this.barY };
  }

  private mapPoint(pointToMap: Point): { x: number; y: number } {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    const sourceWidth = this.video.videoWidth || width, sourceHeight = this.video.videoHeight || height;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawnWidth = sourceWidth * scale, drawnHeight = sourceHeight * scale;
    return { x: (width - drawnWidth) / 2 + pointToMap.x * drawnWidth, y: (height - drawnHeight) / 2 + pointToMap.y * drawnHeight };
  }

  private draw(evaluation: Evaluation): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(rect.width * dpr) || this.canvas.height !== Math.round(rect.height * dpr)) {
      this.canvas.width = Math.round(rect.width * dpr);
      this.canvas.height = Math.round(rect.height * dpr);
    }
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    if (evaluation.barY !== null) {
      const y = evaluation.barY * rect.height;
      ctx.save();
      ctx.strokeStyle = "#FACC15";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(rect.width, y); ctx.stroke();
      ctx.restore();
    }
    if (!evaluation.points?.length) return;
    const landmarks = evaluation.points;
    const left = [11, 13, 15, 23, 25, 27];
    const right = [12, 14, 16, 24, 26, 28];
    const chosen = chooseSide(landmarks, this.exercise);
    const indexes = chosen?.side === "left" ? left : right;
    const color = evaluation.aligned ? "#34D399" : "#F59E0B";
    const pairs = [[indexes[0], indexes[1]], [indexes[1], indexes[2]], [indexes[0], indexes[3]], [indexes[3], indexes[4]], [indexes[4], indexes[5]]];
    const mirror = this.video.style.transform.includes("scaleX(-1)");
    ctx.save();
    if (mirror) { ctx.translate(rect.width, 0); ctx.scale(-1, 1); }
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, rect.width * 0.009);
    ctx.lineCap = "round";
    for (const [from, to] of pairs) {
      const a = this.mapPoint(point(landmarks, from)), b = this.mapPoint(point(landmarks, to));
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.fillStyle = color;
    for (const index of indexes) {
      const p = this.mapPoint(point(landmarks, index));
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(3, rect.width * 0.014), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}
