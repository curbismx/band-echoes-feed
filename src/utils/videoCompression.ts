import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export interface CompressionProgress {
  progress: number;
  time: number;
  status: string;
}

interface VideoMetadata {
  width: number;
  height: number;
  isLandscape: boolean;
}

const getVideoMetadata = async (file: File): Promise<VideoMetadata> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      URL.revokeObjectURL(video.src);
      resolve({
        width,
        height,
        isLandscape: width > height
      });
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video metadata'));
    };
    
    video.src = URL.createObjectURL(file);
  });
};

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
  try {
    const ffmpeg = await loadFFmpeg();
    
    // Get video metadata to check if we need to crop
    console.log('Getting video metadata...');
    const metadata = await getVideoMetadata(file);
    console.log('Video metadata:', metadata);
    
    if (metadata.isLandscape) {
      console.log('🎬 LANDSCAPE VIDEO DETECTED - Will crop to square');
    }

    // Set up progress listener
    ffmpeg.on("progress", ({ progress, time }) => {
      if (onProgress) {
        onProgress({
          progress: Math.round(progress * 100),
          time,
          status: metadata.isLandscape 
            ? `Cropping to square... ${Math.round(progress * 100)}%`
            : `Compressing... ${Math.round(progress * 100)}%`,
        });
      }
    });

    // Write input file
    await ffmpeg.writeFile("input.mp4", await fetchFile(file));

    try {
      // Build FFmpeg command based on whether video is landscape
      const ffmpegArgs = ["-i", "input.mp4"];
      
      if (metadata.isLandscape) {
        // Crop landscape video to square (centered)
        const cropFilter = `crop=${metadata.height}:${metadata.height}:${Math.round((metadata.width - metadata.height) / 2)}:0`;
        ffmpegArgs.push("-vf", cropFilter);
        console.log('🎬 Applying crop filter:', cropFilter);
      }
      
      // Add compression settings
      ffmpegArgs.push(
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-c:a", "copy",
        "-movflags", "+faststart",
        "-y",
        "output.mp4"
      );
      
      console.log('Executing FFmpeg with args:', ffmpegArgs.join(' '));
      await ffmpeg.exec(ffmpegArgs);
    } catch (error) {
      console.log("Audio copy failed, retrying with high-quality AAC encoding...");
      
      // Fallback: Re-encode audio with high-quality AAC if copy fails
      const ffmpegArgs = ["-i", "input.mp4"];
      
      if (metadata.isLandscape) {
        const cropFilter = `crop=${metadata.height}:${metadata.height}:${Math.round((metadata.width - metadata.height) / 2)}:0`;
        ffmpegArgs.push("-vf", cropFilter);
        console.log('🎬 Applying crop filter (retry):', cropFilter);
      }
      
      ffmpegArgs.push(
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "320k",
        "-movflags", "+faststart",
        "-y",
        "output.mp4"
      );
      
      await ffmpeg.exec(ffmpegArgs);
    }

    // Read output file
    const data = await ffmpeg.readFile("output.mp4") as Uint8Array;
    
    // Clean up
    await ffmpeg.deleteFile("input.mp4");
    await ffmpeg.deleteFile("output.mp4");

    // Convert to standard Uint8Array to avoid SharedArrayBuffer issues
    const standardArray = new Uint8Array(data);
    console.log('✅ Video processing complete');
    return new Blob([standardArray], { type: "video/mp4" });
  } catch (error) {
    console.error('❌ Video processing failed:', error);
    throw error;
  }
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
