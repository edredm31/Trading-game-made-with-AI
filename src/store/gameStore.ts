import { create } from 'zustand';

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
  user: {
    username: string;
    balance: number;
    netWorth: number;
  };
  portfolio: Record<string, PortfolioItem>;
  companies: Record<string, Company>;
  selectedCompanyId: string | null;
  
  // Actions
  selectCompany: (id: string) => void;
  buyStock: (companyId: string, amount: number) => boolean;
  sellStock: (companyId: string, amount: number) => boolean;
  createCompany: (company: Omit<Company, 'id' | 'history' | 'trend'>) => void;
  tick: () => void;
}

const generateInitialHistory = (startPrice: number): Candle[] => {
  const history: Candle[] = [];
  let currentPrice = startPrice;
  const now = Math.floor(Date.now() / 1000);
  
  // Generate last 60 minutes of data (1 minute candles)
  for (let i = 60; i >= 0; i--) {
    const time = now - i * 60;
    const volatility = currentPrice * 0.02;
    const change = (Math.random() - 0.5) * volatility;
    
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    
    history.push({ time, open, high, low, close });
    currentPrice = close;
  }
  
  return history;
};

const INITIAL_COMPANIES: Record<string, Company> = {
  '1': {
    id: '1',
    name: 'TechNova',
    category: 'Tech',
    description: 'Leading AI and robotics company.',
    price: 150.5,
    totalShares: 1000000,
    history: generateInitialHistory(150.5),
    trend: 0.2,
  },
  '2': {
    id: '2',
    name: 'BurgerCorp',
    category: 'Food',
    description: 'Global fast food chain.',
    price: 45.2,
    totalShares: 5000000,
    history: generateInitialHistory(45.2),
    trend: -0.1,
  },
  '3': {
    id: '3',
    name: 'GameSphere',
    category: 'Gaming',
    description: 'Next-gen console manufacturer.',
    price: 89.9,
    totalShares: 2000000,
    history: generateInitialHistory(89.9),
    trend: 0.5,
  }
};

export const useGameStore = create<GameState>((set, get) => ({
  user: {
    username: 'Guest Trader',
    balance: 1000000,
    netWorth: 1000000,
  },
  portfolio: {},
  companies: INITIAL_COMPANIES,
  selectedCompanyId: '1',

  selectCompany: (id) => set({ selectedCompanyId: id }),

  buyStock: (companyId, amount) => {
    const state = get();
    const company = state.companies[companyId];
    const cost = company.price * amount;

    if (state.user.balance >= cost) {
      set((state) => {
        const currentPortfolio = state.portfolio[companyId] || { companyId, shares: 0, averagePrice: 0 };
        const newShares = currentPortfolio.shares + amount;
        const newAveragePrice = ((currentPortfolio.shares * currentPortfolio.averagePrice) + cost) / newShares;

        return {
          user: {
            ...state.user,
            balance: state.user.balance - cost,
          },
          portfolio: {
            ...state.portfolio,
            [companyId]: {
              companyId,
              shares: newShares,
              averagePrice: newAveragePrice,
            }
          }
        };
      });
      return true;
    }
    return false;
  },

  sellStock: (companyId, amount) => {
    const state = get();
    const company = state.companies[companyId];
    const currentPortfolio = state.portfolio[companyId];

    if (currentPortfolio && currentPortfolio.shares >= amount) {
      const revenue = company.price * amount;

      set((state) => {
        const newShares = currentPortfolio.shares - amount;
        const newPortfolio = { ...state.portfolio };
        
        if (newShares === 0) {
          delete newPortfolio[companyId];
        } else {
          newPortfolio[companyId] = {
            ...currentPortfolio,
            shares: newShares,
          };
        }

        return {
          user: {
            ...state.user,
            balance: state.user.balance + revenue,
          },
          portfolio: newPortfolio,
        };
      });
      return true;
    }
    return false;
  },

  createCompany: (companyData) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newCompany: Company = {
      ...companyData,
      id,
      history: generateInitialHistory(companyData.price),
      trend: (Math.random() - 0.5) * 0.5, // Random initial trend
    };

    set((state) => ({
      companies: {
        ...state.companies,
        [id]: newCompany,
      }
    }));
  },

  tick: () => {
    set((state) => {
      const newCompanies = { ...state.companies };
      let totalPortfolioValue = 0;
      const now = Math.floor(Date.now() / 1000);

      Object.values(newCompanies).forEach(company => {
        // Random walk with trend
        const volatility = company.price * 0.015; // 1.5% volatility per tick
        const trendEffect = company.trend * volatility * 0.5;
        const randomEffect = (Math.random() - 0.5) * volatility;
        
        let newPrice = company.price + trendEffect + randomEffect;
        if (newPrice < 0.01) newPrice = 0.01; // Prevent negative prices

        // Update trend slowly
        let newTrend = company.trend + (Math.random() - 0.5) * 0.1;
        if (newTrend > 1) newTrend = 1;
        if (newTrend < -1) newTrend = -1;

        // Update history (last candle or new candle)
        const history = [...company.history];
        const lastCandle = history[history.length - 1];
        
        // Create a new candle every 60 seconds, otherwise update current
        if (now - lastCandle.time >= 60) {
          history.push({
            time: now,
            open: company.price,
            high: Math.max(company.price, newPrice),
            low: Math.min(company.price, newPrice),
            close: newPrice
          });
          if (history.length > 100) history.shift(); // Keep last 100 candles
        } else {
          history[history.length - 1] = {
            ...lastCandle,
            high: Math.max(lastCandle.high, newPrice),
            low: Math.min(lastCandle.low, newPrice),
            close: newPrice
          };
        }

        newCompanies[company.id] = {
          ...company,
          price: newPrice,
          trend: newTrend,
          history
        };

        // Calculate portfolio value for this company
        if (state.portfolio[company.id]) {
          totalPortfolioValue += state.portfolio[company.id].shares * newPrice;
        }
      });

      return {
        companies: newCompanies,
        user: {
          ...state.user,
          netWorth: state.user.balance + totalPortfolioValue
        }
      };
    });
  }
}));
