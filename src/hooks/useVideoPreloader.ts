import { useEffect, useState, useCallback } from 'react';
import { videoPreloader, PreloadedVideo } from '@/utils/videoPreloader';

interface Video {
  id: string;
  videoUrl: string;
  posterUrl?: string;
}

export const useVideoPreloader = (
  videos: Video[],
  currentIndex: number
) => {
  const [preloadStatus, setPreloadStatus] = useState<Map<string, boolean>>(new Map());

  // Preload current, next, and next+1 videos
  const preloadVideos = useCallback(async () => {
    if (videos.length === 0) return;

    const indicesToPreload = [
      currentIndex,
      currentIndex + 1,
      currentIndex + 2,
    ].filter(i => i >= 0 && i < videos.length);

    // Preload in priority order
    for (const index of indicesToPreload) {
      const video = videos[index];
      if (!video) continue;

      try {
        await videoPreloader.preloadVideo(video.videoUrl, video.posterUrl);
        setPreloadStatus(prev => new Map(prev).set(video.id, true));
      } catch (e) {
        console.error('Preload failed:', video.videoUrl, e);
      }
    }

    // Cleanup old videos
    videoPreloader.cleanup();
  }, [videos, currentIndex]);

  useEffect(() => {
    preloadVideos();
  }, [preloadVideos]);

  // Release videos that are far from current index
  useEffect(() => {
    const indicesToKeep = new Set([
      currentIndex - 1,
      currentIndex,
      currentIndex + 1,
      currentIndex + 2,
    ]);

    videos.forEach((video, index) => {
      if (!indicesToKeep.has(index)) {
        videoPreloader.releaseVideo(video.videoUrl);
        setPreloadStatus(prev => {
          const next = new Map(prev);
          next.delete(video.id);
          return next;
        });
      }
    });
  }, [currentIndex, videos]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      videoPreloader.clearAll();
    };
  }, []);

  const getPreloadedVideo = useCallback(
    (videoUrl: string): PreloadedVideo | null => {
      return videoPreloader.getPreloadedVideo(videoUrl);
    },
    []
  );

  const isPreloaded = useCallback(
    (videoId: string): boolean => {
      return preloadStatus.get(videoId) || false;
    },
    [preloadStatus]
  );

  return {
    getPreloadedVideo,
    isPreloaded,
    preloadStatus,
  };
};
