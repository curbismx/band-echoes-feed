import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="text-center px-6">
        <h1 className="mb-4 text-6xl font-bold text-foreground">404</h1>
        <p className="mb-8 text-xl text-muted-foreground">Page not found</p>
        <button 
          onClick={() => navigate("/")}
          className="flex items-center gap-2 mx-auto px-6 py-3 bg-secondary hover:bg-secondary/80 rounded-full text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default NotFound;
