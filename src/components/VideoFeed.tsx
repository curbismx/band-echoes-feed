import { useState, useRef, useEffect } from "react";
import { VideoCard } from "./VideoCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
export const VideoFeed = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(() => !Capacitor.isNativePlatform());
  const [isGloballyPaused, setIsGloballyPaused] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [videos, setVideos] = useState<any[]>([]);
  const [isPlayingFavorites, setIsPlayingFavorites] = useState(false);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Score and sort videos based on algorithm settings
  const scoreVideos = async (videosData: any[], profilesMap: Map<string, any>) => {
    // Fetch algorithm settings
    const { data: algorithmSettings } = await supabase
      .from("algorithm_settings")
      .select("*")
      .eq("enabled", true)
      .order("priority", { ascending: true });

    // Fetch user's follows if logged in
    let userFollows: Set<string> = new Set();
    if (user) {
      const { data: followsData } = await supabase
        .from("follows")
        .select("followed_id")
        .eq("follower_id", user.id);
      userFollows = new Set(followsData?.map(f => f.followed_id) || []);
    }

    // Fetch ratings for all videos
    const { data: ratingsData } = await supabase
      .from("video_ratings")
      .select("video_id, rating");

    const ratingsByVideo = new Map<string, number[]>();
    ratingsData?.forEach(r => {
      if (!ratingsByVideo.has(r.video_id)) {
        ratingsByVideo.set(r.video_id, []);
      }
      ratingsByVideo.get(r.video_id)?.push(r.rating);
    });

    // Fetch actual favorites count from favorites table
    const { data: favoritesData } = await supabase
      .from("favorites")
      .select("video_id");

    const favoritesByVideo = new Map<string, number>();
    favoritesData?.forEach(f => {
      favoritesByVideo.set(f.video_id, (favoritesByVideo.get(f.video_id) || 0) + 1);
    });

    // Fetch comments count for engagement
    const { data: commentsData } = await supabase
      .from("comments")
      .select("video_id");

    const commentsByVideo = new Map<string, number>();
    commentsData?.forEach(c => {
      commentsByVideo.set(c.video_id, (commentsByVideo.get(c.video_id) || 0) + 1);
    });

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Score each video
    const scoredVideos = videosData.map((video: any) => {
      const profile = profilesMap.get(video.user_id);
      let totalScore = 0;

      algorithmSettings?.forEach((setting, index) => {
        const weight = algorithmSettings.length - index; // Higher priority = higher weight
        let factorScore = 0;

        switch (setting.factor_id) {
          case "favorites":
            factorScore = favoritesByVideo.get(video.id) || 0;
            break;
          
          case "rating":
            const ratings = ratingsByVideo.get(video.id) || [];
            factorScore = ratings.length > 0 
              ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
              : 0;
            break;
          
          case "recency":
            const ageInDays = (now - new Date(video.created_at).getTime()) / DAY_MS;
            factorScore = Math.max(0, 30 - ageInDays); // Newer = higher score
            break;
          
          case "views":
            factorScore = video.views_count || 0;
            break;
          
          case "following":
            factorScore = userFollows.has(video.user_id) ? 100 : 0;
            break;
          
          case "engagement":
            const comments = commentsByVideo.get(video.id) || 0;
            factorScore = comments * 2; // Weight comments higher
            break;
          
          case "random":
            factorScore = Math.random() * 10;
            break;
          
          case "category":
            // TODO: Implement category matching when user preferences are added
            factorScore = 0;
            break;
        }

        totalScore += factorScore * weight;
      });

       return {
         id: video.id,
         artistName: profile?.display_name || profile?.username || "Unknown Artist",
         artistUserId: video.user_id,
         videoUrl: video.video_url,
         likes: favoritesByVideo.get(video.id) || 0,
         rating: 0,
         isFollowing: userFollows.has(video.user_id),
         title: video.title,
         caption: video.caption,
         links: video.links || [],
         posterUrl: video.thumbnail_url,
         score: totalScore,
       };
    });

    // Sort by score (highest first)
    return scoredVideos.sort((a, b) => b.score - a.score);
  };

  // Fetch videos from database
  useEffect(() => {
    const fetchVideos = async () => {
      // First fetch videos
      const { data: videosData, error: videosError } = await supabase
        .from("videos")
        .select("*");

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

      // Score and sort videos using algorithm
      const sortedVideos = await scoreVideos(videosData, profilesMap);
      
      setVideos(sortedVideos);
      setAllVideos(sortedVideos);
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
            isGloballyPaused={isGloballyPaused}
            onTogglePause={(paused) => setIsGloballyPaused(paused)}
          />
        ))}
      </div>
    </div>
  );
};
