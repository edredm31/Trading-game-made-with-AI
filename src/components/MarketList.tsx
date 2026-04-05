import { useGameStore } from '../store/gameStore';
import { formatCurrency, formatNumber } from '../lib/utils';
import { TrendingUp, TrendingDown, Building2 } from 'lucide-react';

export default function MarketList() {
  const companies = useGameStore(state => Object.values(state.companies));
  const selectedCompanyId = useGameStore(state => state.selectedCompanyId);
  const selectCompany = useGameStore(state => state.selectCompany);

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-500" />
          Market
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {companies.map(company => {
          const isSelected = company.id === selectedCompanyId;
          const isPositive = company.trend >= 0;
          
          return (
            <button
              key={company.id}
              onClick={() => selectCompany(company.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${
                isSelected 
                  ? 'bg-gray-800 border border-gray-700' 
                  : 'hover:bg-gray-800/50 border border-transparent'
              }`}
            >
              <div>
                <div className="font-bold text-white">{company.name}</div>
                <div className="text-xs text-gray-400">{formatNumber(company.totalShares)} shares</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm text-white">{formatCurrency(company.price)}</div>
                <div className={`text-xs flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(company.trend * 100).toFixed(1)}%
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
