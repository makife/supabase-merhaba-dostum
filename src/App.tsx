import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthPage from "@/pages/AuthPage";
import HomePage from "@/pages/HomePage";
import GamePage from "@/pages/GamePage";
import ProfilePage from "@/pages/ProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center game-grid">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="text-lg font-medium">Kelimeci yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      } />
      <Route path="/game/vs-computer" element={
        <ProtectedRoute>
          <GamePage gameMode="vs-computer" />
        </ProtectedRoute>
      } />
      <Route path="/game/private-room" element={
        <ProtectedRoute>
          <GamePage gameMode="private-room" />
        </ProtectedRoute>
      } />
      <Route path="/game/random-match" element={
        <ProtectedRoute>
          <GamePage gameMode="random-match" />
        </ProtectedRoute>
      } />
      <Route path="/tournament" element={
        <ProtectedRoute>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Turnuva Modu</h1>
              <p className="text-muted-foreground">Yakında gelecek...</p>
            </div>
          </div>
        </ProtectedRoute>
      } />
      <Route path="/market" element={
        <ProtectedRoute>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Market</h1>
              <p className="text-muted-foreground">Yakında gelecek...</p>
            </div>
          </div>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Ayarlar</h1>
              <p className="text-muted-foreground">Yakında gelecek...</p>
            </div>
          </div>
        </ProtectedRoute>
      } />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
