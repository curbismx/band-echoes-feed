import { useState, useRef, useEffect } from "react";
import { VideoCard } from "./VideoCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import backIcon from "@/assets/back.png";
import favsIcon from "@/assets/favs.png";
import { getStreamingVideoUrl } from "@/utils/videoUrl";
export const VideoFeed = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = sessionStorage.getItem('videoFeedIndex');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [isMuted, setIsMuted] = useState(true);
  const [isGloballyPaused, setIsGloballyPaused] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [videos, setVideos] = useState<any[]>(() => {
    // Try to restore cached videos immediately
    const cached = sessionStorage.getItem('cachedVideos');
    return cached ? JSON.parse(cached) : [];
  });
  const [isPlayingFavorites, setIsPlayingFavorites] = useState(false);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Always start each new video muted so autoplay works reliably
  useEffect(() => {
    setIsMuted(true);
  }, [currentIndex]);

  // Get or create user session for tracking
  const getUserSession = () => {
    let session = sessionStorage.getItem('userSessionId');
    if (!session) {
      session = crypto.randomUUID();
      sessionStorage.setItem('userSessionId', session);
    }
    return session;
  };

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

    // Fetch watched videos for current user/session
    const userSession = getUserSession();
    const { data: viewsData } = await supabase
      .from("video_views")
      .select("video_id")
      .or(user ? `user_id.eq.${user.id}` : `user_session.eq.${userSession}`);
    
    const watchedVideos = new Set(viewsData?.map(v => v.video_id) || []);

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
          
          case "watched":
            // Heavily penalize watched videos (push to bottom)
            factorScore = watchedVideos.has(video.id) ? -10000 : 0;
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
      // Check if we should re-sort (once per day)
      const lastSorted = sessionStorage.getItem('lastSortedDate');
      const today = new Date().toDateString();
      const shouldResort = lastSorted !== today;

      if (!shouldResort) {
        // Use cached videos if still same day
        const cached = sessionStorage.getItem('cachedVideos');
        if (cached) {
          const cachedVideos = JSON.parse(cached);
          setVideos(cachedVideos);
          setAllVideos(cachedVideos);
          setLoading(false);
          return;
        }
      }

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
      
      // Cache the sorted videos and timestamp
      sessionStorage.setItem('cachedVideos', JSON.stringify(sortedVideos));
      sessionStorage.setItem('lastSortedDate', today);
      
      setVideos(sortedVideos);
      setAllVideos(sortedVideos);
      
      // Restore saved position after videos are loaded (only if not coming from favorites)
      const state = location.state as { favoriteVideos?: any[], startIndex?: number };
      if (!state?.favoriteVideos && location.pathname === '/') {
        const savedVideoId = sessionStorage.getItem('videoFeedVideoId');
        if (savedVideoId) {
          const byIdIndex = sortedVideos.findIndex(v => v.id === savedVideoId);
          if (byIdIndex !== -1) {
            setCurrentIndex(byIdIndex);
          } else {
            const savedIndex = sessionStorage.getItem('videoFeedIndex');
            if (savedIndex) {
              const index = parseInt(savedIndex, 10);
              if (index >= 0 && index < sortedVideos.length) {
                setCurrentIndex(index);
              }
            }
          }
        } else {
          const savedIndex = sessionStorage.getItem('videoFeedIndex');
          if (savedIndex) {
            const index = parseInt(savedIndex, 10);
            if (index >= 0 && index < sortedVideos.length) {
              setCurrentIndex(index);
            }
          }
        }
      }
      
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
  }, [location.pathname, location.state]);

  // Save currentIndex, track video views, and current video id to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('videoFeedIndex', currentIndex.toString());
    const currentVideoId = videos[currentIndex]?.id;
    if (currentVideoId) {
      sessionStorage.setItem('videoFeedVideoId', currentVideoId);
    }
  }, [currentIndex, videos]);

  // Track video view when user scrolls to next video
  useEffect(() => {
    if (videos.length === 0 || currentIndex === 0) return;
    
    const previousVideoId = videos[currentIndex - 1]?.id;
    if (!previousVideoId) return;

    const trackView = async () => {
      const userSession = getUserSession();
      await supabase.from("video_views").insert({
        video_id: previousVideoId,
        user_id: user?.id || null,
        user_session: userSession
      });
    };

    trackView();
  }, [currentIndex, videos, user]);

  // Check if we're playing favorites from navigation state
  useEffect(() => {
    const state = location.state as { favoriteVideos?: any[], startIndex?: number };
    if (state?.favoriteVideos) {
      setVideos(state.favoriteVideos);
      setCurrentIndex(state.startIndex || 0);
      setIsPlayingFavorites(true);
    } else if (location.pathname === '/') {
      // Clear favorites state when returning to main feed
      setIsPlayingFavorites(false);
    }
  }, [location.state, location.pathname]);

  const minSwipeDistance = 80; // Increased for more deliberate swipes

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
      // Ensure next video auto-plays
      setIsGloballyPaused(false);
    } else if (isDownSwipe) {
      if (currentIndex > 0) {
        setCurrentIndex((prev) => prev - 1);
      } else {
        // At the beginning, loop to the last video
        setCurrentIndex(videos.length - 1);
      }
      // Ensure previous video auto-plays
      setIsGloballyPaused(false);
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
        // Ensure next video auto-plays
        setIsGloballyPaused(false);
      }
      if (e.key === "ArrowUp") {
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
        } else {
          // At the beginning, loop to the last video
          setCurrentIndex(videos.length - 1);
        }
        // Ensure previous video auto-plays
        setIsGloballyPaused(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, videos.length]);

  // Emergency pause all videos except current (backup to VideoCard logic)
  useEffect(() => {
    if (!videos.length) return;
    
    // Small delay to let React render complete
    const timer = setTimeout(() => {
      const videoEls = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
      videoEls.forEach((el, idx) => {
        if (idx !== currentIndex) {
          try {
            el.pause();
            el.currentTime = el.currentTime; // Force refresh
          } catch {}
        }
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [currentIndex, videos.length]);

  // Aggressive autoplay attempt for the first active video after videos mount
  useEffect(() => {
    if (!videos.length) return;

    const attempt = () => {
      const videoEls = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
      const el = videoEls[currentIndex];
      if (!el) return;
      try {
        // Keep muted to satisfy browser autoplay policies (Safari/Chrome)
        el.muted = true;
        if (el.readyState >= 2) {
          const p = el.play();
          if (p && typeof (p as any).catch === 'function') {
            (p as Promise<void>).catch(() => {});
          }
        } else {
          const onCanPlay = () => {
            el.removeEventListener('canplay', onCanPlay);
            const p = el.play();
            if (p && typeof (p as any).catch === 'function') {
              (p as Promise<void>).catch(() => {});
            }
          };
          el.addEventListener('canplay', onCanPlay, { once: true });
        }
      } catch {}
    };

    // Give the DOM a tick to render before trying to play
    const t = setTimeout(attempt, 50);
    // Also re-attempt once when tab becomes visible again
    const onVis = () => {
      if (document.visibilityState === 'visible') attempt();
    };
    document.addEventListener('visibilitychange', onVis, { once: true } as any);

    return () => {
      clearTimeout(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [videos.length]);

  const handleBackToFeed = () => {
    setIsPlayingFavorites(false);
    navigate("/", { replace: true });
    // Reload all videos
    window.location.reload();
  };

  return (
    <div
      ref={containerRef}
      className="relative h-screen w-screen overflow-hidden bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Back and Favourites icons - shown only when viewing favorites */}
      {isPlayingFavorites && (
        <div className="absolute top-[100px] left-[30px] z-30 flex items-center gap-3">
          <button 
            onClick={handleBackToFeed}
            className="flex items-center"
          >
            <img src={backIcon} alt="Back" className="h-[30px] w-auto object-contain" />
          </button>
          <img src={favsIcon} alt="Favourites" className="h-[30px] w-auto object-contain" />
        </div>
      )}

      <div
        className="relative h-full"
        style={{
          transform: `translateY(calc(-${currentIndex * 100}vh + ${dragOffset}px))`,
          transition: isDragging ? 'none' : 'transform 0.4s ease-out',
        }}
      >
        {videos.map((video, index) => {
          // Optimize preloading: auto for current/next, metadata for nearby, none for far away
          const distance = Math.abs(index - currentIndex);
          const preloadStrategy = distance <= 1 ? "auto" : distance === 2 ? "metadata" : "none";

          // Some video objects have `videoUrl`, some have `video_url` (e.g. favorites).
          // Pick whichever exists so we always get a real URL.
          const sourceUrl = video.videoUrl ?? video.video_url ?? "";

          const streamingVideo = {
            ...video,
            videoUrl: sourceUrl ? getStreamingVideoUrl(sourceUrl) : "",
          };

          const isActiveVideo = index === currentIndex;

          return (
            <VideoCard
              key={video.id}
              video={streamingVideo}
              isActive={isActiveVideo}
              isMuted={isMuted}
              onUnmute={() => setIsMuted(false)}
              isGloballyPaused={isGloballyPaused}
              onTogglePause={(paused) => setIsGloballyPaused(paused)}
              preloadStrategy={preloadStrategy}
            />
          );
        })}
      </div>
    </div>
  );
};
