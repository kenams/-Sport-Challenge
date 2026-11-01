import { Platform } from "react-native";

export type AiCheckStatus = "ok" | "flagged" | "skipped" | "error";

export type AiCheckResult = {
  status: AiCheckStatus;
  score?: number;
  duration?: number;
  reason?: string;
};

type AiCheckOptions = {
  minDuration?: number;
  sampleCount?: number;
  motionThreshold?: number;
  motionWarnThreshold?: number;
  motionBlockThreshold?: number;
};

export async function runSimpleAiCheck(
  videoUri: string,
  options: AiCheckOptions = {}
): Promise<AiCheckResult> {
  if (Platform.OS !== "web") {
    return { status: "skipped", reason: "non_web" };
  }
  if (typeof document === "undefined") {
    return { status: "skipped", reason: "no_dom" };
  }

  const minDuration = options.minDuration ?? 3;
  const sampleCount = options.sampleCount ?? 5;
  const motionWarnThreshold =
    options.motionWarnThreshold ?? options.motionThreshold ?? 0.012;
  const motionBlockThreshold = options.motionBlockThreshold ?? 0.006;

  try {
    const video = document.createElement("video") as any;
    video.src = videoUri;
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("video_load_failed"));
      };
      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
      };
      video.addEventListener("loadedmetadata", onLoaded);
      video.addEventListener("error", onError);
      video.load();
    });

    const duration = Number(video.duration || 0);
    if (!duration || duration < minDuration) {
      return { status: "flagged", reason: "too_short", duration };
    }

    const canvas = document.createElement("canvas") as any;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { status: "error", reason: "no_canvas" };
    }

    const baseWidth = 160;
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 360;
    const ratio = baseWidth / videoWidth;
    const baseHeight = Math.max(90, Math.round(videoHeight * ratio));
    canvas.width = baseWidth;
    canvas.height = baseHeight;

    const maxWindow = Math.min(duration - 0.2, 5);
    const step = maxWindow / (sampleCount + 1);
    const times = Array.from({ length: sampleCount }, (_, idx) =>
      Math.min(duration - 0.1, step * (idx + 1))
    );

    let previousData: Uint8ClampedArray | null = null;
    let totalDiff = 0;
    let diffCount = 0;

    const seekTo = (time: number) =>
      new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("seek_failed"));
        };
        const cleanup = () => {
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onError);
        };
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("error", onError);
        video.currentTime = time;
      });

    for (const time of times) {
      await seekTo(time);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
      ).data;

      if (previousData) {
        let diff = 0;
        let count = 0;
        const stride = 16;
        for (let i = 0; i < frame.length; i += 4 * stride) {
          diff += Math.abs(frame[i] - previousData[i]);
          diff += Math.abs(frame[i + 1] - previousData[i + 1]);
          diff += Math.abs(frame[i + 2] - previousData[i + 2]);
          count += 3;
        }
        if (count > 0) {
          totalDiff += diff / (count * 255);
          diffCount += 1;
        }
      }
      previousData = frame;
    }

    const motionScore = diffCount ? totalDiff / diffCount : 0;
    if (motionScore < motionBlockThreshold) {
      return {
        status: "flagged",
        reason: "low_motion",
        score: Number(motionScore.toFixed(4)),
        duration,
      };
    }

    if (motionScore < motionWarnThreshold) {
      return {
        status: "ok",
        reason: "low_motion_soft",
        score: Number(motionScore.toFixed(4)),
        duration,
      };
    }

    return {
      status: "ok",
      score: Number(motionScore.toFixed(4)),
      duration,
    };
  } catch (error: any) {
    return { status: "error", reason: error?.message || "unknown" };
  }
}