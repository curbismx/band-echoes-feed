// Extend HTMLVideoElement to include captureStream (not in standard TS definitions)
interface HTMLVideoElementWithCapture extends HTMLVideoElement {
  captureStream(): MediaStream;
}

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

const cropVideoToSquare = async (
  file: File,
  metadata: VideoMetadata,
  onProgress?: (progress: CompressionProgress) => void
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // 1. Create hidden video element to play the source
    const video = document.createElement('video');
    video.muted = true; // Mute to allow autoplay
    video.playsInline = true;
    
    // 2. Create canvas with square dimensions
    const canvas = document.createElement('canvas');
    const size = metadata.height; // Use height as square size
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }
    
    // 3. Calculate crop offset (center crop)
    const offsetX = Math.round((metadata.width - metadata.height) / 2);
    
    // 4. Set up video event handlers
    video.onloadedmetadata = () => {
      const duration = video.duration;
      
      // Get canvas stream at 30fps
      const canvasStream = canvas.captureStream(30);
      
      // Get audio from the original video and add to stream
      const videoStream = (video as HTMLVideoElementWithCapture).captureStream();
      const audioTracks = videoStream.getAudioTracks();
      if (audioTracks.length > 0) {
        canvasStream.addTrack(audioTracks[0]);
      }
      
      // Set up MediaRecorder with fallback codec support
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }
      
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(canvasStream, { mimeType });
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        URL.revokeObjectURL(video.src);
        resolve(blob);
      };
      
      recorder.onerror = (e) => {
        URL.revokeObjectURL(video.src);
        reject(new Error('MediaRecorder error: ' + e));
      };
      
      // Draw frames at ~30fps
      const drawFrame = () => {
        if (video.paused || video.ended) return;
        
        // Draw cropped region from center
        ctx.drawImage(
          video,
          offsetX, 0, size, size,  // Source: crop from center
          0, 0, size, size          // Destination: full canvas
        );
        
        // Report progress
        if (onProgress) {
          const progress = Math.min(Math.round((video.currentTime / duration) * 100), 99);
          onProgress({
            progress,
            time: video.currentTime,
            status: `Cropping to square... ${progress}%`
          });
        }
        
        requestAnimationFrame(drawFrame);
      };
      
      // Start recording and playing
      recorder.start();
      video.play().catch(err => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to play video: ' + err));
      });
      drawFrame();
      
      // Stop when video ends
      video.onended = () => {
        if (onProgress) {
          onProgress({
            progress: 100,
            time: duration,
            status: 'Finalizing...'
          });
        }
        recorder.stop();
      };
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video'));
    };
    
    video.src = URL.createObjectURL(file);
  });
};

export const compressVideo = async (
  file: File,
  cropMode: 'auto' | 'crop' | 'original',
  onProgress?: (progress: CompressionProgress) => void
): Promise<Blob> => {
  try {
    const metadata = await getVideoMetadata(file);
    console.log('📐 Video metadata:', metadata);
    console.log('🎛️ Crop mode:', cropMode);
    
    // Decide whether to crop based on mode
    let shouldCrop = false;
    if (cropMode === 'crop') {
      shouldCrop = true;
      console.log('🎬 FORCE CROP - User selected crop to square');
    } else if (cropMode === 'auto' && metadata.isLandscape) {
      shouldCrop = true;
      console.log('🎬 AUTO CROP - Landscape video detected, cropping to square');
    } else {
      console.log('✅ Keeping original format - no cropping');
    }
    
    if (shouldCrop) {
      return await cropVideoToSquare(file, metadata, onProgress);
    }
    
    return file; // Return original
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
