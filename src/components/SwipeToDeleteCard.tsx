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

  // Touch Events
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
      setDragX(Math.min(diffX, 120)); // Maksimum 120px
    } else {
      setDragX(0); // Sağa kaydırmayı engelle
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // Eğer 60px'den fazla kaydırıldıysa silme işlemini tetikle
    if (dragX > 60) {
      onDelete();
      return;
    }
    
    // Yeterince kaydırılmadıysa smooth geri dönüş
    const resetAnimation = () => {
      setDragX(0);
    };
    
    // Kısa bir gecikme ile geri döndür
    setTimeout(resetAnimation, 10);
  };

  // Mouse Events - State dependency olmadan
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const mouseStartX = e.clientX;
    let currentDragX = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const currentX = e.clientX;
      const diffX = mouseStartX - currentX;
      
      if (diffX > 0) {
        currentDragX = Math.min(diffX, 120);
        setDragX(currentDragX);
      } else {
        currentDragX = 0;
        setDragX(0);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      
      if (currentDragX > 60) {
        onDelete();
      } else {
        setTimeout(() => setDragX(0), 10);
      }

      // Event listener'ları kaldır
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Global event'leri ekle
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Eğer dragging yoksa ve onClick varsa çalıştır
    if (!isDragging && dragX === 0 && onClick) {
      onClick();
    }
  };

  return (
    <div className="relative overflow-hidden">
      <Card
        ref={cardRef}
        className={cn(
          'relative transition-transform duration-200 ease-out select-none',
          isDragging ? 'transition-none' : '',
          className
        )}
        style={{
          transform: `translateX(-${dragX}px)`,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handleCardClick}
        onDragStart={(e) => e.preventDefault()} // Varsayılan drag'i engelle
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

      {/* Progress indicator */}
      {dragX > 0 && (
        <div 
          className="absolute bottom-0 left-0 h-1 bg-red-400 transition-all duration-100"
          style={{
            width: `${Math.min((dragX / 60) * 100, 100)}%`
          }}
        />
      )}
    </div>
  );
}