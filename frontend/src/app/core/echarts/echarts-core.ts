import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  SVGRenderer,
  CanvasRenderer,
]);

if (typeof globalThis.ResizeObserver === 'undefined') {
  class FallbackResizeObserver {
    observe(): void {
      // No-op for headless jsdom unit test environments
    }
    unobserve(): void {
      // No-op for headless jsdom unit test environments
    }
    disconnect(): void {
      // No-op for headless jsdom unit test environments
    }
  }
  globalThis.ResizeObserver = FallbackResizeObserver as unknown as typeof ResizeObserver;
}

export { echarts };
