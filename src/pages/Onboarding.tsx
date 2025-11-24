import { useState, useEffect, useRef } from "react";
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

interface GenreBox {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
}

const Onboarding = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genreBoxes, setGenreBoxes] = useState<GenreBox[]>([]);
  const animationFrameRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Initialize genre boxes with physics
  useEffect(() => {
    if (categories.length === 0 || currentPage !== 2) return;

    const containerWidth = 400;
    const containerHeight = 550;
    const padding = 10;

    const boxes: GenreBox[] = [];
    
    categories.forEach((category) => {
      const width = Math.min(category.name.length * 10 + 30, containerWidth - padding * 2);
      const height = 40;
      
      let x = Math.random() * (containerWidth - width - padding * 2) + padding;
      let y = Math.random() * (containerHeight - height - padding * 2) + padding;
      
      // Much faster velocities - 8 to 12 pixels per frame
      const speed = 8 + Math.random() * 4;
      const angle = Math.random() * Math.PI * 2;

      boxes.push({
        id: category.id,
        name: category.name,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        width,
        height
      });
    });

    setGenreBoxes(boxes);
  }, [categories, currentPage]);

  // Physics simulation
  useEffect(() => {
    if (currentPage !== 2 || genreBoxes.length === 0) return;

    const containerWidth = 400;
    const containerHeight = 550;
    const padding = 0;

    const animate = () => {
      setGenreBoxes(prevBoxes => {
        const newBoxes = prevBoxes.map(box => ({ ...box }));

        newBoxes.forEach((box) => {
          // Move box
          box.x += box.vx;
          box.y += box.vy;

          // Strict wall collision with energy preservation
          if (box.x <= padding) {
            box.x = padding;
            box.vx = Math.abs(box.vx);
          } else if (box.x + box.width >= containerWidth - padding) {
            box.x = containerWidth - padding - box.width;
            box.vx = -Math.abs(box.vx);
          }
          
          if (box.y <= padding) {
            box.y = padding;
            box.vy = Math.abs(box.vy);
          } else if (box.y + box.height >= containerHeight - padding) {
            box.y = containerHeight - padding - box.height;
            box.vy = -Math.abs(box.vy);
          }
        });

        // Box-to-box collision detection
        for (let i = 0; i < newBoxes.length; i++) {
          for (let j = i + 1; j < newBoxes.length; j++) {
            const box1 = newBoxes[i];
            const box2 = newBoxes[j];
            
            // Check overlap
            if (box1.x < box2.x + box2.width &&
                box1.x + box1.width > box2.x &&
                box1.y < box2.y + box2.height &&
                box1.y + box1.height > box2.y) {
              
              // Calculate centers
              const center1X = box1.x + box1.width / 2;
              const center1Y = box1.y + box1.height / 2;
              const center2X = box2.x + box2.width / 2;
              const center2Y = box2.y + box2.height / 2;
              
              // Separation vector
              const dx = center2X - center1X;
              const dy = center2Y - center1Y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance > 0) {
                // Normalize
                const nx = dx / distance;
                const ny = dy / distance;
                
                // Calculate overlap
                const minDist = (box1.width + box2.width) / 2;
                const overlap = minDist - distance;
                
                // Separate boxes
                box1.x -= nx * overlap / 2;
                box1.y -= ny * overlap / 2;
                box2.x += nx * overlap / 2;
                box2.y += ny * overlap / 2;
                
                // Elastic collision - swap velocities along collision normal
                const v1n = box1.vx * nx + box1.vy * ny;
                const v2n = box2.vx * nx + box2.vy * ny;
                
                box1.vx += (v2n - v1n) * nx;
                box1.vy += (v2n - v1n) * ny;
                box2.vx += (v1n - v2n) * nx;
                box2.vy += (v1n - v2n) * ny;
              }
            }
          }
        }

        return newBoxes;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentPage, genreBoxes.length]);

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
            <div 
              ref={containerRef}
              className="absolute top-[200px] left-1/2 -translate-x-1/2 border-2 border-white/30 rounded-lg overflow-hidden"
              style={{ width: '400px', height: '550px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative w-full h-full">
                {genreBoxes.map((box) => {
                  const isSelected = selectedGenres.includes(box.id);
                  return (
                    <div
                      key={box.id}
                      onClick={() => toggleGenre(box.id)}
                      className="absolute px-4 py-2 rounded-full text-white font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
                      style={{
                        backgroundColor: isSelected ? 'hsl(38 92% 50%)' : 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        left: `${box.x}px`,
                        top: `${box.y}px`,
                        border: isSelected ? '2px solid hsl(38 92% 50%)' : '2px solid rgba(255, 255, 255, 0.3)',
                        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                        pointerEvents: 'auto',
                      }}
                    >
                      {box.name}
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

    </div>
  );
};

export default Onboarding;
