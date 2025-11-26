import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function UserProfile() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) {
      navigate("/");
      return;
    }

    const fetchProfile = async () => {
      // Only select public fields - exclude email and created_by for security
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url, website, followers_count, following_count, posts_count")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setProfile(data);
      }

      // Fetch user's videos
      const { data: videosData } = await supabase
        .from("videos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (videosData) {
        setVideos(videosData);
      }

      // Check if current user is following this profile
      if (user) {
        const { data: followData } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", user.id)
          .eq("followed_id", userId)
          .maybeSingle();

        setIsFollowing(!!followData);
      }
      
      setLoading(false);
    };

    fetchProfile();
  }, [userId, user, navigate]);

  const handleFollow = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const next = !isFollowing;
    setIsFollowing(next);

    if (next) {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: user.id, followed_id: userId });
      
      if (error) {
        setIsFollowing(!next);
        toast({
          title: "Error",
          description: "Failed to follow user",
          variant: "destructive",
        });
      }
    } else {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followed_id", userId);
      
      if (error) {
        setIsFollowing(!next);
        toast({
          title: "Error",
          description: "Failed to unfollow user",
          variant: "destructive",
        });
      }
    }
  };

  const handleShareProfile = async () => {
    const profileUrl = `${window.location.origin}/user/${userId}`;
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({
        title: "Link copied!",
        description: "Profile link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#252525" }}>
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#252525" }}>
        <div className="text-white">User not found</div>
      </div>
    );
  }
  

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  return (
    <div className="h-screen flex flex-col text-white overflow-hidden" style={{ backgroundColor: "#252525" }}>
      {/* Top Gutter for Mobile Status Bar */}
      <div className="h-[25px] flex-shrink-0" style={{ backgroundColor: "#252525" }} />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 flex-shrink-0">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 -ml-2"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-semibold text-lg">{profile.username || "user"}</span>
        <div className="w-10" />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Info */}
        <div className="p-4">
          {/* Profile Picture and Stats */}
          <div className="flex items-center gap-6 mb-4">
            <img
              src={profile.avatar_url || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop"}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover"
            />
            
            <div className="flex-1 flex justify-around">
              <div className="text-center">
                <div className="font-semibold text-lg">{profile.posts_count || 0}</div>
                <div className="text-sm text-white/60">posts</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{formatNumber(profile.followers_count || 0)}</div>
                <div className="text-sm text-white/60">followers</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">{profile.following_count || 0}</div>
                <div className="text-sm text-white/60">following</div>
              </div>
            </div>
          </div>

          {/* Name and Bio */}
          <div className="mb-4">
            <div className="font-semibold mb-1">{profile.display_name || profile.username}</div>
            <div className="text-sm text-white/80 whitespace-pre-line">
              {profile.bio || "No bio yet"}
            </div>
            
            {/* Website Link */}
            {profile.website && (
              <div className="mt-3">
                <a
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                  </svg>
                  {profile.website}
                </a>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button 
              onClick={handleFollow}
              className={`${isFollowing ? 'bg-white/10' : 'bg-blue-500'} hover:opacity-80 transition-colors py-2 rounded-lg font-semibold text-sm`}
            >
              {isFollowing ? 'Unfollow' : 'Follow'}
            </button>
            <button 
              onClick={handleShareProfile}
              className="bg-white/10 hover:bg-white/20 transition-colors py-2 rounded-lg font-semibold text-sm"
            >
              Share Profile
            </button>
          </div>
        </div>

        {/* Video Grid */}
        <div className="border-t border-white/10">
          {videos.length === 0 ? (
            <div className="p-8 text-center text-white/60">
              <p className="mb-2">No videos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {videos.map((video) => (
                <div 
                  key={video.id} 
                  className="relative aspect-[9/16] bg-white/5 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/?video=${video.id}`)}
                >
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title || "Video thumbnail"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={video.video_url}
                      className="w-full h-full object-cover"
                      muted
                    />
                  )}
                  
                  {/* Stats Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 space-y-1">
                    {/* Views */}
                    <div className="flex items-center gap-1 text-white text-xs font-semibold drop-shadow-lg">
                      <svg className="w-3.5 h-3.5" fill="white" viewBox="0 0 24 24">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                      </svg>
                      <span>{formatNumber(video.views_count || 0)}</span>
                    </div>
                    
                    {/* Likes */}
                    <div className="flex items-center gap-1 text-white text-xs font-semibold drop-shadow-lg">
                      <svg className="w-3.5 h-3.5" fill="white" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                      <span>{formatNumber(video.likes_count || 0)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
