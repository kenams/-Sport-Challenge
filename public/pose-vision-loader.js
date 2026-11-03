import * as vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/vision_bundle.mjs";

window.immortalPoseVision = vision;
window.dispatchEvent(new Event("immortal-pose-vision-ready"));
