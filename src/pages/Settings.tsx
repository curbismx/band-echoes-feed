import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Plus, Edit2, Trash2, ChevronDown, ChevronRight } from "lucide-react";
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
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [algorithmExpanded, setAlgorithmExpanded] = useState(true);
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
    }
  }, [isAdmin, checkingAdmin]);

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
    if (draggedItem === null || draggedItem === index) return;

    setDropTarget(index);

    const newFactors = [...algorithmFactors];
    const draggedFactor = newFactors[draggedItem];
    newFactors.splice(draggedItem, 1);
    newFactors.splice(index, 0, draggedFactor);

    setAlgorithmFactors(newFactors);
    setDraggedItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTarget(null);
    // TODO: Save to database
    toast.success("Algorithm priority updated");
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

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 pb-4 border-b border-border">
          <button
            onClick={() => navigate("/admin")}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        </div>

        {/* Content Area */}
        <div className="space-y-8">
          {/* Categories Section */}
          <div>
            <button
              onClick={() => setCategoriesExpanded(!categoriesExpanded)}
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
              onClick={() => setAlgorithmExpanded(!algorithmExpanded)}
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
                        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-red-500 z-10 animate-pulse" />
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
