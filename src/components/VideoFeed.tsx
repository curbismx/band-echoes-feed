import { useState, useRef, useEffect } from "react";
import { VideoCard } from "./VideoCard";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const VideoFeed = () => {
  const location = useLocation();
  const [videos, setVideos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isAnyDrawerOpen, setIsAnyDrawerOpen] = useState(false);

  const touchStartY = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch videos on mount
  useEffect(() => {
    const fetchVideos = async () => {
      const { data: videosData } = await supabase
        .from("videos")
        .select("*")
        .order("created_at", { ascending: false });

      if (!videosData) return;

      const userIds = [...new Set(videosData.map(v => v.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      const formatted = videosData.map(v => {
        const profile = profilesMap.get(v.user_id);
        return {
          ...v,
          posterUrl: v.thumbnail_url,
          videoUrl: v.video_url,
          likes: v.likes_count || 0,
          artistName: profile?.display_name || profile?.username || "Unknown Artist",
          artistUserId: v.user_id,
          rating: 0,
          isFollowing: false
        };
      });

      setVideos(formatted);

      // Handle navigation from other pages
      if (location.state?.videoId) {
        const idx = formatted.findIndex(v => v.id === location.state.videoId);
        if (idx !== -1) setCurrentIndex(idx);
        window.history.replaceState({}, document.title);
      }
    };

    fetchVideos();
  }, [location.state]);

  // Swipe handling
  const onTouchStart = (e: React.TouchEvent) => {
    if (isAnyDrawerOpen) return;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || isAnyDrawerOpen) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    setDragOffset(diff);
  };

  const onTouchEnd = () => {
    if (isAnyDrawerOpen) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const threshold = 50;
    if (dragOffset < -threshold && currentIndex < videos.length - 1) {
      setCurrentIndex(i => i + 1);
    } else if (dragOffset > threshold && currentIndex > 0) {
      setCurrentIndex(i => i - 1);
    }

    setIsDragging(false);
    setDragOffset(0);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isAnyDrawerOpen) return;
      if (e.key === "ArrowDown" && currentIndex < videos.length - 1) {
        setCurrentIndex(i => i + 1);
      } else if (e.key === "ArrowUp" && currentIndex > 0) {
        setCurrentIndex(i => i - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, videos.length, isAnyDrawerOpen]);

  return (
    <div
      className="h-screen w-screen overflow-hidden bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        style={{
          transform: `translateY(calc(${-currentIndex * 100}vh + ${dragOffset}px))`,
          transition: isDragging ? "none" : "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {videos.map((video, index) => (
          <VideoCard
            key={video.id}
            video={video}
            isActive={index === currentIndex}
            isMuted={isMuted}
            onUnmute={() => setIsMuted(false)}
            onDrawerStateChange={setIsAnyDrawerOpen}
          />
        ))}
      </div>
    </div>
  );
};