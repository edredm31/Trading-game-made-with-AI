import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { formatCurrency, formatNumber } from '../lib/utils';
import { X, Users, TrendingUp, TrendingDown } from 'lucide-react';

export default function PlayerMarketplaceModal({ onClose }: { onClose: () => void }) {
  const companies = useGameStore(state => Object.values(state.companies));
  const selectCompany = useGameStore(state => state.selectCompany);
  
  // Filter for player-created companies (those with an owner_id, assuming system companies don't have one or have a specific ID)
  // Since we don't have owner_id in the frontend Company interface yet, let's add it or infer it.
  // Wait, does the frontend Company interface have owner_id? Let's check gameStore.ts.
  // It doesn't. Let's update gameStore.ts to include ownerId.
  
  const playerCompanies = companies.filter(c => c.ownerId);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Player Marketplace</h2>
              <p className="text-sm text-gray-400">Invest in companies created by other players</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {playerCompanies.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No player companies found.</p>
              <p className="text-sm mt-2">Be the first to create one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {playerCompanies.map(company => {
                const isPositive = (company.trend || 0) >= 0;
                
                return (
                  <div 
                    key={company.id}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:bg-gray-800 transition-colors cursor-pointer"
                    onClick={() => {
                      selectCompany(company.id);
                      onClose();
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-white text-lg">{company.name}</h3>
                        <span className="text-xs font-medium text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
                          {company.category}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-lg text-white font-bold">{formatCurrency(company.price || 0)}</div>
                        <div className={`text-sm flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          {Math.abs((company.trend || 0) * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-400 mt-3 line-clamp-2">{company.description}</p>
                    
                    <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center text-sm">
                      <span className="text-gray-500">Total Shares</span>
                      <span className="font-mono text-gray-300">{formatNumber(company.totalShares)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
