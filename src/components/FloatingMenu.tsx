import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSounds } from '@/hooks/useSounds';
import { Button } from '@/components/ui/button';
import {
  User,
  Settings,
  ShoppingCart,
  LogOut,
  Menu,
  X,
  Home
} from 'lucide-react';

const menuItems = [
  { title: 'Ana Sayfa', route: '/', icon: Home, color: 'bg-blue-500 hover:bg-blue-600' },
  { title: 'Profil', route: '/profile', icon: User, color: 'bg-green-500 hover:bg-green-600' },
  { title: 'Market', route: '/market', icon: ShoppingCart, color: 'bg-purple-500 hover:bg-purple-600' },
  { title: 'Ayarlar', route: '/settings', icon: Settings, color: 'bg-orange-500 hover:bg-orange-600' },
];

export function FloatingMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { playSound } = useSounds();

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
      {/* Menu Items */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 space-y-3 animate-in slide-in-from-bottom-5 duration-300">
          {menuItems.map((item, index) => (
            <div
              key={item.route}
              className="flex items-center space-x-3 animate-in slide-in-from-right-5"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="text-lg font-semibold text-white font-painter">
                {item.title}
              </span>
              <Button
                size="sm"
                className={`w-12 h-12 rounded-full shadow-lg ${item.color} text-white border-2 border-white flex items-center justify-center`}
                onClick={() => handleMenuClick(item.route)}
              >
                <item.icon className="w-5 h-5" />
              </Button>
            </div>
          ))}
          
          {/* Logout Button */}
          <div
            className="flex items-center space-x-3 animate-in slide-in-from-right-5"
            style={{ animationDelay: `${menuItems.length * 50}ms` }}
          >
            <span className="text-lg font-semibold text-white font-painter">
              Çıkıs
            </span>
            <Button
              size="sm"
              className="w-12 h-12 rounded-full shadow-lg bg-red-500 hover:bg-red-600 text-white border-2 border-white flex items-center justify-center"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Main FAB Button */}
      <Button
        size="lg"
        className={`w-14 h-14 rounded-full shadow-xl bg-gradient-to-r from-primary to-accent text-white border-2 border-white transition-all duration-300 ${
          isOpen ? 'rotate-45' : 'hover:scale-105'
        }`}
        onClick={handleToggle}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm -z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}