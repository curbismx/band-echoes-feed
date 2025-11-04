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
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) {
      navigate("/");
      return;
    }

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (data) {
        setProfile(data);
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
  
  // Mock videos - will be replaced with real user videos later
  const videos = [
    { id: 1, thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop", views: "29.9K" },
    { id: 2, thumbnail: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&h=400&fit=crop", views: "12.1K" },
    { id: 3, thumbnail: "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400&h=400&fit=crop", views: "48.3K" },
    { id: 4, thumbnail: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=400&h=400&fit=crop", views: "8.2K" },
    { id: 5, thumbnail: "https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=400&h=400&fit=crop", views: "22.5K" },
    { id: 6, thumbnail: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop", views: "35.7K" },
  ];

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
    <div className="min-h-screen text-white" style={{ backgroundColor: "#252525" }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button 
          onClick={() => navigate("/")}
          className="p-2 -ml-2"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-semibold text-lg">{profile.username || "user"}</span>
        <div className="w-10" />
      </div>

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
          
          {/* Website and Email Links */}
          <div className="mt-3 space-y-2">
            {profile.website && (
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
            )}
            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                {profile.email}
              </a>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          <button 
            onClick={handleFollow}
            className={`flex-1 ${isFollowing ? 'bg-white/10' : 'bg-blue-500'} hover:opacity-80 transition-colors py-2 rounded-lg font-semibold text-sm`}
          >
            {isFollowing ? 'Unfollow' : 'Follow'}
          </button>
          <button 
            onClick={handleShareProfile}
            className="flex-1 bg-white/10 hover:bg-white/20 transition-colors py-2 rounded-lg font-semibold text-sm"
          >
            Share Profile
          </button>
        </div>
      </div>

      {/* Video Grid */}
      <div className="border-t border-white/10">
        <div className="grid grid-cols-3 gap-1">
          {videos.map((video) => (
            <div 
              key={video.id} 
              className="relative aspect-[9/16] bg-white/5 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate(`/`)}
            >
              <img
                src={video.thumbnail}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs font-semibold drop-shadow-lg">
                <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                {video.views}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
