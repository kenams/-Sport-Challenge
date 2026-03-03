// src/utils/videoUpload.ts
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { Platform } from "react-native";

type UploadPayload = {
  data: ArrayBuffer | Blob;
  contentType: string;
};

export async function getVideoUploadPayload(
  uri: string
): Promise<UploadPayload> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return {
      data: blob,
      contentType: blob.type || "video/mp4",
    };
  }

  const base64Video = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const fileData = decode(base64Video);
  return {
    data: fileData,
    contentType: "video/mp4",
  };
}