import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // 1. Database Setup
  const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  await db.exec(`
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
  `);

  // Initialize some default companies if empty
  const companyCount = await db.get('SELECT COUNT(*) as count FROM companies');
  if (companyCount.count === 0) {
    const initialCompanies = [
      { id: '1', name: 'TechNova', category: 'Tech', desc: 'Leading AI and robotics company.', price: 150.5, shares: 1000000 },
      { id: '2', name: 'BurgerCorp', category: 'Food', desc: 'Global fast food chain.', price: 45.2, shares: 5000000 },
      { id: '3', name: 'GameSphere', category: 'Gaming', desc: 'Next-gen console manufacturer.', price: 89.9, shares: 2000000 }
    ];

    for (const c of initialCompanies) {
      await db.run(
        'INSERT INTO companies (id, name, category, description, price, total_shares, trend) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [c.id, c.name, c.category, c.desc, c.price, c.shares, (Math.random() - 0.5) * 0.5]
      );
      
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
        
        await db.run(
          'INSERT INTO history (company_id, time, open, high, low, close) VALUES (?, ?, ?, ?, ?, ?)',
          [c.id, time, open, high, low, close]
        );
        currentPrice = close;
      }
    }
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

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
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
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await db.get('SELECT * FROM users WHERE google_id = ?', [profile.id]);
        if (!user) {
          const newId = Math.random().toString(36).substr(2, 9);
          await db.run(
            'INSERT INTO users (id, google_id, username) VALUES (?, ?, ?)',
            [newId, profile.id, profile.displayName]
          );
          user = await db.get('SELECT * FROM users WHERE id = ?', [newId]);
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

  app.get('/api/leaderboard', async (req, res) => {
    try {
      const topUsers = await db.all('SELECT username, net_worth FROM users ORDER BY net_worth DESC LIMIT 50');
      res.json({ users: topUsers });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  });

  // 4. Socket.io Game Logic
  io.on('connection', async (socket) => {
    console.log('Client connected:', socket.id);

    // Send initial state
    const companies = await db.all('SELECT * FROM companies');
    const historyData = await db.all('SELECT * FROM history ORDER BY time ASC');
    
    const formattedCompanies: Record<string, any> = {};
    for (const c of companies) {
      formattedCompanies[c.id] = {
        ...c,
        history: historyData.filter(h => h.company_id === c.id)
      };
    }
    
    socket.emit('initialState', { companies: formattedCompanies });

    socket.on('buyStock', async ({ userId, companyId, amount }) => {
      // Basic transaction logic
      const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
      const company = await db.get('SELECT * FROM companies WHERE id = ?', [companyId]);
      
      if (!user || !company) return;
      
      const cost = company.price * amount;
      if (user.balance >= cost) {
        const portfolio = await db.get('SELECT * FROM portfolio WHERE user_id = ? AND company_id = ?', [userId, companyId]);
        
        await db.run('BEGIN TRANSACTION');
        try {
          await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', [cost, userId]);
          
          if (portfolio) {
            const newShares = portfolio.shares + amount;
            const newAvgPrice = ((portfolio.shares * portfolio.average_price) + cost) / newShares;
            await db.run('UPDATE portfolio SET shares = ?, average_price = ? WHERE user_id = ? AND company_id = ?', 
              [newShares, newAvgPrice, userId, companyId]);
          } else {
            await db.run('INSERT INTO portfolio (user_id, company_id, shares, average_price) VALUES (?, ?, ?, ?)',
              [userId, companyId, amount, company.price]);
          }
          await db.run('COMMIT');
          
          const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
          const updatedPortfolio = await db.all('SELECT * FROM portfolio WHERE user_id = ?', [userId]);
          socket.emit('userUpdated', { user: updatedUser, portfolio: updatedPortfolio });
        } catch (e) {
          await db.run('ROLLBACK');
        }
      }
    });

    socket.on('sellStock', async ({ userId, companyId, amount }) => {
      const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
      const company = await db.get('SELECT * FROM companies WHERE id = ?', [companyId]);
      const portfolio = await db.get('SELECT * FROM portfolio WHERE user_id = ? AND company_id = ?', [userId, companyId]);
      
      if (!user || !company || !portfolio || portfolio.shares < amount) return;
      
      const revenue = company.price * amount;
      
      await db.run('BEGIN TRANSACTION');
      try {
        await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [revenue, userId]);
        
        const newShares = portfolio.shares - amount;
        if (newShares === 0) {
          await db.run('DELETE FROM portfolio WHERE user_id = ? AND company_id = ?', [userId, companyId]);
        } else {
          await db.run('UPDATE portfolio SET shares = ? WHERE user_id = ? AND company_id = ?', [newShares, userId, companyId]);
        }
        await db.run('COMMIT');
        
        const updatedUser = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        const updatedPortfolio = await db.all('SELECT * FROM portfolio WHERE user_id = ?', [userId]);
        socket.emit('userUpdated', { user: updatedUser, portfolio: updatedPortfolio });
      } catch (e) {
        await db.run('ROLLBACK');
      }
    });

    socket.on('createCompany', async ({ ownerId, name, category, description, price, totalShares }) => {
      const id = Math.random().toString(36).substr(2, 9);
      const trend = (Math.random() - 0.5) * 0.5;
      
      await db.run(
        'INSERT INTO companies (id, owner_id, name, category, description, price, total_shares, trend) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, ownerId, name, category, description, price, totalShares, trend]
      );
      
      const now = Math.floor(Date.now() / 1000);
      await db.run(
        'INSERT INTO history (company_id, time, open, high, low, close) VALUES (?, ?, ?, ?, ?, ?)',
        [id, now, price, price, price, price]
      );

      const newCompany = await db.get('SELECT * FROM companies WHERE id = ?', [id]);
      const history = await db.all('SELECT * FROM history WHERE company_id = ?', [id]);
      
      io.emit('companyCreated', { ...newCompany, history });
    });
  });

  // Game Loop (Server-side)
  setInterval(async () => {
    const companies = await db.all('SELECT * FROM companies');
    const now = Math.floor(Date.now() / 1000);
    const updates = [];

    for (const company of companies) {
      const volatility = company.price * 0.015;
      const trendEffect = company.trend * volatility * 0.5;
      const randomEffect = (Math.random() - 0.5) * volatility;
      
      let newPrice = company.price + trendEffect + randomEffect;
      if (newPrice < 0.01) newPrice = 0.01;

      let newTrend = company.trend + (Math.random() - 0.5) * 0.1;
      if (newTrend > 1) newTrend = 1;
      if (newTrend < -1) newTrend = -1;

      await db.run('UPDATE companies SET price = ?, trend = ? WHERE id = ?', [newPrice, newTrend, company.id]);

      // Handle history
      const lastCandle = await db.get('SELECT * FROM history WHERE company_id = ? ORDER BY time DESC LIMIT 1', [company.id]);
      
      let candleUpdate;
      if (!lastCandle || now - lastCandle.time >= 60) {
        // New candle
        await db.run(
          'INSERT INTO history (company_id, time, open, high, low, close) VALUES (?, ?, ?, ?, ?, ?)',
          [company.id, now, company.price, Math.max(company.price, newPrice), Math.min(company.price, newPrice), newPrice]
        );
        candleUpdate = { time: now, open: company.price, high: Math.max(company.price, newPrice), low: Math.min(company.price, newPrice), close: newPrice };
      } else {
        // Update current candle
        const high = Math.max(lastCandle.high, newPrice);
        const low = Math.min(lastCandle.low, newPrice);
        await db.run(
          'UPDATE history SET high = ?, low = ?, close = ? WHERE company_id = ? AND time = ?',
          [high, low, newPrice, company.id, lastCandle.time]
        );
        candleUpdate = { time: lastCandle.time, open: lastCandle.open, high, low, close: newPrice };
      }

      updates.push({
        id: company.id,
        price: newPrice,
        trend: newTrend,
        candle: candleUpdate
      });
    }

    // Broadcast market update
    io.emit('marketTick', updates);

    // Update net worth for all users
    const users = await db.all('SELECT * FROM users');
    for (const user of users) {
      const portfolio = await db.all('SELECT * FROM portfolio WHERE user_id = ?', [user.id]);
      let totalPortfolioValue = 0;
      for (const item of portfolio) {
        const comp = updates.find(u => u.id === item.company_id);
        if (comp) {
          totalPortfolioValue += item.shares * comp.price;
        }
      }
      await db.run('UPDATE users SET net_worth = ? WHERE id = ?', [user.balance + totalPortfolioValue, user.id]);
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
