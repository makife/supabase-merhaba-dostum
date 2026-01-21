import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary - Yakalanamayan hataların React ağacını dondurmasını engeller
 * Plugin hataları ve diğer kritik hatalar için güvenlik ağı
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Plugin hatalarını tolere et - sadece logla, UI'ı kırma
    const errorMessage = String(error);
    
    // Capacitor plugin hataları için state'i reset etme
    if (
      errorMessage.includes("not implemented") ||
      errorMessage.includes("Capacitor") ||
      errorMessage.includes("Plugin") ||
      errorMessage.includes("NavigationBar") ||
      errorMessage.includes("StatusBar") ||
      errorMessage.includes("PushNotifications")
    ) {
      console.warn("[ErrorBoundary] Plugin error caught and tolerated:", error.message);
      return { hasError: false, error: null, errorInfo: null };
    }
    
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorMessage = String(error);
    
    // Plugin hatalarını tamamen ignore et
    if (
      errorMessage.includes("not implemented") ||
      errorMessage.includes("Capacitor") ||
      errorMessage.includes("Plugin")
    ) {
      console.log("[ErrorBoundary] Plugin error ignored:", error.message);
      // State'i reset et ki UI normal çalışsın
      this.setState({ hasError: false, error: null, errorInfo: null });
      return;
    }
    
    console.error("[ErrorBoundary] Uncaught error:", error);
    console.error("[ErrorBoundary] Error info:", errorInfo);
    
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback varsa göster
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-6xl">😵</div>
            <h1 className="text-2xl font-bold text-foreground">Bir Şeyler Ters Gitti</h1>
            <p className="text-muted-foreground">
              Uygulama beklenmedik bir hatayla karşılaştı. Lütfen sayfayı yenileyin veya tekrar deneyin.
            </p>
            <div className="space-x-2">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                Tekrar Dene
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90"
              >
                Sayfayı Yenile
              </button>
            </div>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-4 text-left text-xs bg-muted p-3 rounded-lg">
                <summary className="cursor-pointer text-muted-foreground">Hata Detayları</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-destructive">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
