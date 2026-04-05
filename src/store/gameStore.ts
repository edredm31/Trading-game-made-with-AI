import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Company {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  totalShares: number;
  history: Candle[];
  trend: number; // -1 to 1
}

export interface PortfolioItem {
  companyId: string;
  shares: number;
  averagePrice: number;
}

export interface GameState {
  socket: Socket | null;
  user: {
    id: string | null;
    username: string;
    balance: number;
    netWorth: number;
  } | null;
  portfolio: Record<string, PortfolioItem>;
  companies: Record<string, Company>;
  selectedCompanyId: string | null;
  
  // Actions
  initSocket: () => void;
  setUser: (user: any) => void;
  selectCompany: (id: string) => void;
  buyStock: (companyId: string, amount: number) => void;
  sellStock: (companyId: string, amount: number) => void;
  createCompany: (company: Omit<Company, 'id' | 'history' | 'trend'>) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  socket: null,
  user: null, // Will be set after auth
  portfolio: {},
  companies: {},
  selectedCompanyId: '1',

  initSocket: () => {
    if (get().socket) return;
    
    const socket = io();
    
    socket.on('initialState', ({ companies }) => {
      set({ companies });
      if (!get().selectedCompanyId && Object.keys(companies).length > 0) {
        set({ selectedCompanyId: Object.keys(companies)[0] });
      }
    });

    socket.on('marketTick', (updates: any[]) => {
      set((state) => {
        const newCompanies = { ...state.companies };
        let totalPortfolioValue = 0;

        updates.forEach(update => {
          if (newCompanies[update.id]) {
            const company = newCompanies[update.id];
            const history = [...(company.history || [])];
            
            if (update.candle) {
              const lastCandle = history[history.length - 1];
              if (lastCandle && lastCandle.time === update.candle.time) {
                history[history.length - 1] = update.candle;
              } else {
                history.push(update.candle);
                if (history.length > 100) history.shift();
              }
            }

            newCompanies[update.id] = {
              ...company,
              price: update.price,
              trend: update.trend,
              history
            };

            if (state.portfolio[update.id]) {
              totalPortfolioValue += state.portfolio[update.id].shares * update.price;
            }
          }
        });

        const newState: any = { companies: newCompanies };
        if (state.user) {
          newState.user = {
            ...state.user,
            netWorth: state.user.balance + totalPortfolioValue
          };
        }

        return newState;
      });
    });

    socket.on('userUpdated', ({ user, portfolio }) => {
      const portfolioMap: Record<string, PortfolioItem> = {};
      portfolio.forEach((p: any) => {
        portfolioMap[p.company_id] = {
          companyId: p.company_id,
          shares: p.shares,
          averagePrice: p.average_price
        };
      });
      set({ 
        user: {
          id: user.id,
          username: user.username,
          balance: user.balance,
          netWorth: user.net_worth
        }, 
        portfolio: portfolioMap 
      });
    });

    socket.on('companyCreated', (company) => {
      set((state) => ({
        companies: {
          ...state.companies,
          [company.id]: company
        }
      }));
    });

    set({ socket });
  },

  setUser: (user) => {
    if (user) {
      set({ 
        user: { 
          id: user.id, 
          username: user.username, 
          balance: user.balance, 
          netWorth: user.net_worth || user.netWorth 
        } 
      });
    } else {
      set({ user: null });
    }
  },

  selectCompany: (id) => set({ selectedCompanyId: id }),

  buyStock: (companyId, amount) => {
    const { socket, user } = get();
    if (socket && user) {
      socket.emit('buyStock', { userId: user.id, companyId, amount });
    }
  },

  sellStock: (companyId, amount) => {
    const { socket, user } = get();
    if (socket && user) {
      socket.emit('sellStock', { userId: user.id, companyId, amount });
    }
  },

  createCompany: (companyData) => {
    const { socket, user } = get();
    if (socket && user) {
      socket.emit('createCompany', { 
        ownerId: user.id,
        ...companyData 
      });
    }
  }
}));
