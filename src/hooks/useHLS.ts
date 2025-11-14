import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface UseHLSOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  src: string;
  isActive: boolean;
}

export const useHLS = ({ videoRef, src, isActive }: UseHLSOptions) => {
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    // Check if source is HLS (.m3u8)
    const isHLS = src.includes('.m3u8');

    if (isHLS && Hls.isSupported()) {
      // Use HLS.js for adaptive streaming
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000, // 60MB
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.1,
        nudgeMaxRetry: 3,
        maxFragLookUpTolerance: 0.25,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        liveDurationInfinity: false,
        progressive: true,
        startFragPrefetch: true,
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, starting playback');
        video.play().catch(e => console.log('HLS autoplay prevented:', e));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          console.error('HLS fatal error:', data);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    } else if (isHLS && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src;
      video.load();
    } else {
      // Progressive MP4
      video.src = src;
      video.load();
    }
  }, [src, isActive, videoRef]);

  return { hlsInstance: hlsRef.current };
};
