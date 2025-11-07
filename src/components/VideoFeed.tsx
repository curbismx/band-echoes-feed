import { useState, useRef, useEffect } from "react";
import { VideoCard } from "./VideoCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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

  const [videos, setVideos] = useState<any[]>([]);
  const [isPlayingFavorites, setIsPlayingFavorites] = useState(false);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch videos from database
  useEffect(() => {
    const fetchVideos = async () => {
      // First fetch videos
      const { data: videosData, error: videosError } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (videosError || !videosData) {
        console.error("Error fetching videos:", videosError);
        setLoading(false);
        return;
      }

      // Then fetch profiles for all unique user IDs
      const userIds = [...new Set(videosData.map(v => v.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .in("id", userIds);

      // Create a map of user_id to profile
      const profilesMap = new Map(
        profilesData?.map(p => [p.id, p]) || []
      );

      // Combine videos with profile data
      const formattedVideos = videosData.map((video: any) => {
        const profile = profilesMap.get(video.user_id);
        return {
          id: video.id,
          artistName: profile?.display_name || profile?.username || "Unknown Artist",
          artistUserId: video.user_id,
          videoUrl: video.video_url,
          likes: video.likes_count || 0,
          rating: 0,
          isFollowing: false,
          title: video.title,
          caption: video.caption,
        };
      });
      
      setVideos(formattedVideos);
      setAllVideos(formattedVideos);
      setLoading(false);
    };

    fetchVideos();

    // Refetch when navigating back to this page
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchVideos();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also refetch on location change (when navigating back)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [location.pathname]);

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
