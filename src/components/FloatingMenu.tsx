// FloatingMenu.tsx - Mobil performans dostu versiyon
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSounds } from '@/hooks/useSounds';
import { Button } from '@/components/ui/button';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { User, Settings, ShoppingCart, LogOut, Menu as MenuIcon, X, Home, MessageCircle, Trophy } from 'lucide-react';

const menuItems = [
  { title: 'Ana Sayfa', route: '/', icon: Home, color: 'from-blue-500 to-blue-600' },
  { title: 'Liderlik', route: '/leaderboard', icon: Trophy, color: 'from-yellow-500 to-amber-600' },
  { title: 'Profil', route: '/profile', icon: User, color: 'from-green-500 to-green-600' },
  { title: 'Market', route: '/market', icon: ShoppingCart, color: 'from-purple-500 to-purple-600' },
  { title: 'Ayarlar', route: '/settings', icon: Settings, color: 'from-orange-500 to-orange-600' },
];

export function FloatingMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { playSound } = useSounds();
  const { unreadCount } = useChatNotifications();

  const handleToggle = () => {
    playSound('buttonClick');
    setIsOpen(!isOpen);
  };

  const handleMenuClick = (route: string) => {
    playSound('buttonClick');
    navigate(route);
    setIsOpen(false);
  };

  const handleLogout = async () => {
    playSound('buttonClick');
    await signOut();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">

      {/* Menü item container */}
      <div className={`absolute bottom-20 right-0 flex flex-col items-end space-y-3 transition-transform duration-200
        ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
        
        {menuItems.map((item, index) => (
          <Button
            key={item.route}
            onClick={() => handleMenuClick(item.route)}
            className={`flex items-center space-x-2 bg-black/80 rounded-full px-3 py-1.5 
                       text-white shadow-md transform transition-all duration-200
                       hover:scale-105 bg-gradient-to-r ${item.color}`}
            style={{ transitionDelay: `${index * 30}ms` }}
          >
            <item.icon className="w-4 h-4" />
            <span className="text-sm font-semibold">{item.title}</span>
          </Button>
        ))}

        {/* Chat Button */}
        <Button
          onClick={() => handleMenuClick('/chat')}
          className="flex items-center space-x-2 bg-teal-500 rounded-full px-3 py-1.5 text-white shadow-md hover:scale-105 transform transition-all duration-200"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm font-semibold">Sohbet</span>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </Button>

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          className="flex items-center space-x-2 bg-red-500 rounded-full px-3 py-1.5 text-white shadow-md hover:scale-105 transform transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-semibold">Çıkış</span>
        </Button>
      </div>

      {/* Main toggle button */}
      <Button
        onClick={handleToggle}
        className={`w-14 h-14 rounded-full shadow-2xl transform transition-transform duration-200
          ${isOpen ? 'bg-red-500 rotate-45' : 'bg-purple-600'}`}
      >
        {isOpen ? <X className="w-6 h-6 text-white" /> : <MenuIcon className="w-6 h-6 text-white" />}
      </Button>

    </div>
  );
}
