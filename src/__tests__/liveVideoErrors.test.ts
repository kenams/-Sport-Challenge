import { liveVideoErrorMessage } from "../domain/liveVideoErrors";

describe("liveVideoErrorMessage", () => {
  it("explains that uploaded attempts do not depend on live streaming", () => {
    expect(liveVideoErrorMessage("live_video_not_configured")).toContain("Filmer puis envoyer une vidéo reste possible");
    expect(liveVideoErrorMessage("live_video_not_configured")).toContain("LiveKit");
  });

  it("explains the scheduled live window", () => {
    expect(liveVideoErrorMessage("live_event_not_started")).toContain("30 minutes");
  });

  it("keeps a useful fallback for unexpected failures", () => {
    expect(liveVideoErrorMessage()).toContain("serveur live");
  });
});
