import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [allAdmins, setAllAdmins] = useState<any[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminManagementExpanded, setAdminManagementExpanded] = useState(() => {
    const saved = localStorage.getItem('settings-admin-management-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [categoriesExpanded, setCategoriesExpanded] = useState(() => {
    const saved = localStorage.getItem('settings-categories-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [algorithmExpanded, setAlgorithmExpanded] = useState(() => {
    const saved = localStorage.getItem('settings-algorithm-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [algorithmFactors, setAlgorithmFactors] = useState([
    { id: "category", label: "Video Category", description: "Match user's preferred categories" },
    { id: "favorites", label: "Amount of Favorites", description: "Number of likes/favorites" },
    { id: "rating", label: "Video Score", description: "Average rating from users" },
    { id: "recency", label: "Upload Recency", description: "How recently the video was uploaded" },
    { id: "views", label: "View Count", description: "Total number of views" },
    { id: "following", label: "Following", description: "Videos from followed artists" },
    { id: "engagement", label: "Engagement Rate", description: "Comments and shares" },
    { id: "random", label: "Random", description: "Fallback when no user preference data available" },
  ]);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [copyrightNotice, setCopyrightNotice] = useState("");
  const [copyrightExpanded, setCopyrightExpanded] = useState(() => {
    const saved = localStorage.getItem('settings-copyright-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'admin' as any });

      if (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data);
      }
      
      setCheckingAdmin(false);
    };

    if (!loading) {
      checkAdminStatus();
    }
  }, [user, loading]);

  useEffect(() => {
    if (!loading && !checkingAdmin && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, checkingAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin && !checkingAdmin) {
      fetchCategories();
      fetchAdmins();
      fetchAlgorithmSettings();
      fetchCopyrightNotice();
    }
  }, [isAdmin, checkingAdmin]);

  const fetchCopyrightNotice = async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "copyright_notice")
        .maybeSingle();
      
      if (data?.setting_value) {
        setCopyrightNotice(data.setting_value as string);
      } else {
        // Set default value
        const defaultText = "For any copyright issues please contact our DMCA agant and we will remove the content straight away : mail@curbism.com";
        setCopyrightNotice(defaultText);
        // Save default to database
        await supabase
          .from("app_settings")
          .insert({ setting_key: "copyright_notice", setting_value: defaultText });
      }
    } catch (error) {
      console.error("Error fetching copyright notice:", error);
    }
  };

  const handleSaveCopyrightNotice = async () => {
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          setting_key: "copyright_notice",
          setting_value: copyrightNotice,
        });

      if (error) throw error;

      toast.success("Copyright notice updated successfully");
    } catch (error) {
      console.error("Error saving copyright notice:", error);
      toast.error("Failed to save copyright notice");
    }
  };

  const fetchAlgorithmSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("algorithm_settings")
        .select("*")
        .order("priority", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Map database settings to UI format
        const factorsMap = new Map([
          ["category", { label: "Video Category", description: "Match user's preferred categories" }],
          ["favorites", { label: "Amount of Favorites", description: "Number of likes/favorites" }],
          ["rating", { label: "Video Score", description: "Average rating from users" }],
          ["recency", { label: "Upload Recency", description: "How recently the video was uploaded" }],
          ["views", { label: "View Count", description: "Total number of views" }],
          ["following", { label: "Following", description: "Videos from followed artists" }],
          ["engagement", { label: "Engagement Rate", description: "Comments and shares" }],
          ["random", { label: "Random", description: "Fallback when no user preference data available" }],
        ]);

        const loadedFactors = data.map(setting => ({
          id: setting.factor_id,
          label: factorsMap.get(setting.factor_id)?.label || setting.factor_id,
          description: factorsMap.get(setting.factor_id)?.description || "",
        }));

        setAlgorithmFactors(loadedFactors);
      }
    } catch (error: any) {
      console.error("Error fetching algorithm settings:", error);
    }
  };

  const fetchAdmins = async () => {
    setAdminsLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, display_name, email, avatar_url")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      const adminIds = new Set(roles?.map(r => r.user_id) || []);
      const admins = profiles?.filter(p => adminIds.has(p.id)) || [];
      setAllAdmins(admins);
    } catch (error: any) {
      console.error("Error fetching admins:", error);
      toast.error("Failed to load admins");
    }
    setAdminsLoading(false);
  };

  const handleAddAdmin = async () => {
    if (!adminEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      // Find user by email
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .eq("email", adminEmail.trim())
        .single();

      if (profileError || !profiles) {
        toast.error("User with this email not found");
        return;
      }

      // Add admin role
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: profiles.id, role: "admin" });

      if (error) {
        if (error.message?.includes("duplicate")) {
          toast.error("User is already an admin");
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Admin role granted to ${profiles.display_name || profiles.email}`);
      setAdminEmail("");
      fetchAdmins();
    } catch (error: any) {
      console.error("Error adding admin:", error);
      toast.error(error.message || "Failed to add admin");
    }
  };

  const handleRemoveAdmin = async (userId: string, displayName: string) => {
    if (userId === user?.id) {
      toast.error("You cannot remove your own admin role");
      return;
    }

    if (!confirm(`Remove admin role from ${displayName}?`)) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) throw error;
      toast.success("Admin role removed");
      fetchAdmins();
    } catch (error: any) {
      console.error("Error removing admin:", error);
      toast.error(error.message || "Failed to remove admin role");
    }
  };

  // Persist expand/collapse states
  useEffect(() => {
    try {
      localStorage.setItem('settings-admin-management-expanded', JSON.stringify(adminManagementExpanded));
    } catch {}
  }, [adminManagementExpanded]);

  useEffect(() => {
    try {
      localStorage.setItem('settings-categories-expanded', JSON.stringify(categoriesExpanded));
    } catch {}
  }, [categoriesExpanded]);

  useEffect(() => {
    try {
      localStorage.setItem('settings-algorithm-expanded', JSON.stringify(algorithmExpanded));
    } catch {}
  }, [algorithmExpanded]);

  const fetchCategories = async () => {
    setCategoriesLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching categories:", error);
      toast.error("Failed to load categories");
    } else {
      setCategories(data || []);
    }
    setCategoriesLoading(false);
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    const { error } = await supabase
      .from("categories")
      .insert({
        name: categoryForm.name.trim(),
      });

    if (error) {
      console.error("Error creating category:", error);
      toast.error("Failed to create category");
    } else {
      toast.success("Category created successfully");
      setCategoryForm({ name: "" });
      fetchCategories();
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory || !categoryForm.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    const { error } = await supabase
      .from("categories")
      .update({
        name: categoryForm.name.trim(),
      })
      .eq("id", editingCategory);

    if (error) {
      console.error("Error updating category:", error);
      toast.error("Failed to update category");
    } else {
      toast.success("Category updated successfully");
      setEditingCategory(null);
      setCategoryForm({ name: "" });
      fetchCategories();
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryToDelete.id);

    if (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    } else {
      toast.success("Category deleted successfully");
      fetchCategories();
    }
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category.id);
    setCategoryForm({
      name: category.name,
    });
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "" });
  };

  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null) return;

    setDropTarget(index);
  };

  const handleDragEnd = async () => {
    if (draggedItem !== null && dropTarget !== null && draggedItem !== dropTarget) {
      const newFactors = [...algorithmFactors];
      const [moved] = newFactors.splice(draggedItem, 1);
      const insertIndex = draggedItem < dropTarget ? dropTarget - 1 : dropTarget;
      newFactors.splice(insertIndex, 0, moved);
      setAlgorithmFactors(newFactors);
      
      // Save new priorities to database
      try {
        const updates = newFactors.map((factor, index) => ({
          factor_id: factor.id,
          priority: index + 1,
        }));

        for (const update of updates) {
          const { error } = await supabase
            .from("algorithm_settings")
            .update({ priority: update.priority })
            .eq("factor_id", update.factor_id);

          if (error) throw error;
        }

        toast.success("Algorithm priority saved");
      } catch (error: any) {
        console.error("Error saving algorithm priorities:", error);
        toast.error("Failed to save algorithm priorities");
      }
    }
    setDraggedItem(null);
    setDropTarget(null);
  };

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center gap-8 mb-8 pb-4 border-b border-border">
          <h1 className="text-xl font-normal text-foreground">Admin</h1>
          <button 
            onClick={() => navigate("/admin")}
            className="text-xl font-normal text-foreground hover:text-primary transition-colors"
          >
            Admin Users
          </button>
          <button 
            onClick={() => navigate("/admin?tab=users")}
            className="text-xl font-normal text-foreground hover:text-primary transition-colors"
          >
            Users
          </button>
          <button 
            className="text-xl font-normal text-primary border-b-2 border-primary pb-1 transition-colors"
          >
            Settings
          </button>
          <button 
            onClick={handleLogout}
            className="text-xl font-normal text-foreground hover:text-primary transition-colors ml-auto"
          >
            Logout
          </button>
        </div>

        {/* Content Area */}
        <div className="space-y-8">
          {/* Admin Management Section */}
          <div>
            <button
              onClick={() => {
                const newValue = !adminManagementExpanded;
                setAdminManagementExpanded(newValue);
                localStorage.setItem('settings-admin-management-expanded', JSON.stringify(newValue));
              }}
              className="flex items-center gap-2 text-xl font-semibold text-foreground mb-4 hover:text-primary transition-colors"
            >
              {adminManagementExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
              Admin Management
            </button>
            
            {adminManagementExpanded && (
              <>
                {/* Add Admin Form */}
                <div className="bg-muted/50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-medium mb-4">Add Admin by Email</h3>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleAddAdmin}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Admin
                    </Button>
                  </div>
                </div>

                {/* Current Admins List */}
                <div className="space-y-3">
                  <h3 className="text-lg font-medium">Current Admins ({allAdmins.length})</h3>
                  {adminsLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : allAdmins.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                      No admins found
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {allAdmins.map((admin) => (
                        <div
                          key={admin.id}
                          className="flex items-center justify-between bg-muted/30 p-4 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {admin.avatar_url ? (
                              <img
                                src={admin.avatar_url}
                                alt={admin.display_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-primary font-semibold">
                                  {admin.display_name?.[0]?.toUpperCase() || "?"}
                                </span>
                              </div>
                            )}
                            <div>
                              <h4 className="font-medium text-foreground">{admin.display_name || admin.username}</h4>
                              <p className="text-sm text-muted-foreground">{admin.email}</p>
                            </div>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveAdmin(admin.id, admin.display_name || admin.email)}
                            disabled={admin.id === user?.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Categories Section */}
          <div>
            <button
              onClick={() => {
                const newValue = !categoriesExpanded;
                setCategoriesExpanded(newValue);
                localStorage.setItem('settings-categories-expanded', JSON.stringify(newValue));
              }}
              className="flex items-center gap-2 text-xl font-semibold text-foreground mb-4 hover:text-primary transition-colors"
            >
              {categoriesExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
              Video Categories
            </button>
            
            {categoriesExpanded && (
              <>
                {/* Create New Category Form */}
                <div className="bg-muted/50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-medium mb-4">
                    {editingCategory ? "Edit Category" : "Create New Category"}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Category Name*</label>
                      <Input
                        placeholder="e.g., Pop, Rock, Hip Hop"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        maxLength={50}
                      />
                    </div>
                    <div className="flex gap-2">
                      {editingCategory ? (
                        <>
                          <Button onClick={handleUpdateCategory}>
                            Update Category
                          </Button>
                          <Button variant="outline" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button onClick={handleCreateCategory}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Category
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Categories List */}
                <div className="space-y-3">
                  <h3 className="text-lg font-medium">Existing Categories ({categories.length})</h3>
                  {categoriesLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : categories.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                      No categories yet. Create your first one above!
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between bg-muted/30 p-4 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground">{category.name}</h4>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(category)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCategoryToDelete(category);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Feed Algorithm Section */}
          <div>
            <button
              onClick={() => {
                const newValue = !algorithmExpanded;
                setAlgorithmExpanded(newValue);
                localStorage.setItem('settings-algorithm-expanded', JSON.stringify(newValue));
              }}
              className="flex items-center gap-2 text-xl font-semibold text-foreground mb-4 hover:text-primary transition-colors"
            >
              {algorithmExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
              Feed Algorithm
            </button>

            {algorithmExpanded && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Drag and drop to reorder the priority of factors in the video feed algorithm. 
                  Higher priority factors (at the top) will have more influence on which videos users see.
                </p>

                <div className="space-y-2">
                  {algorithmFactors.map((factor, index) => (
                    <div key={factor.id} className="relative">
                      {/* Drop indicator line */}
                      {dropTarget === index && draggedItem !== null && draggedItem !== index && (
                        <div className="absolute -top-2 left-0 right-0 h-1 bg-destructive z-50 animate-pulse rounded-full" />
                      )}
                      
                      <div
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-4 bg-muted/30 p-4 rounded-lg hover:bg-muted/50 transition-colors cursor-move ${
                          draggedItem === index ? "opacity-50" : ""
                        }`}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-foreground">{factor.label}</h4>
                          <p className="text-sm text-muted-foreground">{factor.description}</p>
                        </div>
                        <div className="text-muted-foreground">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-foreground mb-2">💡 How the Algorithm Works</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Higher ranked factors have more weight in video selection</li>
                    <li>• The algorithm combines all factors to create a personalized feed</li>
                    <li>• <strong>Random</strong> factor kicks in when user has no preference data (new users)</li>
                    <li>• Changes take effect immediately for all users</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Copyright Notice Section */}
          <div>
            <button
              onClick={() => {
                const newValue = !copyrightExpanded;
                setCopyrightExpanded(newValue);
                localStorage.setItem('settings-copyright-expanded', JSON.stringify(newValue));
              }}
              className="flex items-center gap-2 text-xl font-semibold text-foreground mb-4 hover:text-primary transition-colors"
            >
              {copyrightExpanded ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
              Copyright Notice
            </button>

            {copyrightExpanded && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  This text will appear at the bottom of the Info drawer below the "Listen on" links.
                </p>
                <div className="bg-muted/50 rounded-lg p-6">
                  <label className="block text-sm font-medium mb-2">Copyright Notice Text</label>
                  <textarea
                    value={copyrightNotice}
                    onChange={(e) => setCopyrightNotice(e.target.value)}
                    className="w-full min-h-[100px] p-3 bg-background border border-border rounded-lg text-foreground resize-y"
                    placeholder="Enter copyright notice text..."
                  />
                  <Button onClick={handleSaveCopyrightNotice} className="mt-4">
                    Save Copyright Notice
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{categoryToDelete?.name}"? This will remove the category from all videos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Settings;
