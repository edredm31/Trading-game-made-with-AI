import { useGameStore } from '../store/gameStore';
import { formatCurrency } from '../lib/utils';
import { Briefcase, TrendingUp, TrendingDown } from 'lucide-react';

export default function Portfolio() {
  const portfolio = useGameStore(state => state.portfolio);
  const companies = useGameStore(state => state.companies);
  const selectCompany = useGameStore(state => state.selectCompany);

  const portfolioItems = Object.values(portfolio);

  if (portfolioItems.length === 0) {
    return (
      <div className="h-full bg-gray-900 border-t border-gray-800 p-4 flex items-center justify-center text-gray-500">
        <Briefcase className="w-5 h-5 mr-2 opacity-50" />
        Your portfolio is empty. Buy some stocks to get started!
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 border-t border-gray-800 flex flex-col">
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-950">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Open Positions</h3>
      </div>
      <div className="flex-1 overflow-x-auto p-4 flex gap-4 custom-scrollbar">
        {portfolioItems.map(item => {
          const company = companies[item.companyId];
          if (!company) return null;

          const currentValue = item.shares * company.price;
          const totalCost = item.shares * item.averagePrice;
          const profit = currentValue - totalCost;
          const profitPercent = (profit / totalCost) * 100;
          const isPositive = profit >= 0;

          return (
            <button
              key={item.companyId}
              onClick={() => selectCompany(item.companyId)}
              className="flex-shrink-0 w-64 bg-gray-800 border border-gray-700 rounded-lg p-3 hover:bg-gray-750 transition-colors text-left"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-white truncate pr-2">{company.name}</div>
                <div className="text-xs text-gray-400 whitespace-nowrap">{item.shares} sh</div>
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xs text-gray-500">Value</div>
                  <div className="font-mono text-sm text-white">{formatCurrency(currentValue)}</div>
                </div>
                <div className="text-right">
                  <div className={`text-xs flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {formatCurrency(Math.abs(profit))}
                  </div>
                  <div className={`text-xs ${isPositive ? 'text-emerald-500/80' : 'text-red-500/80'}`}>
                    {isPositive ? '+' : ''}{profitPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
