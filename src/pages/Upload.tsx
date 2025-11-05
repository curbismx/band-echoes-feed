import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { compressVideo, formatFileSize, CompressionProgress } from "@/utils/videoCompression";
import { Progress } from "@/components/ui/progress";

const Upload = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch compression setting
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
  }, []);

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
          console.error("Compression failed:", compressionError);
          toast({
            title: "Compression skipped",
            description: "Uploading original video",
            variant: "destructive",
          });
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
      const { error: dbError } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          video_url: publicUrl,
          caption: caption || null,
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
            <button onClick={() => navigate(-1)} className="text-white">
              <X size={28} />
            </button>
            <h1 className="text-white text-lg font-semibold">New post</h1>
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
            <button onClick={() => setStep(1)} className="text-white">
              <ArrowLeft size={28} />
            </button>
            <h1 className="text-white text-lg font-semibold">New post</h1>
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

            <Textarea
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="bg-transparent border-none text-white placeholder:text-gray-500 resize-none text-base"
              rows={6}
            />
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
            <h1 className="text-white text-lg font-semibold">Share</h1>
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

            {caption && (
              <div className="mb-6">
                <p className="text-white text-sm mb-1 font-semibold">Caption:</p>
                <p className="text-white/80 text-sm">{caption}</p>
              </div>
            )}

            <div className="text-white/60 text-xs text-center mb-4">
              Your video will be visible to everyone
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
            
            {compressionEnabled && !isUploading && (
              <div className="mb-3 text-center text-xs text-white/60">
                Video will be compressed before upload
              </div>
            )}
            
            <Button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg rounded-xl font-semibold"
            >
              {isUploading ? "Uploading..." : "Share"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default Upload;
