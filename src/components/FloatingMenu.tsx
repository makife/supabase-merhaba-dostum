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

      {/* Menu items */}
      <div className={`flex flex-col items-end space-y-3 mb-4 transition-all duration-300 ${
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
              transitionDelay: isOpen ? `${index * 50}ms` : `${(menuItems.length + 2 - index) * 30}ms` 
            }}
          >
            {/* Label with stroke effect */}
            <span 
              className="text-lg font-semibold text-white font-fredoka whitespace-nowrap pointer-events-none select-none"
              style={{ 
                textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000' 
              }}
            >
              {item.title}
            </span>
            
            {/* Button */}
            <Button
              onClick={() => handleMenuClick(item.route, item.title)}
              className={`group relative overflow-hidden bg-gradient-to-r ${item.color} ${item.hoverColor} 
                         text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
                         transition-all duration-200 w-12 h-12 rounded-full flex items-center justify-center`}
            >
              {/* Ripple effect background */}
              <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
              
              {/* Icon */}
              <item.icon className="w-5 h-5 relative z-10" />
            </Button>
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
            transitionDelay: isOpen ? `${menuItems.length * 50}ms` : `${(2 - menuItems.length) * 30}ms` 
          }}
        >
          <span 
            className="text-lg font-semibold text-white font-fredoka whitespace-nowrap pointer-events-none select-none"
            style={{ 
              textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000' 
            }}
          >
            Sohbet
          </span>
          
          <Button
            onClick={handleChatOpen}
            className="group relative overflow-hidden bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700
                       text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
                       transition-all duration-200 w-12 h-12 rounded-full flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
            <MessageCircle className="w-5 h-5 relative z-10" />
          </Button>
        </div>

        {/* Logout Button */}
        <div
          className={`flex items-center space-x-3 transform transition-all duration-300 ${
            isOpen 
              ? 'translate-x-0 scale-100' 
              : 'translate-x-8 scale-75'
          }`}
          style={{ 
            transitionDelay: isOpen ? `${(menuItems.length + 1) * 50}ms` : `${(1 - menuItems.length) * 30}ms` 
          }}
        >
          <span 
            className="text-lg font-semibold text-white font-fredoka whitespace-nowrap pointer-events-none select-none"
            style={{ 
              textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000' 
            }}
          >
            Çıkış
          </span>
          
          <Button
            onClick={handleLogout}
            className="group relative overflow-hidden bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700
                       text-white border-2 border-white shadow-lg hover:shadow-xl transform hover:scale-105 
                       transition-all duration-200 w-12 h-12 rounded-full flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-100 transition-transform duration-300 rounded-full" />
            <LogOut className="w-5 h-5 relative z-10" />
          </Button>
        </div>
      </div>

      {/* Main toggle button */}
      <Button
        onClick={handleToggle}
        className={`group relative overflow-hidden w-14 h-14 rounded-full border-2 border-white shadow-2xl 
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
            <X className="w-6 h-6 text-white transition-transform duration-300" />
          ) : (
            <MenuIcon className="w-6 h-6 text-white transition-transform duration-300" />
          )}
        </div>

        {/* Ripple effect on click */}
        <div className="absolute inset-0 bg-white/30 scale-0 group-active:scale-100 
                       transition-transform duration-150 rounded-full" />
      </Button>

      {/* Global Chat */}
      <GlobalChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </div>
  );
}