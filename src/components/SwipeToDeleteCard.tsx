import React, { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeToDeleteCardProps {
  children: React.ReactNode;
  onDelete: () => void;
  className?: string;
  onClick?: () => void;
}

export function SwipeToDeleteCard({ 
  children, 
  onDelete, 
  className,
  onClick 
}: SwipeToDeleteCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [startX, setStartX] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const currentX = e.touches[0].clientX;
    const diffX = startX - currentX;
    
    // Sadece sola kaydırmaya izin ver (pozitif değerler)
    if (diffX > 0) {
      setDragX(Math.min(diffX, 80)); // Maksimum 80px
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // Eğer 50px'den fazla kaydırıldıysa silme işlemini tetikle
    if (dragX > 50) {
      onDelete();
    }
    
    // Animation ile geri döndür
    setDragX(0);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const currentX = e.clientX;
    const diffX = startX - currentX;
    
    if (diffX > 0) {
      setDragX(Math.min(diffX, 80));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    
    if (dragX > 50) {
      onDelete();
    }
    
    setDragX(0);
  };

  const handleCardClick = () => {
    // Sadece kaydırma yoksa click event'ini tetikle
    if (dragX === 0 && onClick) {
      onClick();
    }
  };

  return (
    <div className="relative overflow-hidden">
      <Card
        ref={cardRef}
        className={cn(
          'relative transition-transform duration-200 ease-out',
          className
        )}
        style={{
          transform: `translateX(-${dragX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCardClick}
      >
        {children}
      </Card>
      
      {/* Silme butonu - sağda gizli */}
      <div 
        className={cn(
          'absolute right-0 top-0 h-full bg-red-500 flex items-center justify-center transition-all duration-200',
          dragX > 0 ? 'w-20' : 'w-0'
        )}
        style={{
          transform: `translateX(${Math.max(0, 80 - dragX)}px)`,
        }}
      >
        <Trash2 
          className={cn(
            'text-white transition-opacity duration-200',
            dragX > 20 ? 'opacity-100' : 'opacity-0'
          )}
          size={20}
        />
      </div>
    </div>
  );
}