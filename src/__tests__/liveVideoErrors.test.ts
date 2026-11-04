import { liveVideoErrorMessage } from "../domain/liveVideoErrors";

describe("liveVideoErrorMessage", () => {
  it("explains that uploaded attempts do not depend on live streaming", () => {
    expect(liveVideoErrorMessage("live_video_not_configured")).toContain("Filmer puis envoyer une vidéo reste possible");
    expect(liveVideoErrorMessage("live_video_not_configured")).toContain("LiveKit");
  });

  it("explains the scheduled live window", () => {
    expect(liveVideoErrorMessage("live_event_not_started")).toContain("30 minutes");
  });

  it("explains a server 503 without blaming the camera", () => {
    expect(liveVideoErrorMessage(undefined, 503)).toContain("LiveKit");
    expect(liveVideoErrorMessage(undefined, 503)).toContain("envoyer une vidéo");
  });

  it("keeps a useful fallback for unexpected failures", () => {
    expect(liveVideoErrorMessage()).toContain("serveur live");
  });
});
