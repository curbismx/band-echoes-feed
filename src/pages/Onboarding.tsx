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
    const padding = 20;

    const boxes: GenreBox[] = [];
    
    // Create boxes with non-overlapping initial positions
    categories.forEach((category) => {
      const width = Math.min(category.name.length * 10 + 30, containerWidth - padding * 2);
      const height = 40;
      
      let x: number, y: number;
      let attempts = 0;
      let overlapping = true;
      
      // Try to find a non-overlapping position
      while (overlapping && attempts < 50) {
        x = Math.random() * (containerWidth - width - padding * 2) + padding;
        y = Math.random() * (containerHeight - height - padding * 2) + padding;
        
        overlapping = boxes.some(existing => 
          x < existing.x + existing.width + 10 &&
          x + width + 10 > existing.x &&
          y < existing.y + existing.height + 10 &&
          y + height + 10 > existing.y
        );
        
        attempts++;
      }
      
      // Decent speed - 4 to 6 pixels per frame
      const speed = 4 + Math.random() * 2;
      const angle = Math.random() * Math.PI * 2;

      boxes.push({
        id: category.id,
        name: category.name,
        x: x!,
        y: y!,
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
    const padding = 5;
    const minSeparation = 5;

    const animate = () => {
      setGenreBoxes(prevBoxes => {
        const newBoxes = prevBoxes.map(box => ({ ...box }));

        // Move boxes first
        newBoxes.forEach((box) => {
          box.x += box.vx;
          box.y += box.vy;
        });

        // Wall collisions with bounce
        newBoxes.forEach((box) => {
          if (box.x <= padding) {
            box.x = padding;
            box.vx = Math.abs(box.vx) * 0.99;
          } else if (box.x + box.width >= containerWidth - padding) {
            box.x = containerWidth - padding - box.width;
            box.vx = -Math.abs(box.vx) * 0.99;
          }
          
          if (box.y <= padding) {
            box.y = padding;
            box.vy = Math.abs(box.vy) * 0.99;
          } else if (box.y + box.height >= containerHeight - padding) {
            box.y = containerHeight - padding - box.height;
            box.vy = -Math.abs(box.vy) * 0.99;
          }
        });

        // Box-to-box collision - multiple passes to resolve all overlaps
        for (let pass = 0; pass < 3; pass++) {
          for (let i = 0; i < newBoxes.length; i++) {
            for (let j = i + 1; j < newBoxes.length; j++) {
              const box1 = newBoxes[i];
              const box2 = newBoxes[j];
              
              // AABB collision detection with separation buffer
              const overlapX = (box1.x < box2.x + box2.width + minSeparation) &&
                              (box1.x + box1.width + minSeparation > box2.x);
              const overlapY = (box1.y < box2.y + box2.height + minSeparation) &&
                              (box1.y + box1.height + minSeparation > box2.y);
              
              if (overlapX && overlapY) {
                // Calculate centers
                const c1x = box1.x + box1.width / 2;
                const c1y = box1.y + box1.height / 2;
                const c2x = box2.x + box2.width / 2;
                const c2y = box2.y + box2.height / 2;
                
                // Direction from box1 to box2
                const dx = c2x - c1x;
                const dy = c2y - c1y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                  const nx = dx / dist;
                  const ny = dy / dist;
                  
                  // Minimum distance needed
                  const minDistX = (box1.width + box2.width) / 2 + minSeparation;
                  const minDistY = (box1.height + box2.height) / 2 + minSeparation;
                  const minDist = Math.sqrt(minDistX * minDistX + minDistY * minDistY) * 0.5;
                  
                  // Separate boxes strongly
                  const overlap = minDist - dist;
                  const separationForce = overlap * 0.55;
                  
                  box1.x -= nx * separationForce;
                  box1.y -= ny * separationForce;
                  box2.x += nx * separationForce;
                  box2.y += ny * separationForce;
                  
                  // Bounce with elastic collision
                  const relVelX = box2.vx - box1.vx;
                  const relVelY = box2.vy - box1.vy;
                  const dotProduct = relVelX * nx + relVelY * ny;
                  
                  if (dotProduct < 0) {
                    const impulse = dotProduct * 1.0;
                    box1.vx += nx * impulse;
                    box1.vy += ny * impulse;
                    box2.vx -= nx * impulse;
                    box2.vy -= ny * impulse;
                  }
                }
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
