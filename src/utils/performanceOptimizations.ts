// Performance Optimization Utilities
import { useCallback, useMemo, useRef, useEffect, useState } from 'react';

// Debounce hook for performance
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Throttle hook for performance
export const useThrottle = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const lastRan = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastRan.current >= delay) {
      callback(...args);
      lastRan.current = now;
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        callback(...args);
        lastRan.current = Date.now();
      }, delay - (now - lastRan.current));
    }
  }, [callback, delay]) as T;
};

// Memory efficient state batching
export const useBatchedState = <T>(initialState: T) => {
  const [state, setState] = useState<T>(initialState);
  const batchRef = useRef<Partial<T>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const batchUpdate = useCallback((updates: Partial<T>) => {
    batchRef.current = { ...batchRef.current, ...updates };
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setState(current => ({ ...current, ...batchRef.current }));
      batchRef.current = {};
      timeoutRef.current = null;
    }, 16); // 1 frame delay
  }, []);

  const immediatUpdate = useCallback((updates: Partial<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setState(current => ({ ...current, ...batchRef.current, ...updates }));
    batchRef.current = {};
  }, []);

  return [state, batchUpdate, immediatUpdate] as const;
};

// Optimized large list virtualization
export const useVirtualizedList = <T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(start + visibleCount + 2, items.length); // +2 for buffer
    
    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      index: visibleRange.start + index,
      top: (visibleRange.start + index) * itemHeight
    }));
  }, [items, visibleRange, itemHeight]);

  const totalHeight = items.length * itemHeight;

  return {
    visibleItems,
    totalHeight,
    setScrollTop,
    visibleRange
  };
};

// Smart memoization for complex objects
export const useDeepMemo = <T>(factory: () => T, deps: any[]): T => {
  const ref = useRef<{ deps: any[], value: T }>();
  
  if (!ref.current || !depsEqual(ref.current.deps, deps)) {
    ref.current = {
      deps: [...deps],
      value: factory()
    };
  }
  
  return ref.current.value;
};

const depsEqual = (a: any[], b: any[]): boolean => {
  if (a.length !== b.length) return false;
  
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  
  return true;
};

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());
  const [renderStats, setRenderStats] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderDuration: 0
  });

  useEffect(() => {
    renderCountRef.current++;
    const now = Date.now();
    const renderDuration = now - lastRenderTimeRef.current;
    
    setRenderStats(prev => ({
      renderCount: renderCountRef.current,
      lastRenderDuration: renderDuration,
      averageRenderTime: (prev.averageRenderTime * (renderCountRef.current - 1) + renderDuration) / renderCountRef.current
    }));
    
    lastRenderTimeRef.current = now;

    // Performance uyarıları
    if (renderDuration > 16) { // 60fps için 16ms threshold
      console.warn(`⚠️ Slow render in ${componentName}: ${renderDuration}ms`);
    }
    
    if (renderCountRef.current % 100 === 0) {
      console.log(`📊 ${componentName} stats:`, renderStats);
    }
  });

  return renderStats;
};

// Memory cleanup utility
export const useMemoryCleanup = () => {
  const cleanupFunctions = useRef<(() => void)[]>([]);

  const addCleanup = useCallback((cleanupFn: () => void) => {
    cleanupFunctions.current.push(cleanupFn);
  }, []);

  const runCleanup = useCallback(() => {
    cleanupFunctions.current.forEach(fn => {
      try {
        fn();
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
    cleanupFunctions.current = [];
  }, []);

  useEffect(() => {
    return runCleanup;
  }, [runCleanup]);

  return { addCleanup, runCleanup };
};

// Bundle size analyzer
export const analyzeBundleUsage = () => {
  const unusedModules: string[] = [];
  const heavyModules: string[] = [];
  
  // Dinamik import'lar için lazy loading önerileri
  const lazyLoadingSuggestions = [
    'LoadingScreen', 
    'TournamentCard', 
    'PrivateChat',
    
  ];

  return {
    unusedModules,
    heavyModules,
    lazyLoadingSuggestions,
    recommendations: [
      'Lazy load heavy components',
      'Split vendor bundles',
      'Use dynamic imports for routes',
      'Implement code splitting'
    ]
  };
};

// Database query optimization helpers
export const optimizeQuery = {
  // Batch multiple queries
  batch: (queries: Array<() => Promise<any>>) => {
    return Promise.all(queries.map(query => query()));
  },

  // Query result caching
  cache: new Map<string, { data: any, timestamp: number }>(),
  
  getCached: (key: string, maxAge: number = 5 * 60 * 1000) => {
    const cached = optimizeQuery.cache.get(key);
    if (cached && Date.now() - cached.timestamp < maxAge) {
      return cached.data;
    }
    return null;
  },
  
  setCached: (key: string, data: any) => {
    optimizeQuery.cache.set(key, { data, timestamp: Date.now() });
  },

  // Clear old cache entries
  clearOldCache: () => {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [key, value] of optimizeQuery.cache) {
      if (now - value.timestamp > maxAge) {
        optimizeQuery.cache.delete(key);
      }
    }
  }
};

// Performance timer
export const performanceTimer = {
  start: (label: string) => {
    console.time(label);
  },
  
  end: (label: string) => {
    console.timeEnd(label);
  },
  
  mark: (label: string) => {
    if (performance.mark) {
      performance.mark(label);
    }
  },
  
  measure: (name: string, startMark: string, endMark: string) => {
    if (performance.measure) {
      performance.measure(name, startMark, endMark);
    }
  }
};

// Global performance optimization setup
export const initializePerformanceOptimizations = () => {
  // Clear query cache periodically
  setInterval(() => {
    optimizeQuery.clearOldCache();
  }, 5 * 60 * 1000); // Every 5 minutes

  // Monitor memory usage
  if ('memory' in performance) {
    setInterval(() => {
      const memory = (performance as any).memory;
      if (memory.usedJSHeapSize > 100 * 1024 * 1024) { // 100MB
        console.warn('🚨 High memory usage detected:', {
          used: `${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB`,
          limit: `${Math.round(memory.jsHeapSizeLimit / 1024 / 1024)}MB`
        });
      }
    }, 30 * 1000); // Every 30 seconds
  }

  console.log('✅ Performance optimizations initialized');
};