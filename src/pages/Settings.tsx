import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

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
        description: categoryForm.description.trim() || null,
      });

    if (error) {
      console.error("Error creating category:", error);
      toast.error("Failed to create category");
    } else {
      toast.success("Category created successfully");
      setCategoryForm({ name: "", description: "" });
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
        description: categoryForm.description.trim() || null,
      })
      .eq("id", editingCategory);

    if (error) {
      console.error("Error updating category:", error);
      toast.error("Failed to update category");
    } else {
      toast.success("Category updated successfully");
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "" });
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
      description: category.description || "",
    });
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setCategoryForm({ name: "", description: "" });
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
          <h1 className="text-2xl font-semibold text-foreground">Feed Algorithm Settings</h1>
        </div>

        {/* Content Area */}
        <div className="space-y-8">
          {/* Categories Section */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">Video Categories</h2>
            
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
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    placeholder="Optional description..."
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    maxLength={200}
                    rows={3}
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
                        {category.description && (
                          <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                        )}
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
