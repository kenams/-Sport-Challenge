jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("../supabase", () => ({ supabase: {} }));
jest.mock("../services/api", () => ({ describeError: () => "Erreur réseau", submitAttempt: jest.fn() }));

import { checkVideoCandidate, MAX_VIDEO_BYTES, readWebVideoDuration } from "../services/video";

describe("preuves vidéo", () => {
  const video = { uri: "blob:test", mimeType: "video/webm", fileSize: 1200, durationSeconds: 120 };
  it("accepte exactement les limites du format", () => {
    expect(checkVideoCandidate({ ...video, fileSize: MAX_VIDEO_BYTES }, 120).ok).toBe(true);
  });
  it("ne tronque pas une durée légèrement supérieure à la limite", () => {
    expect(checkVideoCandidate({ ...video, durationSeconds: 120.1 }, 120).ok).toBe(false);
  });
  it("réévalue une vidéo de tractions après sélection du format pompes", () => {
    const longer = { ...video, durationSeconds: 150 };
    expect(checkVideoCandidate(longer, 180).ok).toBe(true);
    expect(checkVideoCandidate(longer, 120).ok).toBe(false);
  });
  it.each([0, -1, NaN, Infinity])("refuse une taille invalide : %s", (fileSize) => {
    expect(checkVideoCandidate({ ...video, fileSize }, 120).ok).toBe(false);
  });
  it.each([0, -1, NaN, Infinity])("refuse une durée invalide : %s", (durationSeconds) => {
    expect(checkVideoCandidate({ ...video, durationSeconds }, 120).ok).toBe(false);
  });
  it("refuse un fichier trop lourd ou un type non pris en charge", () => {
    expect(checkVideoCandidate({ ...video, fileSize: MAX_VIDEO_BYTES + 1 }, 120).ok).toBe(false);
    expect(checkVideoCandidate({ ...video, mimeType: "image/png" }, 120).ok).toBe(false);
  });
});

describe("métadonnées web", () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  afterEach(() => {
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else delete (globalThis as any).document;
  });
  function element(duration: number) {
    const video: any = { duration, removeAttribute: jest.fn(), load: jest.fn() };
    Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => video } });
    return video;
  }
  it("lit la durée et libère la ressource", async () => {
    const video = element(60.25);
    const result = readWebVideoDuration("blob:local");
    video.onloadedmetadata();
    await expect(result).resolves.toBe(60.25);
    expect(video.removeAttribute).toHaveBeenCalledWith("src");
    expect(video.onloadedmetadata).toBeNull();
  });
  it("résout un WebM sans durée initiale", async () => {
    const video = element(Infinity);
    const result = readWebVideoDuration("blob:recording");
    video.onloadedmetadata();
    expect(video.currentTime).toBe(1e10);
    video.duration = 64.5;
    video.ondurationchange();
    await expect(result).resolves.toBe(64.5);
  });
  it("refuse un média illisible", async () => {
    const video = element(NaN);
    const result = readWebVideoDuration("blob:broken");
    video.onerror();
    await expect(result).rejects.toThrow("video_metadata_unavailable");
  });
});


import * as media from "../services/video";
import { submitAttempt } from "../services/api";
import { sendAttempt } from "../screens/helpers/sendAttempt";

describe("envoi d'une tentative", () => {
  afterEach(() => jest.restoreAllMocks());
  it("bloque une vidéo trop longue après changement de format avant tout transfert", async () => {
    const upload = jest.spyOn(media, "uploadAttemptVideo");
    const result = await sendAttempt({ userId: "u1", format: "pushups_60s", score: 20,
      video: { uri: "blob:test", fileSize: 1200, durationSeconds: 150, mimeType: "video/webm" } });
    expect(result.ok).toBe(false);
    expect(upload).not.toHaveBeenCalled();
  });
  it("nettoie le fichier envoyé si le serveur refuse la tentative", async () => {
    jest.spyOn(media, "uploadAttemptVideo").mockResolvedValue({ ok: true, path: "u1/test.webm" });
    const discard = jest.spyOn(media, "discardUploadedVideo").mockResolvedValue(undefined);
    (submitAttempt as jest.Mock).mockResolvedValue({ data: null, error: "Défi indisponible" });
    const result = await sendAttempt({ userId: "u1", format: "pushups_60s", score: 20,
      video: { uri: "blob:test", fileSize: 1200, durationSeconds: 60, mimeType: "video/webm" } });
    expect(result).toEqual({ ok: false, message: "Défi indisponible" });
    expect(discard).toHaveBeenCalledWith("u1/test.webm");
  });
});
