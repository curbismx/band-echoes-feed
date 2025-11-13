import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import heartRedIcon from "@/assets/heart-red.png";
import backIcon from "@/assets/back.png";
import favsIcon from "@/assets/favs.png";
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
    <div className="min-h-screen text-white" style={{ backgroundColor: "#252525" }}>
      {/* Header */}
      <div className="absolute top-[100px] left-[30px] z-30 flex items-center gap-3">
        <button 
          onClick={() => navigate("/")}
          className="flex items-center"
        >
          <img src={backIcon} alt="Back" className="h-10 w-auto object-contain" />
        </button>
        <img src={favsIcon} alt="Favourites" className="h-10 w-auto object-contain" />
      </div>

      {/* Video Grid */}
      <div className="mt-1">
        <div className="grid grid-cols-4 gap-1">
          {favoriteVideos.map((video, index) => (
            <div 
              key={video.id} 
              className="relative aspect-[9/16] bg-white/5 cursor-pointer hover:opacity-80 transition-opacity"
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
                  poster="/placeholder.svg"
                  onLoadedMetadata={(e) => {
                    try { e.currentTarget.currentTime = 0.1; } catch {}
                  }}
                />
              )}
              <div className="absolute bottom-2 left-2 text-white text-xs font-semibold drop-shadow-lg">
                {video.artistName}
              </div>
              <button
                onClick={(e) => handleRemoveFavorite(video.id, e)}
                className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
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
