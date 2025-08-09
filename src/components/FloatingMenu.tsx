// FloatingMenu.tsx - Modern ve güzel tasarım

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useSounds } from '@/hooks/useSounds';
import {
  User,
  Settings,
  ShoppingCart,
  Trophy,
  Menu as MenuIcon,
  X,
  Home
} from 'lucide-react';

export const FloatingMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { playSound } = useSounds();

  const menuItems = [
    {
      icon: Home,
      label: 'Ana Sayfa',
      action: () => navigate('/'),
      color: 'from-blue-500 to-blue-600',
      hoverColor: 'hover:from-blue-600 hover:to-blue-700'
    },
    {
      icon: User,
      label: 'Profil',
      action: () => navigate('/profile'),
      color: 'from-green-500 to-green-600',
      hoverColor: 'hover:from-green-600 hover:to-green-700'
    },
    {
      icon: Settings,
      label: 'Ayarlar',
      action: () => navigate('/settings'),
      color: 'from-purple-500 to-purple-600',
      hoverColor: 'hover:from-purple-600 hover:to-purple-700'
    },
    {
      icon: ShoppingCart,
      label: 'Market',
      action: () => navigate('/market'),
      color: 'from-orange-500 to-orange-600',
      hoverColor: 'hover:from-orange-600 hover:to-orange-700'
    },
    {
      icon: Trophy,
      label: 'Turnuva',
      action: () => navigate('/tournament'),
      color: 'from-yellow-500 to-yellow-600',
      hoverColor: 'hover:from-yellow-600 hover:to-yellow-700'
    }
  ];

  const handleToggle = () => {
    playSound('buttonClick');
    setIsOpen(!isOpen);
  };

  const handleItemClick = (action: () => void, label: string) => {
    playSound('buttonClick');
    action();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Backdrop overlay when menu is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Menu items */}
      <div className={`flex flex-col items-end space-y-3 mb-4 transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        {menuItems.map((item, index) => (
          <div
            key={item.label}
            className={`transform transition-all duration-300 ${
              isOpen 
                ? 'translate-x-0 scale-100' 
                : 'translate-x-8 scale-75'
            }`}
            style={{ 
              transitionDelay: isOpen ? `${index * 50}ms` : `${(menuItems.length - index - 1) * 30}ms` 
            }}
          >
            <Button
              onClick={() => handleItemClick(item.action, item.label)}
              className={`group relative overflow-hidden bg-gradient-to-r ${item.color} ${item.hoverColor} 
                         text-white border-0 shadow-lg hover:shadow-xl transform hover:scale-105 
                         transition-all duration-200 w-14 h-14 rounded-full flex items-center justify-center`}
            >
              {/* Ripple effect background */}
              <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
              
              {/* Icon */}
              <item.icon className="w-6 h-6 relative z-10" />
              
              {/* Tooltip */}
              <div className="absolute right-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 
                            pointer-events-none transition-all duration-200 group-hover:translate-x-0 translate-x-2">
                <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap 
                              shadow-lg border border-gray-700">
                  {item.label}
                  {/* Tooltip arrow */}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-gray-900" />
                </div>
              </div>
            </Button>
          </div>
        ))}
      </div>

      {/* Main toggle button */}
      <Button
        onClick={handleToggle}
        className={`group relative overflow-hidden w-16 h-16 rounded-full border-0 shadow-2xl 
                   transform transition-all duration-300 hover:scale-110 active:scale-95
                   ${isOpen 
                     ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rotate-45' 
                     : 'bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90'
                   }`}
      >
        {/* Pulse animation ring */}
        <div className={`absolute inset-0 rounded-full bg-gradient-to-r from-primary to-accent 
                        animate-ping opacity-20 ${isOpen ? 'hidden' : ''}`} />
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/50 to-accent/50 
                       blur-lg scale-150 opacity-30" />
        
        {/* Button content */}
        <div className="relative z-10 flex items-center justify-center">
          {isOpen ? (
            <X className="w-7 h-7 text-white transition-transform duration-300" />
          ) : (
            <MenuIcon className="w-7 h-7 text-white transition-transform duration-300" />
          )}
        </div>

        {/* Ripple effect on click */}
        <div className="absolute inset-0 bg-white/30 scale-0 group-active:scale-100 
                       transition-transform duration-150 rounded-full" />
      </Button>
    </div>
  );
};