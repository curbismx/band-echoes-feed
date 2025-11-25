import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import heartRedIcon from "@/assets/heart-red.png";
import { toast } from "@/hooks/use-toast";

export default function Favorites() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [favoriteVideos, setFavoriteVideos] = useState<any[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
 
  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  // Fetch real favorite videos
  useEffect(() => {
    if (!user) {
      console.log("No user in Favorites page");
      return;
    }

    console.log("Fetching favorites for user:", user.id);

    const fetchFavorites = async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("video_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      console.log("Favorites fetch result:", { data, error, dataLength: data?.length });

      if (data) {
        // Fetch actual videos that are favorited
        const videoIds = data.map(fav => fav.video_id);
        
        if (videoIds.length > 0) {
          const { data: videosData } = await supabase
            .from("videos")
            .select("*")
            .in("id", videoIds);

          if (videosData) {
            // Fetch profiles for video owners
            const userIds = [...new Set(videosData.map(v => v.user_id))];
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_url")
              .in("id", userIds);

            const profilesMap = new Map(
              profilesData?.map(p => [p.id, p]) || []
            );

            const favVideos = videosData.map((video: any) => {
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
                thumbnail: video.thumbnail_url,
                links: video.links || [],
              };
            });

            setFavoriteVideos(favVideos);
          }
        }
      }
    };

    fetchFavorites();
  }, [user]);

  const handleRemoveFavorite = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user) return;

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("video_id", videoId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove favorite",
        variant: "destructive",
      });
    } else {
      setFavoriteVideos(prev => prev.filter(v => v.id !== videoId));
      toast({
        title: "Removed",
        description: "Video removed from favorites",
      });
    }
  };

  // Generate on-the-fly thumbnails for videos missing thumbnail_url
  useEffect(() => {
    const captureFirstFrame = (url: string): Promise<string | null> => {
      return new Promise((resolve) => {
        try {
          const videoEl = document.createElement("video");
          videoEl.crossOrigin = "anonymous";
          videoEl.src = url;
          videoEl.preload = "metadata";
          videoEl.muted = true;
          videoEl.playsInline = true;

          const onLoaded = () => {
            const width = videoEl.videoWidth || 540;
            const height = videoEl.videoHeight || 960;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.drawImage(videoEl, 0, 0, width, height);
            try {
              const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
              resolve(dataUrl);
            } catch (e) {
              resolve(null);
            }
          };

          videoEl.addEventListener("loadeddata", onLoaded, { once: true });
          videoEl.addEventListener("error", () => resolve(null), { once: true });
        } catch {
          resolve(null);
        }
      });
    };

    const toProcess = favoriteVideos.filter(v => !v.thumbnail && v.videoUrl && !thumbs[v.id]);
    if (toProcess.length === 0) return;

    toProcess.forEach(async (v) => {
      const dataUrl = await captureFirstFrame(v.videoUrl);
      if (dataUrl) {
        setThumbs((prev) => ({ ...prev, [v.id]: dataUrl }));
      }
    });
  }, [favoriteVideos, thumbs]);


  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: "#0A1014" }}>
      {/* Top Gutter for Mobile Status Bar */}
      <div className="h-[25px]" style={{ backgroundColor: "#0A1014" }} />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button
          onClick={() => navigate("/profile")}
          className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-semibold text-lg">Your Favorites</span>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Video Grid */}
      <div className="p-2">
        <div className="grid grid-cols-4 gap-1">
          {favoriteVideos.map((video, index) => (
            <div 
              key={video.id} 
              className="relative"
            >
              {/* Square video container */}
              <div 
                className="relative z-0 aspect-[9/16] overflow-hidden bg-white/5 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate("/", { state: { favoriteVideos, startIndex: index } })}
              >
                {(video.thumbnail || thumbs[video.id]) ? (
                  <img
                    src={video.thumbnail || thumbs[video.id]}
                    alt={video.title ? `${video.title} thumbnail` : "Video thumbnail"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    src={video.videoUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    controls={false}
                    poster={video.thumbnail || thumbs[video.id] || undefined}
                    onLoadedMetadata={(e) => {
                      try { e.currentTarget.currentTime = 0.1; } catch {}
                    }}
                  />
                )}
              </div>
              
              {/* Overlay elements must ALWAYS be above the video */}
              <div className="absolute bottom-2 left-2 z-50 text-white text-xs font-semibold drop-shadow-lg pointer-events-none">
                {video.artistName}
              </div>
              <button
                onClick={(e) => handleRemoveFavorite(video.id, e)}
                className="absolute top-2 right-2 z-50 pointer-events-auto p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              >
                <img src={heartRedIcon} alt="Remove from favorites" className="w-5 h-5 object-contain" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
