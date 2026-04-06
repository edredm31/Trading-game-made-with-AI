import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { formatCurrency } from '../lib/utils';
import { Wallet, X } from 'lucide-react';

type OrderType = 'market' | 'limit' | 'stop_loss';

export default function TradePanel() {
  const [amount, setAmount] = useState<string>('10');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [targetPrice, setTargetPrice] = useState<string>('');
  
  const selectedCompanyId = useGameStore(state => state.selectedCompanyId);
  const company = useGameStore(state => selectedCompanyId ? state.companies[selectedCompanyId] : null);
  const user = useGameStore(state => state.user);
  const portfolioItem = useGameStore(state => selectedCompanyId ? state.portfolio[selectedCompanyId] : null);
  const allOrders = useGameStore(state => state.orders);
  const orders = allOrders.filter(o => o.company_id === selectedCompanyId);
  
  const buyStock = useGameStore(state => state.buyStock);
  const sellStock = useGameStore(state => state.sellStock);
  const placeOrder = useGameStore(state => state.placeOrder);
  const cancelOrder = useGameStore(state => state.cancelOrder);

  if (!company || !user) {
    return <div className="p-4 text-gray-500">Select a company to trade</div>;
  }

  const numAmount = parseInt(amount) || 0;
  const numTargetPrice = parseFloat(targetPrice) || 0;
  
  const isMarket = orderType === 'market';
  const effectivePrice = isMarket ? (company.price || 0) : numTargetPrice;
  const totalCost = numAmount * effectivePrice;
  
  const canBuy = user.balance >= totalCost && numAmount > 0 && (isMarket || numTargetPrice > 0);
  const canSell = portfolioItem && portfolioItem.shares >= numAmount && numAmount > 0 && (isMarket || numTargetPrice > 0);

  const handleBuy = () => {
    if (!canBuy) return;
    if (isMarket) {
      buyStock(company.id, numAmount);
    } else {
      placeOrder(company.id, 'buy', orderType, numAmount, numTargetPrice);
      setTargetPrice('');
    }
  };

  const handleSell = () => {
    if (!canSell) return;
    if (isMarket) {
      sellStock(company.id, numAmount);
    } else {
      placeOrder(company.id, 'sell', orderType, numAmount, numTargetPrice);
      setTargetPrice('');
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto custom-scrollbar">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white mb-2">Trade {company.name}</h2>
        <div className="flex items-center justify-between text-sm bg-gray-800 p-3 rounded-lg border border-gray-700">
          <span className="text-gray-400 flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Balance
          </span>
          <span className="font-mono text-white font-medium">{formatCurrency(user.balance || 0)}</span>
        </div>
      </div>

      <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800 mb-4">
        {(['market', 'limit', 'stop_loss'] as OrderType[]).map((type) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
              orderType === type 
                ? 'bg-gray-800 text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {type.replace('_', ' ')}
          </button>
        ))}
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

        {!isMarket && (
          <div>
            <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider font-semibold">Target Price ($)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder={company.price.toFixed(2)}
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
        )}

        <div className="bg-gray-950 p-4 rounded-lg border border-gray-800 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">{isMarket ? 'Market Price' : 'Target Price'}</span>
            <span className="text-white font-mono">{formatCurrency(effectivePrice)}</span>
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
            {isMarket ? 'BUY' : 'PLACE BUY'}
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
            {isMarket ? 'SELL' : 'PLACE SELL'}
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

        {orders.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Pending Orders</h3>
            <div className="space-y-2">
              {orders.map(order => (
                <div key={order.id} className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase ${order.action === 'buy' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {order.action}
                      </span>
                      <span className="text-xs text-gray-400 uppercase">{order.order_type.replace('_', ' ')}</span>
                    </div>
                    <div className="text-sm text-white font-medium mt-1">
                      {order.amount} sh @ {formatCurrency(order.target_price)}
                    </div>
                  </div>
                  <button 
                    onClick={() => cancelOrder(order.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                    title="Cancel Order"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
