import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function EditProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setUsername(data.username || "");
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
        setWebsite(data.website || "");
        setEmail(data.email || "");
        setAvatarPreview(data.avatar_url || "");
      }
    };

    fetchProfile();
  }, [user, navigate]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      let avatarUrl = profile.avatar_url;

      // Upload avatar if a new one was selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `avatar.${fileExt}`;
        const filePath = `${profile.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        avatarUrl = publicUrl;
      }

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          username,
          display_name: displayName,
          bio,
          website,
          email,
          avatar_url: avatarUrl,
        })
        .eq("id", profile.id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });

      navigate("/profile");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: "#252525" }}>
      {/* Top Gutter for Mobile Status Bar */}
      <div className="h-[25px] flex-shrink-0" style={{ backgroundColor: "#252525" }} />
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button 
          onClick={() => navigate("/profile")}
          className="p-2 -ml-2"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <span className="font-semibold text-lg">Edit Profile</span>
        <div className="w-10" />
      </div>

      <div className="p-6 space-y-6">
        {/* Avatar Upload */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <img
              src={avatarPreview || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop"}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover"
            />
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 bg-white text-black p-3 rounded-full cursor-pointer hover:bg-white/90 transition-colors"
            >
              <Camera className="w-5 h-5" />
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <p className="text-sm text-white/60">Tap camera icon to change photo</p>
        </div>

        {/* Username */}
        <div>
          <label className="text-sm text-white/80 mb-2 block">Username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-white/10 border-white/20 text-white"
            placeholder="username"
          />
        </div>

        {/* Display Name */}
        <div>
          <label className="text-sm text-white/80 mb-2 block">Display Name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="bg-white/10 border-white/20 text-white"
            placeholder="Display Name"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="text-sm text-white/80 mb-2 block">Bio</label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="bg-white/10 border-white/20 text-white resize-none"
            placeholder="Write a bio..."
            rows={5}
          />
        </div>

        {/* Website */}
        <div>
          <label className="text-sm text-white/80 mb-2 block">Website</label>
          <Input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="bg-white/10 border-white/20 text-white"
            placeholder="https://yourwebsite.com"
            type="url"
          />
        </div>

        {/* Email */}
        <div>
          <label className="text-sm text-white/80 mb-2 block">Email</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white/10 border-white/20 text-white"
            placeholder="your@email.com"
            type="email"
          />
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-white text-black hover:bg-white/90 py-6 text-base font-semibold"
        >
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
