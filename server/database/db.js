import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create database file in server directory
const dbPath = path.join(__dirname, '..', 'xfinance.db');

let SQL;
let db;

// Initialize SQL.js and database
export async function initializeDatabase() {
  try {
    console.log('[Database] Initializing SQL.js...');
    // For Node.js, we can use the default initialization
    SQL = await initSqlJs();

    // Load existing database or create new one
    let dbData = null;
    if (fs.existsSync(dbPath)) {
      console.log('[Database] Loading existing database...');
      dbData = fs.readFileSync(dbPath);
    } else {
      console.log('[Database] Creating new database...');
    }

    db = new SQL.Database(dbData);

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON;');

    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        avatar TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        ticker TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, ticker)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS positions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        ticker TEXT NOT NULL,
        quantity REAL NOT NULL,
        entry_price REAL NOT NULL,
        current_price REAL NOT NULL,
        pnl REAL DEFAULT 0,
        pnl_percent REAL DEFAULT 0,
        type TEXT DEFAULT 'stock',
        option_details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS trade_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        ticker TEXT NOT NULL,
        action TEXT NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        total REAL NOT NULL,
        type TEXT DEFAULT 'stock',
        option_details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY,
        theme TEXT DEFAULT 'dark',
        notifications_enabled INTEGER DEFAULT 1,
        preferences TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);');
    db.run('CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);');
    db.run('CREATE INDEX IF NOT EXISTS idx_trade_history_user ON trade_history(user_id);');
    db.run('CREATE INDEX IF NOT EXISTS idx_trade_history_timestamp ON trade_history(timestamp);');

    // Save database
    saveDatabase();

    console.log('[Database] Database initialized successfully');
  } catch (error) {
    console.error('[Database] Error initializing database:', error);
    throw error;
  }
}

// Save database to file
function saveDatabase() {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    console.error('[Database] Error saving database:', error);
  }
}

// User operations
export const userDb = {
  create: (user) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO users (id, username, email, password_hash, display_name, avatar)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run([
        user.id,
        user.username,
        user.email || null,
        user.passwordHash,
        user.displayName || user.username,
        user.avatar || null
      ]);
      stmt.free();
      saveDatabase();
    } catch (error) {
      // Handle UNIQUE constraint errors
      if (error.message && error.message.includes('UNIQUE constraint')) {
        if (error.message.includes('username')) {
          throw new Error('Username already exists');
        }
        if (error.message.includes('email')) {
          throw new Error('Email already registered');
        }
      }
      throw error;
    }
  },

  findByUsername: (username) => {
    try {
      if (!username) return null;
      
      // Use LOWER() for case-insensitive comparison
      const stmt = db.prepare(`
        SELECT id, username, email, password_hash, display_name, avatar, created_at, updated_at 
        FROM users 
        WHERE LOWER(username) = LOWER(?)
      `);
      stmt.bind([username.trim()]);
      const result = stmt.getAsObject();
      stmt.free();
      
      if (result && result.id) {
        console.log('[Database] Found user:', result.username, 'has password_hash:', !!result.password_hash);
        return result;
      }
      console.log('[Database] User not found for username:', username);
      return null;
    } catch (error) {
      console.error('[Database] Error finding user by username:', error);
      return null;
    }
  },

  findByEmail: (email) => {
    try {
      // Use LOWER() for case-insensitive comparison
      const stmt = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
      stmt.bind([email]);
      const result = stmt.getAsObject();
      stmt.free();
      return result && result.id ? result : null;
    } catch (error) {
      console.error('[Database] Error finding user by email:', error);
      return null;
    }
  },

  findById: (id) => {
    const stmt = db.prepare('SELECT id, username, email, display_name, avatar, created_at FROM users WHERE id = ?');
    stmt.bind([id]);
    const result = stmt.getAsObject();
    stmt.free();
    return result.id ? result : null;
  },

  update: (id, updates) => {
    const fields = [];
    const values = [];
    
    if (updates.displayName) {
      fields.push('display_name = ?');
      values.push(updates.displayName);
    }
    if (updates.avatar) {
      fields.push('avatar = ?');
      values.push(updates.avatar);
    }
    if (updates.passwordHash) {
      fields.push('password_hash = ?');
      values.push(updates.passwordHash);
    }
    
    fields.push('updated_at = datetime("now")');
    values.push(id);
    
    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(values);
    stmt.free();
    saveDatabase();
  },
};

