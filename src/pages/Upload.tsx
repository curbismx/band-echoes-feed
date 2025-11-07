import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { compressVideo, formatFileSize, CompressionProgress } from "@/utils/videoCompression";
import { Progress } from "@/components/ui/progress";
import { detectPlatform, isValidUrl } from "@/utils/platformDetection";

const Upload = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const editVideoId = searchParams.get("edit");
  const [step, setStep] = useState(editVideoId ? 2 : 1);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string>("");
  const [links, setLinks] = useState<string[]>(["", ""]);

  // Fetch compression setting and video data if editing
  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "video_compression_enabled")
        .single();
      
      if (data?.setting_value && typeof data.setting_value === 'object') {
        const settings = data.setting_value as { enabled: boolean };
        setCompressionEnabled(settings.enabled);
      }
    };
    fetchSettings();

    // Load existing video data if editing
    if (editVideoId) {
      const fetchVideo = async () => {
        const { data, error } = await supabase
          .from("videos")
          .select("*")
          .eq("id", editVideoId)
          .single();
        
        if (data && !error) {
          setCaption(data.caption || "");
          setTitle(data.title || "");
          setVideoPreview(data.video_url);
          setExistingVideoUrl(data.video_url);
          // Load existing links
          if (data.links && Array.isArray(data.links) && data.links.length > 0) {
            setLinks(data.links.map((l: any) => l.url || ""));
          }
        } else {
          toast({
            title: "Error",
            description: "Could not load video data",
            variant: "destructive",
          });
          navigate("/profile");
        }
      };
      fetchVideo();
    }
  }, [editVideoId, navigate, toast]);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      setSelectedVideo(file);
      const preview = URL.createObjectURL(file);
      setVideoPreview(preview);
      setStep(2);
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a video file",
        variant: "destructive",
      });
    }
  };

  const handleUpload = async () => {
    // If editing, only update the metadata
    if (editVideoId && existingVideoUrl) {
      setIsUploading(true);
      try {
        // Filter out empty links and validate
        const validLinks = links
          .filter(link => link.trim() !== "")
          .filter(link => isValidUrl(link))
          .map(url => ({ url }));

        const { error: dbError } = await supabase
          .from("videos")
          .update({
            caption: caption || null,
            title: title || null,
            links: validLinks,
          })
          .eq("id", editVideoId);

        if (dbError) throw dbError;

        toast({
          title: "Video updated!",
          description: "Your video has been updated successfully",
        });

        navigate("/profile");
      } catch (error) {
        console.error("Update error:", error);
        toast({
          title: "Update failed",
          description: "Unable to update video. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Original upload logic for new videos
    if (!selectedVideo) return;

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to upload videos",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      let fileToUpload: File | Blob = selectedVideo;
      setOriginalSize(selectedVideo.size);

      // Compress video if enabled
      if (compressionEnabled) {
        toast({
          title: "Compressing video...",
          description: "This may take a moment",
        });

        try {
          const compressedBlob = await compressVideo(selectedVideo, (progress) => {
            setCompressionProgress(progress);
          });
          
          fileToUpload = compressedBlob;
          setCompressedSize(compressedBlob.size);
          
          const savings = ((1 - compressedBlob.size / selectedVideo.size) * 100).toFixed(0);
          toast({
            title: "Compression complete!",
            description: `Saved ${savings}% (${formatFileSize(selectedVideo.size - compressedBlob.size)})`,
          });
        } catch (compressionError) {
          console.error("Compression failed, uploading original:", compressionError);
          // Silently fall back to original video without notifying user
        }
      }

      // Upload video to storage
      const fileExt = selectedVideo.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(fileName, fileToUpload);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("videos")
        .getPublicUrl(fileName);

      // Create video record
      const validLinks = links
        .filter(link => link.trim() !== "")
        .filter(link => isValidUrl(link))
        .map(url => ({ url }));

      const { error: dbError } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          video_url: publicUrl,
          caption: caption || null,
          title: title || null,
          links: validLinks,
        });

      if (dbError) throw dbError;

      toast({
        title: "Video uploaded!",
        description: "Your video has been shared successfully",
      });

      navigate("/profile");
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Unable to upload video. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Step 1: Select Video */}
      {step === 1 && (
        <>
          <div className="flex items-center justify-between p-4">
            <button onClick={() => navigate("/profile")} className="text-white">
              <X size={28} />
            </button>
            <h1 className="text-white text-lg font-semibold">{editVideoId ? "Edit post" : "New post"}</h1>
            <div className="w-7" />
          </div>

          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-xl"
              >
                Select Video
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoSelect}
                className="hidden"
              />
            </div>
          </div>
        </>
      )}

      {/* Step 2: Add Caption */}
      {step === 2 && (
        <>
          <div className="flex items-center justify-between p-4">
            <button onClick={() => editVideoId ? navigate("/profile") : setStep(1)} className="text-white">
              <ArrowLeft size={28} />
            </button>
            <h1 className="text-white text-lg font-semibold">{editVideoId ? "Edit post" : "New post"}</h1>
            <button
              onClick={() => setStep(3)}
              className="text-blue-500 font-semibold"
            >
              Next
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <video
                src={videoPreview}
                className="w-full max-h-[400px] rounded-lg object-contain bg-black"
                controls
              />
            </div>

            <input
              type="text"
              placeholder="Add a title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent border-none text-white placeholder:text-gray-500 text-base mb-4 outline-none"
            />

            <Textarea
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="bg-transparent border-none text-white placeholder:text-gray-500 resize-none text-base mb-6"
              rows={4}
            />

            {/* Links Section */}
            <div className="space-y-3">
              <h3 className="text-white font-semibold text-sm">Add Links</h3>
              {links.map((link, index) => {
                const { platform, icon } = link ? detectPlatform(link) : { platform: '', icon: '' };
                return (
                  <div key={index} className="flex items-center gap-2">
                    {link && isValidUrl(link) && (
                      <span className="text-xl">{icon}</span>
                    )}
                    <input
                      type="url"
                      placeholder="https://spotify.com/..."
                      value={link}
                      onChange={(e) => {
                        const newLinks = [...links];
                        newLinks[index] = e.target.value;
                        setLinks(newLinks);
                      }}
                      className="flex-1 bg-white/5 border border-white/10 text-white placeholder:text-gray-500 text-sm p-3 rounded-lg outline-none focus:border-white/30 transition-colors"
                    />
                    {links.length > 2 && (
                      <button
                        onClick={() => setLinks(links.filter((_, i) => i !== index))}
                        className="text-red-400 hover:text-red-300 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => setLinks([...links, ""])}
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add another link
              </button>
            </div>
          </div>
        </>
      )}

      {/* Step 3: Confirm & Share */}
      {step === 3 && (
        <>
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setStep(2)} className="text-white">
              <ArrowLeft size={28} />
            </button>
            <h1 className="text-white text-lg font-semibold">{editVideoId ? "Update" : "Share"}</h1>
            <div className="w-7" />
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-6">
              <video
                src={videoPreview}
                className="w-full max-h-[300px] rounded-lg object-contain bg-black"
                controls
              />
            </div>

            {title && (
              <div className="mb-4">
                <p className="text-white text-sm mb-1 font-semibold">Title:</p>
                <p className="text-white/80 text-sm">{title}</p>
              </div>
            )}

            {caption && (
              <div className="mb-6">
                <p className="text-white text-sm mb-1 font-semibold">Caption:</p>
                <p className="text-white/80 text-sm">{caption}</p>
              </div>
            )}

            <div className="text-white/60 text-xs text-center mb-4">
              {editVideoId ? "Your changes will be saved" : "Your video will be visible to everyone"}
            </div>
          </div>

          <div className="p-4">
            {compressionProgress && isUploading && (
              <div className="mb-4 space-y-2">
                <div className="flex justify-between text-white text-sm">
                  <span>{compressionProgress.status}</span>
                  <span>{compressionProgress.progress}%</span>
                </div>
                <Progress value={compressionProgress.progress} className="h-2" />
              </div>
            )}
            
            {compressionEnabled && !isUploading && !editVideoId && (
              <div className="mb-3 text-center text-xs text-white/60">
                Video will be compressed before upload
              </div>
            )}
            
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg rounded-xl font-semibold"
            >
              {isUploading ? (editVideoId ? "Updating..." : "Uploading...") : (editVideoId ? "Update" : "Share")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default Upload;
