import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // 1. Database Setup
  const db = new Database('./database.sqlite');
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE,
      username TEXT,
      balance REAL DEFAULT 1000000,
      net_worth REAL DEFAULT 1000000
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      name TEXT,
      category TEXT,
      description TEXT,
      price REAL,
      total_shares INTEGER,
      trend REAL DEFAULT 0,
      FOREIGN KEY(owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS portfolio (
      user_id TEXT,
      company_id TEXT,
      shares INTEGER,
      average_price REAL,
      PRIMARY KEY (user_id, company_id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS history (
      company_id TEXT,
      time INTEGER,
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      FOREIGN KEY(company_id) REFERENCES companies(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      company_id TEXT,
      action TEXT,
      order_type TEXT,
      amount INTEGER,
      target_price REAL,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(company_id) REFERENCES companies(id)
    );
  `);

  // Initialize some default companies if empty
  const companyCount = db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number };
  if (companyCount.count === 0) {
    const initialCompanies = [
      { id: '1', name: 'TechNova', category: 'Tech', desc: 'Leading AI and robotics company.', price: 150.5, shares: 1000000 },
      { id: '2', name: 'BurgerCorp', category: 'Food', desc: 'Global fast food chain.', price: 45.2, shares: 5000000 },
      { id: '3', name: 'GameSphere', category: 'Gaming', desc: 'Next-gen console manufacturer.', price: 89.9, shares: 2000000 }
    ];

    const insertCompany = db.prepare('INSERT INTO companies (id, name, category, description, price, total_shares, trend) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertHistory = db.prepare('INSERT INTO history (company_id, time, open, high, low, close) VALUES (?, ?, ?, ?, ?, ?)');

    const insertInitialData = db.transaction(() => {
      for (const c of initialCompanies) {
        insertCompany.run(c.id, c.name, c.category, c.desc, c.price, c.shares, (Math.random() - 0.5) * 0.5);
        
        // Generate initial history
        let currentPrice = c.price;
        const now = Math.floor(Date.now() / 1000);
        for (let i = 60; i >= 0; i--) {
          const time = now - i * 60;
          const volatility = currentPrice * 0.02;
          const change = (Math.random() - 0.5) * volatility;
          const open = currentPrice;
          const close = currentPrice + change;
          const high = Math.max(open, close) + Math.random() * volatility * 0.5;
          const low = Math.min(open, close) - Math.random() * volatility * 0.5;
          
          insertHistory.run(c.id, time, open, high, low, close);
          currentPrice = close;
        }
      }
    });
    
    insertInitialData();
  }

  // 2. Session & Passport Setup
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS in prod
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser((id: string, done) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.APP_URL}/auth/google/callback`
    }, (accessToken, refreshToken, profile, done) => {
      try {
        let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
        if (!user) {
          const newId = Math.random().toString(36).substr(2, 9);
          db.prepare('INSERT INTO users (id, google_id, username) VALUES (?, ?, ?)').run(newId, profile.id, profile.displayName);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
        }
        return done(null, user);
      } catch (err) {
        return done(err as Error, undefined);
      }
    }));
  }

  // 3. API Routes
  app.use(express.json());

  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
      res.redirect('/');
    }
  );

  app.get('/api/auth/logout', (req, res) => {
    req.logout(() => {
      res.redirect('/');
    });
  });

  app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });

  app.get('/api/leaderboard', (req, res) => {
    try {
      const topUsers = db.prepare('SELECT username, net_worth FROM users ORDER BY net_worth DESC LIMIT 50').all();
      res.json({ users: topUsers });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // 4. Socket.io Game Logic
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send initial state
    const companies = db.prepare('SELECT * FROM companies').all() as any[];
    const historyData = db.prepare('SELECT * FROM history ORDER BY time ASC').all() as any[];
    
    const formattedCompanies: Record<string, any> = {};
    for (const c of companies) {
      formattedCompanies[c.id] = {
        ...c,
        ownerId: c.owner_id,
        totalShares: c.total_shares,
        history: historyData.filter(h => h.company_id === c.id)
      };
    }
    
    socket.emit('initialState', { companies: formattedCompanies });

    // Send user's orders if they are authenticated (wait, we don't know who they are until they do something, or we can send it when they authenticate)
    // Actually, the frontend sends a request or we can just send it when they login.
    // Let's add an event to fetch user data including orders.
    socket.on('fetchUserData', (userId) => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      const portfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ?').all(userId);
      const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? AND status = ?').all(userId, 'pending');
      socket.emit('userUpdated', { user, portfolio, orders });
    });

    socket.on('buyStock', ({ userId, companyId, amount }) => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      
      if (!user || !company) return;
      
      const cost = company.price * amount;
      if (user.balance >= cost) {
        const portfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ? AND company_id = ?').get(userId, companyId) as any;
        
        const transaction = db.transaction(() => {
          db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(cost, userId);
          
          if (portfolio) {
            const newShares = portfolio.shares + amount;
            const newAvgPrice = ((portfolio.shares * portfolio.average_price) + cost) / newShares;
            db.prepare('UPDATE portfolio SET shares = ?, average_price = ? WHERE user_id = ? AND company_id = ?')
              .run(newShares, newAvgPrice, userId, companyId);
          } else {
            db.prepare('INSERT INTO portfolio (user_id, company_id, shares, average_price) VALUES (?, ?, ?, ?)')
              .run(userId, companyId, amount, company.price);
          }
        });

        try {
          transaction();
          const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
          const updatedPortfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ?').all(userId);
          const updatedOrders = db.prepare('SELECT * FROM orders WHERE user_id = ? AND status = ?').all(userId, 'pending');
          socket.emit('userUpdated', { user: updatedUser, portfolio: updatedPortfolio, orders: updatedOrders });
        } catch (e) {
          console.error('Buy transaction failed', e);
        }
      }
    });

    socket.on('sellStock', ({ userId, companyId, amount }) => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      const portfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ? AND company_id = ?').get(userId, companyId) as any;
      
      if (!user || !company || !portfolio || portfolio.shares < amount) return;
      
      const revenue = company.price * amount;
      
      const transaction = db.transaction(() => {
        db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(revenue, userId);
        
        const newShares = portfolio.shares - amount;
        if (newShares === 0) {
          db.prepare('DELETE FROM portfolio WHERE user_id = ? AND company_id = ?').run(userId, companyId);
        } else {
          db.prepare('UPDATE portfolio SET shares = ? WHERE user_id = ? AND company_id = ?').run(newShares, userId, companyId);
        }
      });

      try {
        transaction();
        const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        const updatedPortfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ?').all(userId);
        const updatedOrders = db.prepare('SELECT * FROM orders WHERE user_id = ? AND status = ?').all(userId, 'pending');
        socket.emit('userUpdated', { user: updatedUser, portfolio: updatedPortfolio, orders: updatedOrders });
      } catch (e) {
        console.error('Sell transaction failed', e);
      }
    });

    socket.on('placeOrder', ({ userId, companyId, action, orderType, amount, targetPrice }) => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId) as any;
      
      if (!user || !company || amount <= 0 || targetPrice <= 0) return;

      // Basic validation
      if (action === 'sell') {
        const portfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ? AND company_id = ?').get(userId, companyId) as any;
        if (!portfolio || portfolio.shares < amount) return; // Not enough shares to sell
      } else if (action === 'buy') {
        if (user.balance < targetPrice * amount) return; // Not enough balance
      }

      const orderId = Math.random().toString(36).substr(2, 9);
      const now = Math.floor(Date.now() / 1000);

      try {
        db.prepare(
          'INSERT INTO orders (id, user_id, company_id, action, order_type, amount, target_price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(orderId, userId, companyId, action, orderType, amount, targetPrice, 'pending', now);

        const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        const updatedPortfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ?').all(userId);
        const updatedOrders = db.prepare('SELECT * FROM orders WHERE user_id = ? AND status = ?').all(userId, 'pending');
        socket.emit('userUpdated', { user: updatedUser, portfolio: updatedPortfolio, orders: updatedOrders });
      } catch (e) {
        console.error('Place order failed', e);
      }
    });

    socket.on('cancelOrder', ({ userId, orderId }) => {
      try {
        db.prepare('UPDATE orders SET status = ? WHERE id = ? AND user_id = ?').run('cancelled', orderId, userId);
        
        const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        const updatedPortfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ?').all(userId);
        const updatedOrders = db.prepare('SELECT * FROM orders WHERE user_id = ? AND status = ?').all(userId, 'pending');
        socket.emit('userUpdated', { user: updatedUser, portfolio: updatedPortfolio, orders: updatedOrders });
      } catch (e) {
        console.error('Cancel order failed', e);
      }
    });

    socket.on('createCompany', ({ ownerId, name, category, description, price, totalShares }) => {
      const id = Math.random().toString(36).substr(2, 9);
      const trend = (Math.random() - 0.5) * 0.5;
      const now = Math.floor(Date.now() / 1000);
      
      const transaction = db.transaction(() => {
        db.prepare(
          'INSERT INTO companies (id, owner_id, name, category, description, price, total_shares, trend) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, ownerId, name, category, description, price, totalShares, trend);
        
        db.prepare(
          'INSERT INTO history (company_id, time, open, high, low, close) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(id, now, price, price, price, price);
      });

      try {
        transaction();
        const newCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as any;
        const history = db.prepare('SELECT * FROM history WHERE company_id = ?').all(id);
        io.emit('companyCreated', { ...newCompany, ownerId: newCompany.owner_id, totalShares: newCompany.total_shares, history });
      } catch (e) {
        console.error('Create company failed', e);
      }
    });
  });

  // Game Loop (Server-side)
  setInterval(() => {
    const companies = db.prepare('SELECT * FROM companies').all() as any[];
    const now = Math.floor(Date.now() / 1000);
    const updates = [];

    const updateCompany = db.prepare('UPDATE companies SET price = ?, trend = ? WHERE id = ?');
    const insertHistory = db.prepare('INSERT INTO history (company_id, time, open, high, low, close) VALUES (?, ?, ?, ?, ?, ?)');
    const updateHistory = db.prepare('UPDATE history SET high = ?, low = ?, close = ? WHERE company_id = ? AND time = ?');
    const getLastCandle = db.prepare('SELECT * FROM history WHERE company_id = ? ORDER BY time DESC LIMIT 1');

    const tickTransaction = db.transaction(() => {
      for (const company of companies) {
        const volatility = company.price * 0.015;
        const trendEffect = company.trend * volatility * 0.5;
        const randomEffect = (Math.random() - 0.5) * volatility;
        
        let newPrice = company.price + trendEffect + randomEffect;
        if (newPrice < 0.01) newPrice = 0.01;

        let newTrend = company.trend + (Math.random() - 0.5) * 0.1;
        if (newTrend > 1) newTrend = 1;
        if (newTrend < -1) newTrend = -1;

        updateCompany.run(newPrice, newTrend, company.id);

        // Handle history
        const lastCandle = getLastCandle.get(company.id) as any;
        
        let candleUpdate;
        if (!lastCandle || now - lastCandle.time >= 60) {
          // New candle
          insertHistory.run(company.id, now, company.price, Math.max(company.price, newPrice), Math.min(company.price, newPrice), newPrice);
          candleUpdate = { time: now, open: company.price, high: Math.max(company.price, newPrice), low: Math.min(company.price, newPrice), close: newPrice };
        } else {
          // Update current candle
          const high = Math.max(lastCandle.high, newPrice);
          const low = Math.min(lastCandle.low, newPrice);
          updateHistory.run(high, low, newPrice, company.id, lastCandle.time);
          candleUpdate = { time: lastCandle.time, open: lastCandle.open, high, low, close: newPrice };
        }

        updates.push({
          id: company.id,
          price: newPrice,
          trend: newTrend,
          candle: candleUpdate
        });
      }

      // Process pending orders
      const pendingOrders = db.prepare('SELECT * FROM orders WHERE status = ?').all('pending') as any[];
      const usersToUpdate = new Set<string>();

      for (const order of pendingOrders) {
        const comp = updates.find(u => u.id === order.company_id);
        if (!comp) continue;

        let shouldExecute = false;
        if (order.action === 'buy' && order.order_type === 'limit' && comp.price <= order.target_price) {
          shouldExecute = true;
        } else if (order.action === 'sell' && order.order_type === 'limit' && comp.price >= order.target_price) {
          shouldExecute = true;
        } else if (order.action === 'sell' && order.order_type === 'stop_loss' && comp.price <= order.target_price) {
          shouldExecute = true;
        }

        if (shouldExecute) {
          const user = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id) as any;
          if (!user) continue;

          const cost = comp.price * order.amount;
          const portfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ? AND company_id = ?').get(order.user_id, order.company_id) as any;

          if (order.action === 'buy') {
            if (user.balance >= cost) {
              db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(cost, user.id);
              if (portfolio) {
                const newShares = portfolio.shares + order.amount;
                const newAvgPrice = ((portfolio.shares * portfolio.average_price) + cost) / newShares;
                db.prepare('UPDATE portfolio SET shares = ?, average_price = ? WHERE user_id = ? AND company_id = ?')
                  .run(newShares, newAvgPrice, user.id, order.company_id);
              } else {
                db.prepare('INSERT INTO portfolio (user_id, company_id, shares, average_price) VALUES (?, ?, ?, ?)')
                  .run(user.id, order.company_id, order.amount, comp.price);
              }
              db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('completed', order.id);
              usersToUpdate.add(user.id);
            } else {
              // Cancel if insufficient funds
              db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('cancelled', order.id);
              usersToUpdate.add(user.id);
            }
          } else if (order.action === 'sell') {
            if (portfolio && portfolio.shares >= order.amount) {
              db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(cost, user.id);
              const newShares = portfolio.shares - order.amount;
              if (newShares === 0) {
                db.prepare('DELETE FROM portfolio WHERE user_id = ? AND company_id = ?').run(user.id, order.company_id);
              } else {
                db.prepare('UPDATE portfolio SET shares = ? WHERE user_id = ? AND company_id = ?').run(newShares, user.id, order.company_id);
              }
              db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('completed', order.id);
              usersToUpdate.add(user.id);
            } else {
              // Cancel if insufficient shares
              db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('cancelled', order.id);
              usersToUpdate.add(user.id);
            }
          }
        }
      }

      // Update net worth for all users
      const users = db.prepare('SELECT * FROM users').all() as any[];
      const getPortfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ?');
      const updateUserNetWorth = db.prepare('UPDATE users SET net_worth = ? WHERE id = ?');

      for (const user of users) {
        const portfolio = getPortfolio.all(user.id) as any[];
        let totalPortfolioValue = 0;
        for (const item of portfolio) {
          const comp = updates.find(u => u.id === item.company_id) || companies.find(c => c.id === item.company_id);
          if (comp) {
            totalPortfolioValue += item.shares * comp.price;
          }
        }
        updateUserNetWorth.run(user.balance + totalPortfolioValue, user.id);
      }

      return Array.from(usersToUpdate);
    });

    try {
      const updatedUserIds = tickTransaction();
      // Broadcast market update
      io.emit('marketTick', updates);

      // Send updates to users whose orders executed
      for (const userId of updatedUserIds) {
        const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        const updatedPortfolio = db.prepare('SELECT * FROM portfolio WHERE user_id = ?').all(userId);
        const updatedOrders = db.prepare('SELECT * FROM orders WHERE user_id = ? AND status = ?').all(userId, 'pending');
        // We can't easily emit to a specific user unless we track socket IDs per user.
        // For now, we broadcast the user update and the client filters it.
        io.emit('userUpdated', { user: updatedUser, portfolio: updatedPortfolio, orders: updatedOrders });
      }
    } catch (e) {
      console.error('Tick transaction failed', e);
    }
  }, 2000);

  // 5. Vite Middleware for Development / Static serving for Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
