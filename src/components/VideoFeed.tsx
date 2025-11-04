import { useState, useRef, useEffect } from "react";
import { VideoCard } from "./VideoCard";

// Test videos
const mockVideos = [
  {
    id: 1,
    artistName: "The Rising Stars",
    artistUserId: "00000000-0000-0000-0000-000000000001",
    videoUrl: "/videos/video1.mp4",
    likes: 1234,
    rating: 8.7,
    isFollowing: false,
  },
  {
    id: 2,
    artistName: "The Midnight Keys",
    artistUserId: "00000000-0000-0000-0000-000000000002",
    videoUrl: "/videos/video2.mp4",
    likes: 892,
    rating: 9.2,
    isFollowing: true,
  },
  {
    id: 3,
    artistName: "Luna Eclipse",
    artistUserId: "00000000-0000-0000-0000-000000000003",
    videoUrl: "/videos/video3.mp4",
    likes: 2156,
    rating: 7.8,
    isFollowing: false,
  },
];

export const VideoFeed = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(0);
    setTouchStart(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isUpSwipe = distance > minSwipeDistance;
    const isDownSwipe = distance < -minSwipeDistance;

    if (isUpSwipe && currentIndex < mockVideos.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }

    if (isDownSwipe && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" && currentIndex < mockVideos.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
      if (e.key === "ArrowUp" && currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex]);

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="relative h-full transition-transform duration-500 ease-out"
        style={{
          transform: `translateY(-${currentIndex * 100}vh)`,
        }}
      >
        {mockVideos.map((video, index) => (
          <VideoCard
            key={video.id}
            video={video}
            isActive={index === currentIndex}
            isMuted={isMuted}
            onUnmute={() => setIsMuted(false)}
          />
        ))}
      </div>

      {/* Progress indicator dots */}
      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 gap-1 z-50">
        {mockVideos.map((_, index) => (
          <div
            key={index}
            className={`h-1 rounded-full transition-all duration-300 ${
              index === currentIndex
                ? "w-8 bg-primary"
                : "w-1 bg-white/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
};
