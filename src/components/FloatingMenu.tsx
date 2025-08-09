// FloatingMenu.tsx - Eski içerik + Yeni güzel tasarım

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSounds } from '@/hooks/useSounds';
import { Button } from '@/components/ui/button';
import { GlobalChat } from '@/components/GlobalChat';
import {
  User,
  Settings,
  ShoppingCart,
  LogOut,
  Menu as MenuIcon,
  X,
  Home,
  MessageCircle
} from 'lucide-react';

const menuItems = [
  { title: 'Ana Sayfa', route: '/', icon: Home, color: 'from-blue-500 to-blue-600', hoverColor: 'hover:from-blue-600 hover:to-blue-700' },
  { title: 'Profil', route: '/profile', icon: User, color: 'from-green-500 to-green-600', hoverColor: 'hover:from-green-600 hover:to-green-700' },
  { title: 'Market', route: '/market', icon: ShoppingCart, color: 'from-purple-500 to-purple-600', hoverColor: 'hover:from-purple-600 hover:to-purple-700' },
  { title: 'Ayarlar', route: '/settings', icon: Settings, color: 'from-orange-500 to-orange-600', hoverColor: 'hover:from-orange-600 hover:to-orange-700' },
];

export function FloatingMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { playSound } = useSounds();

  const handleToggle = () => {
    playSound('buttonClick');
    setIsOpen(!isOpen);
  };

  const handleMenuClick = (route: string, title: string) => {
    playSound('buttonClick');
    navigate(route);
    setIsOpen(false);
  };

  const handleChatOpen = () => {
    playSound('buttonClick');
    setIsChatOpen(true);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    playSound('buttonClick');
    await signOut();
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

      {/* Menu items - Positioned higher */}
      <div className={`absolute bottom-20 right-0 flex flex-col items-end space-y-3 transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        {/* Regular menu items */}
        {menuItems.map((item, index) => (
          <div
            key={item.route}
            className={`flex items-center space-x-3 transform transition-all duration-300 ${
              isOpen 
                ? 'translate-x-0 scale-100' 
                : 'translate-x-8 scale-75'
            }`}
            style={{ 
              transitionDelay: isOpen ? `${index * 60}ms` : `${(menuItems.length + 2 - index) * 40}ms` 
            }}
          >
            {/* Label with beautiful styling */}
            <div className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
              <span 
                className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
                style={{ 
                  fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.1)' 
                }}
              >
                {item.title}
              </span>
              
              {/* Button */}
              <Button
                onClick={() => handleMenuClick(item.route, item.title)}
                className={`group relative overflow-hidden bg-gradient-to-r ${item.color} ${item.hoverColor} 
                           text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
                           transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}
              >
                {/* Ripple effect background */}
                <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
                
                {/* Icon */}
                <item.icon className="w-4 h-4 relative z-10" />
              </Button>
            </div>
          </div>
        ))}

        {/* Chat Button */}
        <div
          className={`flex items-center space-x-3 transform transition-all duration-300 ${
            isOpen 
              ? 'translate-x-0 scale-100' 
              : 'translate-x-8 scale-75'
          }`}
          style={{ 
            transitionDelay: isOpen ? `${menuItems.length * 60}ms` : `${(2 - menuItems.length) * 40}ms` 
          }}
        >
          <div className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
            <span 
              className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
              style={{ 
                fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.1)' 
              }}
            >
              Sohbet
            </span>
            
            <Button
              onClick={handleChatOpen}
              className="group relative overflow-hidden bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700
                         text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
                         transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
              <MessageCircle className="w-4 h-4 relative z-10" />
            </Button>
          </div>
        </div>

        {/* Logout Button */}
        <div
          className={`flex items-center space-x-3 transform transition-all duration-300 ${
            isOpen 
              ? 'translate-x-0 scale-100' 
              : 'translate-x-8 scale-75'
          }`}
          style={{ 
            transitionDelay: isOpen ? `${(menuItems.length + 1) * 60}ms` : `${(1 - menuItems.length) * 40}ms` 
          }}
        >
          <div className="flex items-center space-x-2 bg-black/80 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-xl">
            <span 
              className="text-sm font-semibold text-white whitespace-nowrap pointer-events-none select-none tracking-wide"
              style={{ 
                fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
                textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 6px rgba(255,255,255,0.1)' 
              }}
            >
              Çıkış
            </span>
            
            <Button
              onClick={handleLogout}
              className="group relative overflow-hidden bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700
                         text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
                         transition-all duration-200 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
              <LogOut className="w-4 h-4 relative z-10" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main toggle button - Fixed position */}
      <div className="fixed bottom-6 right-6">
        <Button
          onClick={handleToggle}
          className={`group relative overflow-hidden w-14 h-14 rounded-full border-2 border-white shadow-2xl 
                     transform transition-all duration-300 hover:scale-110 active:scale-95
                     ${isOpen 
                       ? 'bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 rotate-45' 
                       : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700'
                     }`}
        >
          {/* Pulse animation ring */}
          <div className={`absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 
                          animate-ping opacity-20 ${isOpen ? 'hidden' : ''}`} />
          
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600/50 to-blue-600/50 
                         blur-lg scale-150 opacity-30" />
          
          {/* Button content */}
          <div className="relative z-10 flex items-center justify-center">
            {isOpen ? (
              <X className="w-6 h-6 text-white transition-transform duration-300" />
            ) : (
              <MenuIcon className="w-6 h-6 text-white transition-transform duration-300" />
            )}
          </div>

          {/* Ripple effect on click */}
          <div className="absolute inset-0 bg-white/30 scale-0 group-active:scale-100 
                         transition-transform duration-150 rounded-full" />
        </Button>
      </div>

      {/* Global Chat */}
      <GlobalChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </div>
  );
}