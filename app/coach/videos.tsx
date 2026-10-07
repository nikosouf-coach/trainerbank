// Trainer – Videos: alle Video-Links des Teams (zu Spielen, Spielern, Übungen).
import { useRouter } from "expo-router";
import React, { useState } from "react";
import type { Video } from "../../src/core/types";
import { useEngine } from "../../src/data/store";
import { VideoList, VideoSheet } from "../../src/ui/games";
import { Btn, Card, Header, Screen } from "../../src/ui/kit";

export default function Videos() {
  const E = useEngine(); const { t } = E; const router = useRouter();
  const [video, setVideo] = useState<Video | null | undefined>(undefined);
  return (
    <Screen testID="coach-videos">
      <Header title={t("sp_lib")} onBack={() => router.back()} backLabel={t("mo_title")} right={<Btn testID="vd-new" kind="primary" icon="plus" label={t("vd_add")} onPress={() => setVideo(null)} />} />
      <Card><VideoList videos={E.videosFor()} onEdit={setVideo} /></Card>
      <VideoSheet video={video} onClose={() => setVideo(undefined)} />
    </Screen>
  );
}
