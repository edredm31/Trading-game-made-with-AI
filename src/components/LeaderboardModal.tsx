import { useEffect, useState } from 'react';
import { X, Trophy, TrendingUp, Building2 } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface LeaderboardData {
  users: { username: string; net_worth: number }[];
}

export default function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<LeaderboardData | null>(null);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-950 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Global Leaderboard
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {!data ? (
            <div className="text-center text-gray-500 py-8">Loading rankings...</div>
          ) : (
            <div className="space-y-2">
              {data.users.map((user, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' :
                      index === 1 ? 'bg-gray-300/20 text-gray-300 border border-gray-300/50' :
                      index === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/50' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      #{index + 1}
                    </div>
                    <span className="font-medium text-white">{user.username}</span>
                  </div>
                  <div className="font-mono text-emerald-400 font-bold">
                    {formatCurrency(user.net_worth)}
                  </div>
                </div>
              ))}
              {data.users.length === 0 && (
                <div className="text-center text-gray-500 py-8">No players yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
