import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { detectPlatform, isValidUrl } from "@/utils/platformDetection";
import { getPlatformIcon } from "@/components/PlatformIcons";
import { compressVideo, formatFileSize, getVideoSize, type CompressionProgress } from "@/utils/videoCompression";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string>("");
  const [links, setLinks] = useState<string[]>(["", ""]);
  const [searching, setSearching] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Fetch video data if editing
  useEffect(() => {
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

      // Compress video before uploading
      const originalSize = getVideoSize(selectedVideo);
      
      setIsCompressing(true);
      try {
        toast({
          title: "Processing video...",
          description: "Analyzing video dimensions",
        });
        
        fileToUpload = await compressVideo(selectedVideo, (progress) => {
          setCompressionProgress(progress);
        });
        
        const compressedSize = getVideoSize(fileToUpload);
        const savedPercent = Math.round((1 - compressedSize / originalSize) * 100);
        
        toast({
          title: "Video processed!",
          description: `Size: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${savedPercent}% saved)`,
        });
      } catch (compressionError) {
        console.error("❌ Video processing failed:", compressionError);
        toast({
          title: "Video processing failed",
          description: compressionError instanceof Error ? compressionError.message : "Please try again with a different video",
          variant: "destructive",
        });
        setIsUploading(false);
        setIsCompressing(false);
        setCompressionProgress(null);
        return; // STOP - don't upload if processing fails
      } finally {
        setIsCompressing(false);
        setCompressionProgress(null);
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

  const handleFindLinks = async () => {
    if (!title.trim()) {
      toast({
        title: "Title required",
        description: "Please add a title first to search for music links",
        variant: "destructive",
      });
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('find-music-links', {
        body: { title: title.trim() }
      });

      if (error) throw error;

      if (data.success && data.links) {
        const foundLinks = [
          data.links.spotify,
          data.links.apple_music,
          data.links.tidal,
          data.links.youtube_music,
        ].filter(link => link && link.trim() !== "");

        setLinks(foundLinks.length > 0 ? foundLinks : ["", ""]);
        
        toast({
          title: "Links found!",
          description: `Found ${foundLinks.length} streaming platform${foundLinks.length !== 1 ? 's' : ''}`,
        });
      } else {
        toast({
          title: "No links found",
          description: "Try adding artist name to the title",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Find links error:", error);
      toast({
        title: "Search failed",
        description: "Unable to find music links. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top Gutter for Mobile Status Bar */}
      <div className="h-[25px] flex-shrink-0 bg-black" />
      
      {/* Step 1: Select Video */}
      {step === 1 && (
        <>
          <div className="flex items-center justify-between p-4">
            <button onClick={() => navigate(-1)} className="text-white">
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
            <button onClick={() => editVideoId ? navigate(-1) : setStep(1)} className="text-white">
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
                preload="metadata"
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
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold text-sm">Add Links</h3>
                <Button
                  onClick={handleFindLinks}
                  disabled={searching || !title.trim()}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  {searching ? "Searching..." : "Find Links"}
                </Button>
              </div>
              {links.map((link, index) => {
                const { platform } = link ? detectPlatform(link) : { platform: '' };
                return (
                  <div key={index} className="flex items-center gap-2">
                    {link && isValidUrl(link) && (
                      <div className="text-white">
                        {getPlatformIcon(platform)}
                      </div>
                    )}
                    <input
                      type="url"
                      placeholder="Add links to the music here"
                      value={link}
                      onChange={(e) => {
                        const newLinks = [...links];
                        newLinks[index] = e.target.value;
                        setLinks(newLinks);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setLinks([...links, ""]);
                        }
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
            <h1 className="text-white text-lg font-semibold">{editVideoId ? "Update" : "Post Video"}</h1>
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
            {isCompressing && compressionProgress && (
              <div className="mb-4 p-4 bg-white/10 rounded-lg">
                <div className="flex justify-between text-white text-sm mb-2">
                  <span>Compressing video...</span>
                  <span>{compressionProgress.progress}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${compressionProgress.progress}%` }}
                  />
                </div>
              </div>
            )}
            <Button
              onClick={handleUpload}
              disabled={isUploading || isCompressing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg rounded-xl font-semibold"
            >
              {isCompressing ? "Compressing..." : isUploading ? (editVideoId ? "Updating..." : "Uploading...") : (editVideoId ? "Update" : "Post Video")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default Upload;
