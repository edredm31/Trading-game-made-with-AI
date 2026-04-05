/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useGameStore } from './store/gameStore';
import { formatCurrency } from './lib/utils';
import MarketList from './components/MarketList';
import Chart from './components/Chart';
import TradePanel from './components/TradePanel';
import Portfolio from './components/Portfolio';
import CreateCompanyModal from './components/CreateCompanyModal';
import { PlusCircle, Trophy, User } from 'lucide-react';

export default function App() {
  const tick = useGameStore(state => state.tick);
  const user = useGameStore(state => state.user);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Game Loop
  useEffect(() => {
    const interval = setInterval(() => {
      tick();
    }, 2000); // Tick every 2 seconds for fast-paced simulation
    return () => clearInterval(interval);
  }, [tick]);

  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col font-sans overflow-hidden h-screen">
      {/* Top Navbar */}
      <header className="h-14 bg-gray-950 border-b border-gray-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]">
            SE
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
            Stock Empire
          </h1>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 bg-gray-900 px-4 py-1.5 rounded-full border border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">Net Worth</span>
              <span className="font-mono font-bold text-emerald-400">{formatCurrency(user.netWorth)}</span>
            </div>
          </div>

          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-md"
          >
            <PlusCircle className="w-4 h-4" />
            New Company
          </button>
          
          <div className="flex items-center gap-2 text-gray-400 hover:text-white cursor-pointer transition-colors">
            <Trophy className="w-5 h-5" />
          </div>
          
          <div className="flex items-center gap-2 text-gray-400 hover:text-white cursor-pointer transition-colors">
            <User className="w-5 h-5" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Market List */}
        <div className="w-80 shrink-0 flex flex-col">
          <MarketList />
        </div>

        {/* Center Panel - Chart */}
        <div className="flex-1 flex flex-col min-w-0 p-4">
          <Chart />
        </div>

        {/* Right Panel - Trade */}
        <div className="w-80 shrink-0 flex flex-col">
          <TradePanel />
        </div>
      </main>

      {/* Bottom Panel - Portfolio */}
      <footer className="h-48 shrink-0">
        <Portfolio />
      </footer>

      {showCreateModal && (
        <CreateCompanyModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
