// Performance monitoring utilities for NFT Selection component
import React from 'react';

interface PerformanceMetrics {
  selectionStartTime?: number;
  selectionEndTime?: number;
  realtimeLatency?: number;
  componentRenderTime?: number;
  cardLoadTime?: number;
  connectionEstablishTime?: number;
}

interface MetricsEvent {
  type: 'selection_time' | 'realtime_latency' | 'render_time' | 'card_load' | 'connection_time';
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private events: MetricsEvent[] = [];
  private isDevelopment = import.meta.env.DEV;

  // Track selection timing
  startSelectionTimer(): void {
    this.metrics.selectionStartTime = performance.now();
  }

  endSelectionTimer(): number | null {
    if (!this.metrics.selectionStartTime) return null;
    
    this.metrics.selectionEndTime = performance.now();
    const duration = this.metrics.selectionEndTime - this.metrics.selectionStartTime;
    
    this.addEvent('selection_time', duration, {
      phase: 'complete'
    });
    
    if (this.isDevelopment) {
      console.log(`🎮 Card selection completed in ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }

  // Track real-time latency
  trackRealtimeLatency(eventTimestamp: number): number {
    const latency = Date.now() - eventTimestamp;
    this.metrics.realtimeLatency = latency;
    
    this.addEvent('realtime_latency', latency, {
      eventTimestamp,
      currentTime: Date.now()
    });
    
    if (this.isDevelopment && latency > 1000) {
      console.warn(`⚠️ High real-time latency detected: ${latency}ms`);
    }
    
    return latency;
  }

  // Track component render performance
  trackRenderTime(componentName: string, renderTime: number): void {
    this.metrics.componentRenderTime = renderTime;
    
    this.addEvent('render_time', renderTime, {
      component: componentName
    });
    
    if (this.isDevelopment && renderTime > 16) { // 60fps threshold
      console.warn(`⚠️ Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
    }
  }

  // Track card loading performance
  trackCardLoadTime(cardCount: number, loadTime: number): void {
    this.metrics.cardLoadTime = loadTime;
    
    this.addEvent('card_load', loadTime, {
      cardCount,
      averagePerCard: loadTime / cardCount
    });
    
    if (this.isDevelopment) {
      console.log(`🃏 Loaded ${cardCount} cards in ${loadTime.toFixed(2)}ms (${(loadTime / cardCount).toFixed(2)}ms per card)`);
    }
  }

  // Track connection establishment time
  trackConnectionTime(connectionType: 'realtime' | 'polling', establishTime: number): void {
    this.metrics.connectionEstablishTime = establishTime;
    
    this.addEvent('connection_time', establishTime, {
      connectionType
    });
    
    if (this.isDevelopment) {
      console.log(`🔌 ${connectionType} connection established in ${establishTime.toFixed(2)}ms`);
    }
  }

  // Add custom event
  private addEvent(type: MetricsEvent['type'], value: number, metadata?: Record<string, any>): void {
    this.events.push({
      type,
      value,
      timestamp: performance.now(),
      metadata
    });
    
    // Keep only last 100 events to prevent memory leaks
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
  }

  // Get performance summary
  getMetricsSummary(): {
    current: PerformanceMetrics;
    averages: Record<string, number>;
    warnings: string[];
  } {
    const averages: Record<string, number> = {};
    const warnings: string[] = [];
    
    // Calculate averages for each event type
    const eventTypes = ['selection_time', 'realtime_latency', 'render_time', 'card_load', 'connection_time'] as const;
    
    eventTypes.forEach(type => {
      const events = this.events.filter(e => e.type === type);
      if (events.length > 0) {
        averages[type] = events.reduce((sum, e) => sum + e.value, 0) / events.length;
      }
    });
    
    // Generate warnings for performance issues
    if (averages.selection_time > 5000) {
      warnings.push('Selection time is unusually high (>5s)');
    }
    
    if (averages.realtime_latency > 2000) {
      warnings.push('Real-time latency is high (>2s)');
    }
    
    if (averages.render_time > 16) {
      warnings.push('Render times are slow (>16ms, affecting 60fps)');
    }
    
    if (averages.card_load > 3000) {
      warnings.push('Card loading is slow (>3s)');
    }
    
    return {
      current: this.metrics,
      averages,
      warnings
    };
  }

  // Export metrics for analytics
  exportMetrics(): {
    session: PerformanceMetrics;
    events: MetricsEvent[];
    timestamp: number;
    userAgent: string;
  } {
    return {
      session: this.metrics,
      events: [...this.events],
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics = {};
    this.events = [];
  }

  // Log performance summary to console (development only)
  logSummary(): void {
    if (!this.isDevelopment) return;
    
    const summary = this.getMetricsSummary();
    
    console.group('🔍 NFT Selection Performance Summary');
    
    if (Object.keys(summary.current).length > 0) {
      console.log('Current Session:', summary.current);
    }
    
    if (Object.keys(summary.averages).length > 0) {
      console.log('Averages:', summary.averages);
    }
    
    if (summary.warnings.length > 0) {
      console.warn('⚠️ Performance Warnings:');
      summary.warnings.forEach(warning => console.warn(`  • ${warning}`));
    }
    
    console.groupEnd();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitoring = () => {
  const startSelection = () => performanceMonitor.startSelectionTimer();
  const endSelection = () => performanceMonitor.endSelectionTimer();
  const trackLatency = (timestamp: number) => performanceMonitor.trackRealtimeLatency(timestamp);
  const trackRender = (componentName: string, time: number) => performanceMonitor.trackRenderTime(componentName, time);
  const trackCardLoad = (count: number, time: number) => performanceMonitor.trackCardLoadTime(count, time);
  const trackConnection = (type: 'realtime' | 'polling', time: number) => performanceMonitor.trackConnectionTime(type, time);
  const getSummary = () => performanceMonitor.getMetricsSummary();
  const exportData = () => performanceMonitor.exportMetrics();
  const logSummary = () => performanceMonitor.logSummary();
  
  return {
    startSelection,
    endSelection,
    trackLatency,
    trackRender,
    trackCardLoad,
    trackConnection,
    getSummary,
    exportData,
    logSummary
  };
};

// Higher-order component for automatic render time tracking
export const withPerformanceTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
) => {
  const WithPerformanceTracking = React.memo((props: P) => {
    const startTime = React.useRef(performance.now());
    
    React.useEffect(() => {
      const endTime = performance.now();
      performanceMonitor.trackRenderTime(componentName, endTime - startTime.current);
    });
    
    return React.createElement(WrappedComponent, props);
  });
  
  WithPerformanceTracking.displayName = `withPerformanceTracking(${componentName})`;
  return WithPerformanceTracking;
};

// Utility for measuring async operations
export const measureAsync = async <T>(
  operation: () => Promise<T>,
  operationType: 'card_load' | 'connection_time',
  metadata?: Record<string, any>
): Promise<T> => {
  const startTime = performance.now();
  
  try {
    const result = await operation();
    const duration = performance.now() - startTime;
    
    if (operationType === 'card_load' && metadata?.cardCount) {
      performanceMonitor.trackCardLoadTime(metadata.cardCount, duration);
    } else if (operationType === 'connection_time' && metadata?.connectionType) {
      performanceMonitor.trackConnectionTime(metadata.connectionType, duration);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    if (import.meta.env.DEV) {
      console.error(`❌ Operation failed after ${duration.toFixed(2)}ms:`, error);
    }
    throw error;
  }
};

export type { PerformanceMetrics, MetricsEvent };
