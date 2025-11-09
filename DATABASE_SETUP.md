# Database Setup Guide

XFinance now uses **SQLite** for storing user data. This is the easiest and most convenient database solution - no setup required!

## What's Stored in the Database

- **Users**: Account information (username, email, password hash)
- **Watchlist**: User's stock/crypto watchlist
- **Positions**: Paper trading positions
- **Trade History**: All buy/sell transactions
- **User Settings**: Preferences and theme

## Database File

The database file is automatically created at:
```
server/xfinance.db
```

This file is **already in .gitignore** so it won't be committed to Git.

## How It Works

1. **First Run**: When you start the server, the database is automatically created with all necessary tables
2. **User Registration**: When a user registers, their account is saved to the database
3. **Data Persistence**: All watchlist items and positions are saved and persist across sessions
4. **Guest Mode**: Users can still use the app without an account (data stored in browser only)

## Installation

The database packages are already added to `server/package.json`. Just run:

```bash
cd server
npm install
```

This will install:
- `better-sqlite3` - SQLite database driver
- `jsonwebtoken` - JWT authentication tokens

## Environment Variables

Add to `server/.env` (optional, for production):

```env
JWT_SECRET=your-secret-key-here-change-in-production
```

If not set, a default secret is used (fine for development).

## Database Operations

All database operations are handled automatically:

- **Registration/Login**: Creates user and generates JWT token
- **Watchlist**: Automatically syncs with database when user is logged in
- **Positions**: All trades are saved to database and trade history
- **Logout**: Clears local token, but data remains in database

## Backup

To backup the database, simply copy `server/xfinance.db`:

```bash
cp server/xfinance.db server/xfinance.db.backup
```

## Reset Database

To reset the database (delete all data):

```bash
rm server/xfinance.db
```

The database will be recreated on next server start.

## Production Considerations

For production, consider:

1. **Use PostgreSQL/MySQL**: For better performance and scalability
2. **Change JWT_SECRET**: Use a strong, random secret key
3. **Use bcrypt**: Replace SHA-256 password hashing with bcrypt
4. **Add migrations**: Use a migration tool for schema changes
5. **Backup regularly**: Set up automated backups

## Current Implementation

- ✅ SQLite database (file-based, zero setup)
- ✅ JWT authentication
- ✅ User registration/login
- ✅ Watchlist persistence
- ✅ Position tracking
- ✅ Trade history
- ✅ Guest mode (no database)

## Migration to Production Database

If you want to migrate to PostgreSQL or MySQL later:

1. Install the database driver (e.g., `pg` for PostgreSQL)
2. Update `server/database/db.js` to use the new database
3. Update connection strings in `.env`
4. Run migrations to create tables

The API endpoints remain the same, so no frontend changes needed!

