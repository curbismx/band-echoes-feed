import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Upload } from "lucide-react";

interface VideoInput {
  id: string;
  title: string;
}

interface UserForm {
  icon: File | null;
  name: string;
  username: string;
  email: string;
  website: string;
  description: string;
  videos: VideoInput[];
}

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [users, setUsers] = useState<UserForm[]>([]);
  const [currentUser, setCurrentUser] = useState<UserForm>({
    icon: null,
    name: "",
    username: "",
    email: "",
    website: "",
    description: "",
    videos: [],
  });

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' as any });

      if (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
      setCheckingAdmin(false);
    };

    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/");
      return;
    }
    if (!loading && !checkingAdmin && !isAdmin) {
      navigate("/");
    }
  }, [user, isAdmin, loading, checkingAdmin, navigate]);

  const handleAddVideo = (userIndex: number) => {
    const updatedUsers = [...users];
    updatedUsers[userIndex].videos.push({
      id: crypto.randomUUID(),
      title: "",
    });
    setUsers(updatedUsers);
  };

  const handleVideoChange = (userIndex: number, videoIndex: number, value: string) => {
    const updatedUsers = [...users];
    updatedUsers[userIndex].videos[videoIndex].title = value;
    setUsers(updatedUsers);
  };

  const handleAddNewUser = () => {
    setUsers([
      ...users,
      {
        icon: null,
        name: "",
        username: "",
        email: "",
        website: "",
        description: "",
        videos: [],
      },
    ]);
  };

  const handleUserChange = (index: number, field: keyof UserForm, value: any) => {
    const updatedUsers = [...users];
    updatedUsers[index] = { ...updatedUsers[index], [field]: value };
    setUsers(updatedUsers);
  };

  const handleIconUpload = (index: number, file: File | null) => {
    handleUserChange(index, "icon", file);
  };

  const handleDeleteUser = (index: number) => {
    const updatedUsers = users.filter((_, i) => i !== index);
    setUsers(updatedUsers);
  };

  const handlePublishUser = async (index: number) => {
    const userForm = users[index];
    
    // Validation
    if (!userForm.email || !userForm.username || !userForm.name) {
      toast.error("Please fill in required fields: email, username, and name");
      return;
    }

    try {
      // Create user account
      const password = crypto.randomUUID(); // Generate random password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userForm.email,
        password: password,
        options: {
          data: {
            username: userForm.username,
            display_name: userForm.name,
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed");

      // Upload avatar if provided
      let avatarUrl = null;
      if (userForm.icon) {
        const fileExt = userForm.icon.name.split(".").pop();
        const fileName = `${authData.user.id}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, userForm.icon, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);
        avatarUrl = publicUrl;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          bio: userForm.description,
          website: userForm.website,
          avatar_url: avatarUrl,
        })
        .eq("id", authData.user.id);

      if (profileError) throw profileError;

      toast.success(`User ${userForm.name} created successfully!`);
      handleDeleteUser(index);
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-8 mb-8 pb-4 border-b border-border">
          <h1 className="text-xl font-normal text-foreground">Admin</h1>
          <button 
            className="text-xl font-normal text-primary border-b-2 border-primary pb-1"
          >
            User Accounts
          </button>
          <button 
            onClick={handleLogout}
            className="text-xl font-normal text-foreground hover:text-primary transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Add New User Button */}
        <button
          onClick={handleAddNewUser}
          className="flex items-center gap-2 mb-8 text-primary hover:text-primary/80 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg border-2 border-primary flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-base">Add new user</span>
        </button>

        {/* User Forms */}
        <div className="space-y-8">
          {users.map((userForm, userIndex) => (
            <div key={userIndex} className="border-b border-border pb-8">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 mb-4 text-sm text-muted-foreground">
                <div className="col-span-1">Icon</div>
                <div className="col-span-2">Name</div>
                <div className="col-span-2">Username</div>
                <div className="col-span-2">email address</div>
                <div className="col-span-2">web address</div>
                <div className="col-span-3">Description</div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-12 gap-4 mb-4">
                {/* Icon Upload */}
                <div className="col-span-1">
                  <label className="w-10 h-10 rounded-full border-2 border-input flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleIconUpload(userIndex, e.target.files?.[0] || null)}
                    />
                    {userForm.icon ? (
                      <img
                        src={URL.createObjectURL(userForm.icon)}
                        alt="icon"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <Plus className="w-5 h-5 text-muted-foreground" />
                    )}
                  </label>
                </div>

                <div className="col-span-2">
                  <Input
                    placeholder="text"
                    value={userForm.name}
                    onChange={(e) => handleUserChange(userIndex, "name", e.target.value)}
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    placeholder="text"
                    value={userForm.username}
                    onChange={(e) => handleUserChange(userIndex, "username", e.target.value)}
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    type="email"
                    placeholder="text"
                    value={userForm.email}
                    onChange={(e) => handleUserChange(userIndex, "email", e.target.value)}
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    placeholder="text"
                    value={userForm.website}
                    onChange={(e) => handleUserChange(userIndex, "website", e.target.value)}
                  />
                </div>

                <div className="col-span-3">
                  <Input
                    placeholder="text"
                    value={userForm.description}
                    onChange={(e) => handleUserChange(userIndex, "description", e.target.value)}
                  />
                </div>
              </div>

              {/* Videos Section */}
              <div className="grid grid-cols-12 gap-4 mb-4">
                <div className="col-span-1"></div>
                <div className="col-span-11 flex flex-wrap gap-4">
                  {userForm.videos.map((video, videoIndex) => (
                    <div key={video.id} className="flex items-center gap-2">
                      <button className="w-10 h-10 rounded-lg border-2 border-input flex items-center justify-center">
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <Input
                        placeholder="Text for video"
                        className="w-40"
                        value={video.title}
                        onChange={(e) => handleVideoChange(userIndex, videoIndex, e.target.value)}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => handleAddVideo(userIndex)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    add more videos...
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 mt-4">
                <button
                  onClick={() => handlePublishUser(userIndex)}
                  className="text-sm text-foreground hover:text-primary transition-colors"
                >
                  Publish to App
                </button>
                <button
                  onClick={() => handleDeleteUser(userIndex)}
                  className="text-sm text-destructive hover:text-destructive/80 transition-colors"
                >
                  Delete User
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Admin;