// Watchlist operations
export const watchlistDb = {
  getAll: (userId) => {
    const stmt = db.prepare('SELECT ticker, added_at FROM watchlist WHERE user_id = ? ORDER BY added_at DESC');
    stmt.bind([userId]);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        ticker: row.ticker,
        added_at: row.added_at
      });
    }
    stmt.free();
    return results;
  },

  add: (userId, ticker) => {
    const id = `watchlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const stmt = db.prepare('INSERT OR IGNORE INTO watchlist (id, user_id, ticker) VALUES (?, ?, ?)');
    stmt.run([id, userId, ticker.toUpperCase()]);
    stmt.free();
    saveDatabase();
  },

  remove: (userId, ticker) => {
    const stmt = db.prepare('DELETE FROM watchlist WHERE user_id = ? AND ticker = ?');
    stmt.run([userId, ticker.toUpperCase()]);
    stmt.free();
    saveDatabase();
  },

  clear: (userId) => {
    const stmt = db.prepare('DELETE FROM watchlist WHERE user_id = ?');
    stmt.run([userId]);
    stmt.free();
    saveDatabase();
  },
};

// Positions operations
export const positionsDb = {
  getAll: (userId) => {
    const stmt = db.prepare('SELECT * FROM positions WHERE user_id = ? ORDER BY created_at DESC');
    stmt.bind([userId]);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id,
        ticker: row.ticker,
        quantity: row.quantity,
        entry_price: row.entry_price,
        current_price: row.current_price,
        pnl: row.pnl,
        pnl_percent: row.pnl_percent,
        type: row.type || 'stock',
        option_details: row.option_details,
        created_at: row.created_at
      });
    }
    stmt.free();
    return results;
  },

  getById: (userId, positionId) => {
    const stmt = db.prepare('SELECT * FROM positions WHERE id = ? AND user_id = ?');
    stmt.bind([positionId, userId]);
    const result = stmt.getAsObject();
    stmt.free();
    return result.id ? result : null;
  },

  create: (position) => {
    const stmt = db.prepare(`
      INSERT INTO positions (id, user_id, ticker, quantity, entry_price, current_price, pnl, pnl_percent, type, option_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      position.id,
      position.userId,
      position.ticker,
      position.quantity,
      position.entryPrice,
      position.currentPrice,
      position.pnl || 0,
      position.pnlPercent || 0,
      position.type || 'stock',
      position.optionDetails ? JSON.stringify(position.optionDetails) : null
    ]);
    stmt.free();
    saveDatabase();
  },

  update: (userId, positionId, updates) => {
    const fields = [];
    const values = [];
    
    if (updates.quantity !== undefined) {
      fields.push('quantity = ?');
      values.push(updates.quantity);
    }
    if (updates.currentPrice !== undefined) {
      fields.push('current_price = ?');
      values.push(updates.currentPrice);
    }
    if (updates.pnl !== undefined) {
      fields.push('pnl = ?');
      values.push(updates.pnl);
    }
    if (updates.pnlPercent !== undefined) {
      fields.push('pnl_percent = ?');
      values.push(updates.pnlPercent);
    }
    
    fields.push('updated_at = datetime("now")');
    values.push(positionId, userId);
    
    const stmt = db.prepare(`UPDATE positions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`);
    stmt.run(values);
    stmt.free();
    saveDatabase();
  },

  delete: (userId, positionId) => {
    const stmt = db.prepare('DELETE FROM positions WHERE id = ? AND user_id = ?');
    stmt.run([positionId, userId]);
    stmt.free();
    saveDatabase();
  },

  clear: (userId) => {
    const stmt = db.prepare('DELETE FROM positions WHERE user_id = ?');
    stmt.run([userId]);
    stmt.free();
    saveDatabase();
  },
};

// Trade history operations
export const tradeHistoryDb = {
  getAll: (userId, limit = 100) => {
    const stmt = db.prepare(`
      SELECT * FROM trade_history 
      WHERE user_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    stmt.bind([userId, limit]);
    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id,
        ticker: row.ticker,
        action: row.action,
        quantity: row.quantity,
        price: row.price,
        total: row.total,
        type: row.type || 'stock',
        option_details: row.option_details,
        timestamp: row.timestamp
      });
    }
    stmt.free();
    return results;
  },

  create: (trade) => {
    const stmt = db.prepare(`
      INSERT INTO trade_history (id, user_id, ticker, action, quantity, price, total, type, option_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      trade.id,
      trade.userId,
      trade.ticker,
      trade.action,
      trade.quantity,
      trade.price,
      trade.total,
      trade.type || 'stock',
      trade.optionDetails ? JSON.stringify(trade.optionDetails) : null
    ]);
    stmt.free();
    saveDatabase();
  },
};

// User settings operations
export const settingsDb = {
  get: (userId) => {
    const stmt = db.prepare('SELECT * FROM user_settings WHERE user_id = ?');
    stmt.bind([userId]);
    const result = stmt.getAsObject();
    stmt.free();
    return result.user_id ? result : null;
  },

  createOrUpdate: (userId, settings) => {
    const stmt = db.prepare(`
      INSERT INTO user_settings (user_id, theme, notifications_enabled, preferences)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        theme = excluded.theme,
        notifications_enabled = excluded.notifications_enabled,
        preferences = excluded.preferences,
        updated_at = datetime("now")
    `);
    stmt.run([
      userId,
      settings.theme || 'dark',
      settings.notificationsEnabled !== undefined ? (settings.notificationsEnabled ? 1 : 0) : 1,
      settings.preferences ? JSON.stringify(settings.preferences) : null
    ]);
    stmt.free();
    saveDatabase();
  },
};

// Close database connection (for graceful shutdown)
export function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    console.log('[Database] Database connection closed');
  }
}

// Initialize on import (but make it async-safe)
let initPromise = null;
export function ensureInitialized() {
  if (!initPromise) {
    initPromise = initializeDatabase();
  }
  return initPromise;
}

// Auto-initialize
ensureInitialized().catch(err => {
  console.error('[Database] Failed to initialize:', err);
});

export default db;
