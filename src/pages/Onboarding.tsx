import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import bgImage from "@/assets/onboarding-bg.png";
import logoImage from "@/assets/onboarding-logo.png";
import textImage from "@/assets/onboarding-text.png";
import arrowImage from "@/assets/onboarding-arrow.png";

interface Category {
  id: string;
  name: string;
}

const Onboarding = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .order('name');
      if (data) setCategories(data);
    };
    fetchCategories();
  }, []);

  const handleNext = () => {
    if (currentPage === 0) {
      setCurrentPage(1);
    } else if (currentPage === 1) {
      setCurrentPage(2);
    } else {
      navigate("/setup-account");
    }
  };

  const toggleGenre = (genreId: string) => {
    setSelectedGenres(prev => 
      prev.includes(genreId) 
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    );
  };

  return (
    <div 
      onClick={currentPage === 2 ? undefined : handleNext}
      className="relative h-screen w-screen overflow-hidden"
      style={{
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        cursor: currentPage === 2 ? 'default' : 'pointer'
      }}
    >
      {/* Content overlay */}
      <div className="relative h-full w-full px-6">
        {currentPage === 0 ? (
          <>
            {/* Logo at top - Page 1 */}
            <div className="absolute top-[225px] left-1/2 -translate-x-1/2 w-32 h-32 flex items-center justify-center">
              <img 
                src={logoImage} 
                alt="Eleven Logo" 
                className="w-full h-full object-contain"
              />
            </div>
          </>
        ) : currentPage === 1 ? (
          <>
            {/* Text Image - Page 2 (smaller) */}
            <div className="absolute top-[225px] left-1/2 -translate-x-1/2 w-72 flex items-center justify-center">
              <img 
                src={textImage} 
                alt="Discover new music" 
                className="w-full object-contain"
              />
            </div>
          </>
        ) : (
          <>
            {/* Bouncing Genre Boxes - Page 3 */}
            <div className="absolute top-[225px] left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-md h-[450px] border-2 border-white/30 rounded-lg overflow-hidden"
                 onClick={(e) => e.stopPropagation()}>
              <div className="relative w-full h-full">
                {categories.map((category, index) => {
                  const isSelected = selectedGenres.includes(category.id);
                  return (
                    <div
                      key={category.id}
                      onClick={() => toggleGenre(category.id)}
                      className="absolute px-4 py-2 rounded-full text-white font-semibold cursor-pointer transition-all duration-300"
                      style={{
                        backgroundColor: isSelected ? 'hsl(38 92% 50%)' : 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        animation: `float-${index % 4} ${3 + (index % 3)}s ease-in-out infinite`,
                        left: `${10 + (index * 23) % 60}%`,
                        top: `${10 + (index * 37) % 70}%`,
                        border: isSelected ? '2px solid hsl(38 92% 50%)' : '2px solid rgba(255, 255, 255, 0.3)',
                        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                      }}
                    >
                      {category.name}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Text in middle - Same position for all pages */}
        <div className="absolute top-[828px] left-1/2 -translate-x-1/2 flex items-center justify-center max-w-md">
          <h1 className="text-white text-2xl md:text-3xl font-semibold text-center leading-tight">
            {currentPage === 0 
              ? "JUST GREAT MUSIC" 
              : currentPage === 1 
              ? "AND ANY OTHER GENRE YOU CAN THINK OF"
              : "PLEASE CHOOSE YOUR FAVORITE MUSIC GENRES"}
          </h1>
        </div>

        {/* Arrow at bottom */}
        <div 
          className="absolute bottom-[125px] left-1/2 -translate-x-1/2 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
        >
          <img 
            src={arrowImage} 
            alt="Next" 
            className="w-6 h-6 object-contain"
          />
        </div>
      </div>

      {/* Add keyframe animations */}
      <style>{`
        @keyframes float-0 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(15px, 20px); }
          50% { transform: translate(-10px, 15px); }
          75% { transform: translate(20px, -15px); }
        }
        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-20px, 15px); }
          50% { transform: translate(15px, -20px); }
          75% { transform: translate(-15px, 10px); }
        }
        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(10px, -15px); }
          50% { transform: translate(-15px, 20px); }
          75% { transform: translate(15px, 15px); }
        }
        @keyframes float-3 {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-15px, -20px); }
          50% { transform: translate(20px, 10px); }
          75% { transform: translate(-10px, -15px); }
        }
      `}</style>
    </div>
  );
};

export default Onboarding;
