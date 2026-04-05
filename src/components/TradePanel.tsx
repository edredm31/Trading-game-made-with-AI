import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { formatCurrency } from '../lib/utils';
import { Wallet } from 'lucide-react';

export default function TradePanel() {
  const [amount, setAmount] = useState<string>('10');
  const selectedCompanyId = useGameStore(state => state.selectedCompanyId);
  const company = useGameStore(state => selectedCompanyId ? state.companies[selectedCompanyId] : null);
  const user = useGameStore(state => state.user);
  const portfolioItem = useGameStore(state => selectedCompanyId ? state.portfolio[selectedCompanyId] : null);
  const buyStock = useGameStore(state => state.buyStock);
  const sellStock = useGameStore(state => state.sellStock);

  if (!company || !user) {
    return <div className="p-4 text-gray-500">Select a company to trade</div>;
  }

  const numAmount = parseInt(amount) || 0;
  const totalCost = numAmount * (company.price || 0);
  const canBuy = user.balance >= totalCost && numAmount > 0;
  const canSell = portfolioItem && portfolioItem.shares >= numAmount && numAmount > 0;

  const handleBuy = () => {
    if (canBuy) {
      buyStock(company.id, numAmount);
    }
  };

  const handleSell = () => {
    if (canSell) {
      sellStock(company.id, numAmount);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800 p-4">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white mb-2">Trade {company.name}</h2>
        <div className="flex items-center justify-between text-sm bg-gray-800 p-3 rounded-lg border border-gray-700">
          <span className="text-gray-400 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Balance
          </span>
          <span className="font-mono text-white font-medium">{formatCurrency(user.balance || 0)}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Amount (Shares)</label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>

        <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Price per share</span>
            <span className="text-white font-mono">{formatCurrency(company.price || 0)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-gray-800 pt-2 mt-2">
            <span className="text-gray-300">Total Value</span>
            <span className="text-white font-mono">{formatCurrency(totalCost)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <button
            onClick={handleBuy}
            disabled={!canBuy}
            className={`py-3 rounded-lg font-bold transition-all ${
              canBuy 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            BUY
          </button>
          <button
            onClick={handleSell}
            disabled={!canSell}
            className={`py-3 rounded-lg font-bold transition-all ${
              canSell 
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            SELL
          </button>
        </div>

        {portfolioItem && (
          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-900/50 rounded-lg">
            <h3 className="text-xs text-blue-400 uppercase tracking-wider font-semibold mb-2">Your Position</h3>
            <div className="flex justify-between items-center">
              <span className="text-white font-bold">{portfolioItem.shares} Shares</span>
              <div className="text-right">
                <div className="text-sm text-gray-400">Avg: {formatCurrency(portfolioItem.averagePrice)}</div>
                <div className={`text-sm font-bold ${(company.price || 0) >= (portfolioItem.averagePrice || 0) ? 'text-emerald-500' : 'text-red-500'}`}>
                  {formatCurrency(((company.price || 0) - (portfolioItem.averagePrice || 0)) * portfolioItem.shares)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
