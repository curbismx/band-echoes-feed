import { useState } from "react";
import { useNavigate } from "react-router-dom";
import bgImage from "@/assets/onboarding-bg.png";
import logoImage from "@/assets/onboarding-logo.png";
import arrowImage from "@/assets/onboarding-arrow.png";

const Onboarding = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentPage === 0) {
      setCurrentPage(1);
    } else {
      navigate("/setup-account");
    }
  };

  return (
    <div 
      onClick={handleNext}
      className="relative h-screen w-screen overflow-hidden cursor-pointer"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Content overlay */}
      <div className="relative h-full w-full flex flex-col items-center px-6">
        {/* Logo at top */}
        <div className="w-32 h-32 flex items-center justify-center mt-[150px]">
          <img 
            src={logoImage} 
            alt="Eleven Logo" 
            className="w-full h-full object-contain"
          />
        </div>

        {/* Text in middle */}
        <div className="flex items-center justify-center max-w-md mt-[175px]">
          {currentPage === 0 ? (
            <h1 className="text-white text-2xl md:text-3xl font-bold text-center leading-tight">
              FINALLY A PLATFORM JUST FOR MUSICIANS
            </h1>
          ) : (
            <h1 className="text-white text-2xl md:text-3xl font-bold text-center leading-tight">
              DISCOVER NEW MUSIC
            </h1>
          )}
        </div>

        {/* Arrow at bottom */}
        <div className="absolute bottom-[50px] left-1/2 -translate-x-1/2">
          <img 
            src={arrowImage} 
            alt="Next" 
            className="w-6 h-6 object-contain"
          />
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
