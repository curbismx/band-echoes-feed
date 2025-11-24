import { useState } from "react";
import { useNavigate } from "react-router-dom";
import onboarding1 from "@/assets/onboarding-1.png";
import onboarding2 from "@/assets/onboarding-2.png";

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
    <div 
      onClick={handleNext}
      className="relative h-screen w-screen overflow-hidden cursor-pointer"
    >
      <img
        src={pages[currentPage]}
        alt={`Onboarding ${currentPage + 1}`}
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  );
};

export default Onboarding;
