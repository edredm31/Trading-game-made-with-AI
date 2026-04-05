import { useEffect, useRef } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import { useGameStore } from '../store/gameStore';

export default function Chart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const selectedCompanyId = useGameStore(state => state.selectedCompanyId);
  const company = useGameStore(state => selectedCompanyId ? state.companies[selectedCompanyId] : null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' }, // Tailwind gray-900
        textColor: '#9CA3AF', // Tailwind gray-400
      },
      grid: {
        vertLines: { color: '#1F2937' }, // Tailwind gray-800
        horzLines: { color: '#1F2937' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981', // Tailwind emerald-500
      downColor: '#EF4444', // Tailwind red-500
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Update data when company changes or history updates
  useEffect(() => {
    if (!seriesRef.current || !company) return;
    
    // Sort history by time just in case
    const sortedHistory = [...company.history].sort((a, b) => a.time - b.time);
    
    // Convert to lightweight-charts format
    const chartData = sortedHistory.map(candle => ({
      time: candle.time as any,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    seriesRef.current.setData(chartData);
  }, [company?.history, company?.id]);

  if (!company) {
    return <div className="flex items-center justify-center h-full text-gray-500">Select a company to view chart</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 z-10">
        <div>
          <h2 className="text-xl font-bold text-white">{company.name}</h2>
          <p className="text-sm text-gray-400">{company.category}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-bold text-white">
            ${company.price.toFixed(2)}
          </div>
          <div className={`text-sm font-medium ${company.trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {company.trend >= 0 ? '+' : ''}{(company.trend * 100).toFixed(2)}% Trend
          </div>
        </div>
      </div>
      <div ref={chartContainerRef} className="flex-1 w-full" />
    </div>
  );
}
