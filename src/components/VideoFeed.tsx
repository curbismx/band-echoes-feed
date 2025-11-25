import { useState, useRef, useEffect, useCallback } from "react";
import { VideoCard } from "./VideoCard";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const VideoFeed = () => {
  const location = useLocation();
  const [videos, setVideos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isAnyDrawerOpen, setIsAnyDrawerOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

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
        if (idx !== -1) {
          setCurrentIndex(idx);
          // Scroll to that video after render
          setTimeout(() => {
            containerRef.current?.scrollTo({ top: idx * window.innerHeight, behavior: 'auto' });
          }, 0);
        }
        window.history.replaceState({}, document.title);
      }
    };

    fetchVideos();
  }, [location.state]);

  // Detect which video is currently visible
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isAnyDrawerOpen) return;
    
    const scrollTop = containerRef.current.scrollTop;
    const videoHeight = window.innerHeight;
    const newIndex = Math.round(scrollTop / videoHeight);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);
    }
  }, [currentIndex, videos.length, isAnyDrawerOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isAnyDrawerOpen) return;
      if (e.key === "ArrowDown" && currentIndex < videos.length - 1) {
        containerRef.current?.scrollTo({ 
          top: (currentIndex + 1) * window.innerHeight, 
          behavior: 'smooth' 
        });
      } else if (e.key === "ArrowUp" && currentIndex > 0) {
        containerRef.current?.scrollTo({ 
          top: (currentIndex - 1) * window.innerHeight, 
          behavior: 'smooth' 
        });
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, videos.length, isAnyDrawerOpen]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-screen w-screen overflow-y-scroll overflow-x-hidden bg-black"
      style={{
        scrollSnapType: isAnyDrawerOpen ? 'none' : 'y mandatory',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <style>{`
        .video-feed-container::-webkit-scrollbar {
          display: none;
        }
        .video-feed-container {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      
      {videos.map((video, index) => (
        <div
          key={video.id}
          style={{
            height: '100vh',
            width: '100vw',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
          }}
        >
          <VideoCard
            video={video}
            isActive={index === currentIndex}
            isMuted={isMuted}
            onUnmute={() => setIsMuted(false)}
            onDrawerStateChange={setIsAnyDrawerOpen}
          />
        </div>
      ))}
    </div>
  );
};