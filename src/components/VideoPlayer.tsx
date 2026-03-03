// src/components/VideoPlayer.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  StyleProp,
  View,
  ViewStyle,
  TouchableOpacity,
  StyleSheet,
  Platform,
  AppState,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { FontAwesome5 } from "@expo/vector-icons";

type VideoFit = "contain" | "cover" | "fill";

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  contentFit?: VideoFit;
  nativeControls?: boolean;
  shouldPlay?: boolean;
  autoPlay?: boolean;
  isActive?: boolean;
  isMuted?: boolean;
  isLooping?: boolean;
  previewSeconds?: number;
  onPreviewEnd?: () => void;
  allowUserToggle?: boolean;
  showOverlayIcon?: boolean;
  showControlButton?: boolean;
};

export default function VideoPlayer({
  uri,
  style,
  contentFit = "contain",
  nativeControls = true,
  shouldPlay = false,
  autoPlay = true,
  isActive = true,
  isMuted = false,
  isLooping = false,
  previewSeconds,
  onPreviewEnd,
  allowUserToggle = false,
  showOverlayIcon = true,
  showControlButton = true,
}: Props) {
  const [userPlaying, setUserPlaying] = useState(autoPlay);
  const [hasInteracted, setHasInteracted] = useState(false);
  const effectiveShouldPlay = useMemo(
    () => shouldPlay && userPlaying,
    [shouldPlay, userPlaying]
  );

  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = isLooping;
    videoPlayer.muted = isMuted;
    if (effectiveShouldPlay) {
      videoPlayer.play();
    }
  });

  useEffect(() => {
    player.loop = isLooping;
    player.muted = isMuted;
    if (effectiveShouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, effectiveShouldPlay, isMuted, isLooping]);

  useEffect(() => {
    if (isActive) return;
    setHasInteracted(true);
    setUserPlaying(false);
    player.pause();
  }, [isActive, player]);

  useEffect(() => {
    if (!previewSeconds || !effectiveShouldPlay) return;
    const timer = setTimeout(() => {
      player.pause();
      setUserPlaying(false);
      onPreviewEnd?.();
    }, previewSeconds * 1000);
    return () => clearTimeout(timer);
  }, [player, previewSeconds, effectiveShouldPlay, onPreviewEnd]);

  useEffect(() => {
    if (!allowUserToggle) {
      setUserPlaying(shouldPlay && autoPlay && !hasInteracted);
      return;
    }
    if (!shouldPlay) {
      setUserPlaying(false);
      return;
    }
    if (!hasInteracted) {
      setUserPlaying(autoPlay);
    }
  }, [allowUserToggle, shouldPlay, autoPlay, hasInteracted]);

  const handleToggle = () => {
    if (!allowUserToggle || !shouldPlay) return;
    setHasInteracted(true);
    setUserPlaying((prev) => !prev);
  };

  useEffect(() => {
    if (!allowUserToggle || Platform.OS !== "web") return;
    const handler = (event: KeyboardEvent) => {
      if (!shouldPlay) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (target as any)?.isContentEditable) {
        return;
      }
      if (event.code === "Space" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        setHasInteracted(true);
        setUserPlaying((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [allowUserToggle, shouldPlay]);

  useEffect(() => {
    if (Platform.OS === "web") {
      const handleVisibility = () => {
        if (document.visibilityState === "hidden") {
          setHasInteracted(true);
          setUserPlaying(false);
          player.pause();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);
      return () => document.removeEventListener("visibilitychange", handleVisibility);
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        setHasInteracted(true);
        setUserPlaying(false);
        player.pause();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  if (!allowUserToggle) {
    return (
      <VideoView
        player={player}
        style={style}
        nativeControls={nativeControls}
        contentFit={contentFit}
      />
    );
  }

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleToggle}
        style={StyleSheet.absoluteFill}
      >
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          nativeControls={nativeControls}
          contentFit={contentFit}
        />
        {showOverlayIcon && !userPlaying && (
          <View style={styles.overlay}>
            <View style={styles.overlayBadge}>
              <FontAwesome5 name="play" size={20} color="#F8FAFC" />
            </View>
          </View>
        )}
        {showControlButton && (
          <View style={styles.controlWrap}>
            <View style={styles.controlButton}>
              <FontAwesome5
                name={userPlaying ? "pause" : "play"}
                size={12}
                color="#F8FAFC"
              />
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  overlayBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(15,23,42,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlWrap: {
    position: "absolute",
    right: 10,
    top: 10,
  },
  controlButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(2,6,23,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});