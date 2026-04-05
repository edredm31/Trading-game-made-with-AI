/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, Component, ErrorInfo, ReactNode } from 'react';
import { useGameStore } from './store/gameStore';
import { formatCurrency } from './lib/utils';
import MarketList from './components/MarketList';
import Chart from './components/Chart';
import TradePanel from './components/TradePanel';
import Portfolio from './components/Portfolio';
import CreateCompanyModal from './components/CreateCompanyModal';
import LeaderboardModal from './components/LeaderboardModal';
import { PlusCircle, Trophy, User, LogIn, LogOut } from 'lucide-react';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-red-500 flex flex-col items-center justify-center p-4">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <pre className="bg-gray-900 p-4 rounded text-sm overflow-auto max-w-full">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const initSocket = useGameStore(state => state.initSocket);
  const setUser = useGameStore(state => state.setUser);
  const user = useGameStore(state => state.user);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    // Check auth status
    fetch('/api/user')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(userData => {
        setUser(userData);
        initSocket();
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoadingAuth(false);
      });
  }, [initSocket, setUser]);

  if (loadingAuth) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
        <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-2xl text-white shadow-[0_0_20px_rgba(37,99,235,0.5)] mb-6">
          SE
        </div>
        <h1 className="text-4xl font-bold mb-2">Fictional Stock Empire</h1>
        <p className="text-gray-400 mb-8 max-w-md text-center">
          A multiplayer stock trading simulation. Build companies, trade stocks, and compete on the global leaderboard.
        </p>
        <a 
          href="/auth/google"
          className="flex items-center gap-3 bg-white text-black px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </a>
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
                <span className="font-mono font-bold text-emerald-400">{formatCurrency(user.netWorth || 0)}</span>
              </div>
            </div>

            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-md"
            >
              <PlusCircle className="w-4 h-4" />
              New Company
            </button>
            
            <button 
              onClick={() => setShowLeaderboard(true)}
              className="flex items-center gap-2 text-gray-400 hover:text-white cursor-pointer transition-colors"
            >
              <Trophy className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 text-gray-400 hover:text-white cursor-pointer transition-colors">
              <span className="text-sm font-medium">{user.username}</span>
              <User className="w-5 h-5" />
            </div>

            <a href="/api/auth/logout" className="flex items-center gap-2 text-red-400 hover:text-red-300 cursor-pointer transition-colors">
              <LogOut className="w-5 h-5" />
            </a>
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

        {showLeaderboard && (
          <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
        )}
      </div>
    </ErrorBoundary>
  );
}
