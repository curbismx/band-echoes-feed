import { useState, useRef, useEffect } from "react";
import { VideoCard } from "./VideoCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";

// Test videos - will use current user's ID
const getMockVideos = (userId: string) => [
  {
    id: 1,
    artistName: "The Rising Stars",
    artistUserId: userId,
    videoUrl: "/videos/video1.mp4",
    likes: 1234,
    rating: 8.7,
    isFollowing: false,
  },
  {
    id: 2,
    artistName: "The Midnight Keys",
    artistUserId: userId,
    videoUrl: "/videos/video2.mp4",
    likes: 892,
    rating: 9.2,
    isFollowing: true,
  },
  {
    id: 3,
    artistName: "Luna Eclipse",
    artistUserId: userId,
    videoUrl: "/videos/video3.mp4",
    likes: 2156,
    rating: 7.8,
    isFollowing: false,
  },
];

export const VideoFeed = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [videos, setVideos] = useState(getMockVideos(""));
  const [isPlayingFavorites, setIsPlayingFavorites] = useState(false);
  const [allVideos] = useState(getMockVideos(""));

  useEffect(() => {
    if (user?.id) setVideos(getMockVideos(user.id));
  }, [user?.id]);

  // Check if we're playing favorites from navigation state
  useEffect(() => {
    const state = location.state as { favoriteVideos?: any[], startIndex?: number };
    if (state?.favoriteVideos) {
      setVideos(state.favoriteVideos);
      setCurrentIndex(state.startIndex || 0);
      setIsPlayingFavorites(true);
    }
  }, [location.state]);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(0);
    setTouchStart(e.targetTouches[0].clientY);
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const currentTouch = e.targetTouches[0].clientY;
    setTouchEnd(currentTouch);
    
    // Calculate drag distance and update offset in real-time
    const distance = currentTouch - touchStart;
    setDragOffset(distance);
  };

  const onTouchEnd = () => {
    setIsDragging(false);
    
    if (!touchStart || !touchEnd) {
      setDragOffset(0);
      return;
    }

    const distance = touchStart - touchEnd;
    const isUpSwipe = distance > minSwipeDistance;
    const isDownSwipe = distance < -minSwipeDistance;

    if (isUpSwipe) {
      if (currentIndex < videos.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // At the end, loop back to the first video
        setCurrentIndex(0);
      }
    } else if (isDownSwipe) {
      if (currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      } else {
        // At the beginning, loop to the last video
        setCurrentIndex(videos.length - 1);
      }
    }
    
    // Reset drag offset
    setDragOffset(0);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        if (currentIndex < videos.length - 1) {
          setCurrentIndex((prev) => prev + 1);
        } else {
          // At the end, loop back to the first video
          setCurrentIndex(0);
        }
      }
      if (e.key === "ArrowUp") {
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
        } else {
          // At the beginning, loop to the last video
          setCurrentIndex(videos.length - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, videos.length]);

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="relative h-full"
        style={{
          transform: `translateY(calc(-${currentIndex * 100}vh + ${dragOffset}px))`,
          transition: isDragging ? 'none' : 'transform 0.5s ease-out',
        }}
      >
        {videos.map((video, index) => (
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
        {videos.map((_, index) => (
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
