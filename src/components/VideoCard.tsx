import { useEffect, useRef } from "react";

interface Video {
  id: string;
  artistName: string;
  artistUserId: string;
  videoUrl: string;
  likes: number;
  rating: number;
  isFollowing: boolean;
  title?: string;
  caption?: string;
  links?: Array<{ url: string }>;
  posterUrl?: string;
}

interface VideoCardProps {
  video: Video;
}

export const VideoCard = ({ video }: VideoCardProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoClick = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Ensure iOS inline playback attributes
    try {
      v.setAttribute('playsinline', 'true');
      v.setAttribute('webkit-playsinline', 'true');
    } catch {}

    const onVis = () => {
      if (document.visibilityState !== 'visible') v.pause();
    };
    document.addEventListener('visibilitychange', onVis);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const p = v.play();
            if (p && typeof (p as any).catch === 'function') {
              (p as Promise<void>).catch(() => {});
            }
          } else {
            v.pause();
          }
        });
      },
      { threshold: [0, 0.6, 1] }
    );

    observer.observe(v);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src={video.videoUrl}
      autoPlay
      muted
      playsInline
      preload="metadata"
      onClick={handleVideoClick}
      style={{ width: "100%", height: "100%", objectFit: "cover", background: "transparent", cursor: "pointer" }}
    />
  );
};
