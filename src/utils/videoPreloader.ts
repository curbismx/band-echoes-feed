// Video preloading utilities for instant playback

export interface PreloadedVideo {
  url: string;
  videoElement: HTMLVideoElement;
  isReady: boolean;
  bufferedSeconds: number;
}

class VideoPreloaderManager {
  private preloadedVideos: Map<string, PreloadedVideo> = new Map();
  private maxPreloadedVideos = 3; // Keep max 3 videos in memory

  preloadVideo(url: string, posterUrl?: string): Promise<PreloadedVideo> {
    // Return existing if already preloading
    if (this.preloadedVideos.has(url)) {
      return Promise.resolve(this.preloadedVideos.get(url)!);
    }

    const video = document.createElement('video');
    video.preload = 'auto';
    video.playsInline = true;
    video.muted = true; // Preload muted for autoplay policy compliance
    video.crossOrigin = 'anonymous';
    video.style.display = 'none';
    
    if (posterUrl) {
      video.poster = posterUrl;
    }

    const preloadedVideo: PreloadedVideo = {
      url,
      videoElement: video,
      isReady: false,
      bufferedSeconds: 0,
    };

    this.preloadedVideos.set(url, preloadedVideo);

    return new Promise((resolve) => {
      let resolved = false;

      const onCanPlay = () => {
        if (!resolved) {
          resolved = true;
          preloadedVideo.isReady = true;
          preloadedVideo.bufferedSeconds = this.getBufferedSeconds(video);
          resolve(preloadedVideo);
        }
      };

      const onProgress = () => {
        preloadedVideo.bufferedSeconds = this.getBufferedSeconds(video);
        
        // Resolve as soon as we have ~0.5 seconds buffered
        if (!resolved && preloadedVideo.bufferedSeconds >= 0.5) {
          resolved = true;
          preloadedVideo.isReady = true;
          resolve(preloadedVideo);
        }
      };

      video.addEventListener('canplay', onCanPlay, { once: true });
      video.addEventListener('progress', onProgress);
      video.addEventListener('error', () => {
        console.error('Preload error for:', url);
        if (!resolved) {
          resolved = true;
          resolve(preloadedVideo);
        }
      });

      // Timeout fallback - resolve after 3 seconds regardless
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(preloadedVideo);
        }
      }, 3000);

      video.src = url;
      video.load();
    });
  }

  getPreloadedVideo(url: string): PreloadedVideo | null {
    return this.preloadedVideos.get(url) || null;
  }

  releaseVideo(url: string): void {
    const preloaded = this.preloadedVideos.get(url);
    if (preloaded) {
      try {
        preloaded.videoElement.pause();
        preloaded.videoElement.src = '';
        preloaded.videoElement.load();
        preloaded.videoElement.remove();
      } catch (e) {
        console.warn('Error releasing video:', e);
      }
      this.preloadedVideos.delete(url);
    }
  }

  cleanup(): void {
    // Keep only recent videos, release others
    if (this.preloadedVideos.size > this.maxPreloadedVideos) {
      const urls = Array.from(this.preloadedVideos.keys());
      const toRemove = urls.slice(0, urls.length - this.maxPreloadedVideos);
      toRemove.forEach(url => this.releaseVideo(url));
    }
  }

  private getBufferedSeconds(video: HTMLVideoElement): number {
    try {
      if (video.buffered.length > 0) {
        return video.buffered.end(0) - video.buffered.start(0);
      }
    } catch (e) {
      // Ignore
    }
    return 0;
  }

  clearAll(): void {
    this.preloadedVideos.forEach((_, url) => this.releaseVideo(url));
    this.preloadedVideos.clear();
  }
}

export const videoPreloader = new VideoPreloaderManager();
