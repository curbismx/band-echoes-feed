import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export interface CompressionProgress {
  progress: number;
  time: number;
  status: string;
}

export const loadFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();
  
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
};

export const compressVideo = async (
  file: File,
  onProgress?: (progress: CompressionProgress) => void
): Promise<Blob> => {
  const ffmpeg = await loadFFmpeg();

  // Set up progress listener
  ffmpeg.on("progress", ({ progress, time }) => {
    if (onProgress) {
      onProgress({
        progress: Math.round(progress * 100),
        time,
        status: `Compressing... ${Math.round(progress * 100)}%`,
      });
    }
  });

  // Write input file
  await ffmpeg.writeFile("input.mp4", await fetchFile(file));

  // Compress with high quality settings
  // CRF 23 is good quality, lower = better quality but larger file
  // preset 'medium' balances speed and compression
  await ffmpeg.exec([
    "-i", "input.mp4",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y",
    "output.mp4"
  ]);

  // Read output file
  const data = await ffmpeg.readFile("output.mp4") as Uint8Array;
  
  // Clean up
  await ffmpeg.deleteFile("input.mp4");
  await ffmpeg.deleteFile("output.mp4");

  // Convert to standard Uint8Array to avoid SharedArrayBuffer issues
  const standardArray = new Uint8Array(data);
  return new Blob([standardArray], { type: "video/mp4" });
};

export const getVideoSize = (file: File | Blob): number => {
  return file.size;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
};
