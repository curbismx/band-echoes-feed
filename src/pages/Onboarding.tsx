import { useState } from "react";
import { useNavigate } from "react-router-dom";
import onboarding1 from "@/assets/onboarding-1.png";
import onboarding2 from "@/assets/onboarding-2.png";
import { ChevronRight } from "lucide-react";

const Onboarding = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const navigate = useNavigate();

  const pages = [onboarding1, onboarding2];

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else {
      navigate("/setup-account");
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <img
        src={pages[currentPage]}
        alt={`Onboarding ${currentPage + 1}`}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <button
        onClick={handleNext}
        className="absolute bottom-8 right-8 text-white hover:opacity-80 transition-opacity"
        aria-label="Next"
      >
        <ChevronRight size={48} />
      </button>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {pages.map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentPage ? "bg-white w-8" : "bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Onboarding;
