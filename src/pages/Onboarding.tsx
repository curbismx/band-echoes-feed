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
      const width = category.name.length * 10 + 30;
      const height = 40;
      
      let x, y;
      let attempts = 0;
      const maxAttempts = 100;

      do {
        x = Math.random() * (containerWidth - width - padding * 2) + padding;
        y = Math.random() * (containerHeight - height - padding * 2) + padding;
        attempts++;
      } while (attempts < maxAttempts && boxes.some(box => 
        x < box.x + box.width + 10 &&
        x + width + 10 > box.x &&
        y < box.y + box.height + 10 &&
        y + height + 10 > box.y
      ));

      boxes.push({
        id: category.id,
        name: category.name,
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
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
    const padding = 5;

    const checkCollision = (box1: GenreBox, box2: GenreBox) => {
      return box1.x < box2.x + box2.width &&
             box1.x + box1.width > box2.x &&
             box1.y < box2.y + box2.height &&
             box1.y + box1.height > box2.y;
    };

    const animate = () => {
      setGenreBoxes(prevBoxes => {
        const newBoxes = prevBoxes.map(box => ({ ...box }));

        newBoxes.forEach((box, i) => {
          box.x += box.vx;
          box.y += box.vy;

          // Wall collisions
          if (box.x <= padding || box.x + box.width >= containerWidth - padding) {
            box.vx *= -1;
            box.x = box.x <= padding ? padding : containerWidth - padding - box.width;
          }
          if (box.y <= padding || box.y + box.height >= containerHeight - padding) {
            box.vy *= -1;
            box.y = box.y <= padding ? padding : containerHeight - padding - box.height;
          }

          // Box collisions
          newBoxes.forEach((otherBox, j) => {
            if (i !== j && checkCollision(box, otherBox)) {
              const dx = (box.x + box.width / 2) - (otherBox.x + otherBox.width / 2);
              const dy = (box.y + box.height / 2) - (otherBox.y + otherBox.height / 2);
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance > 0) {
                const nx = dx / distance;
                const ny = dy / distance;
                
                const relativeVx = box.vx - otherBox.vx;
                const relativeVy = box.vy - otherBox.vy;
                const speed = relativeVx * nx + relativeVy * ny;
                
                if (speed < 0) {
                  box.vx -= speed * nx;
                  box.vy -= speed * ny;
                  otherBox.vx += speed * nx;
                  otherBox.vy += speed * ny;

                  // Separate overlapping boxes
                  const overlap = (box.width / 2 + otherBox.width / 2) - distance;
                  box.x += nx * overlap / 2;
                  box.y += ny * overlap / 2;
                  otherBox.x -= nx * overlap / 2;
                  otherBox.y -= ny * overlap / 2;
                }
              }
            }
          });
        });

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
