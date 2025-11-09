import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { userDb } from '../database/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * Hash password using SHA-256
 */
function hashPassword(password) {
	return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Verify password against hash
 */
function verifyPassword(password, hash) {
	const hashedPassword = hashPassword(password);
	return hashedPassword === hash;
}

/**
 * Generate JWT token for user
 */
export function generateToken(userId, username) {
	return jwt.sign(
		{ userId, username },
		JWT_SECRET,
		{ expiresIn: JWT_EXPIRES_IN }
	);
}

/**
 * Verify JWT token
 */
export function verifyToken(token) {
	try {
		return jwt.verify(token, JWT_SECRET);
	} catch (error) {
		return null;
	}
}

/**
 * Register a new user
 */
export async function registerUser(username, password, email = null, displayName = null) {
	// Validate inputs
	if (!username || !username.trim()) {
		throw new Error('Username is required');
	}
	
	if (!password || password.length < 6) {
		throw new Error('Password must be at least 6 characters');
	}

	const normalizedUsername = username.trim().toLowerCase();
	const normalizedEmail = email ? email.trim().toLowerCase() : null;

	// Check if username already exists
	const existingUser = userDb.findByUsername(normalizedUsername);
	if (existingUser) {
		throw new Error('Username already exists');
	}

	// Check if email already exists (if provided)
	if (normalizedEmail) {
		const existingEmail = userDb.findByEmail(normalizedEmail);
		if (existingEmail) {
			throw new Error('Email already registered');
		}
	}

	// Create user
	const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	const passwordHash = hashPassword(password);

	try {
		userDb.create({
			id: userId,
			username: normalizedUsername,
			email: normalizedEmail,
			passwordHash,
			displayName: displayName ? displayName.trim() : normalizedUsername,
		});

		// Generate token
		const token = generateToken(userId, normalizedUsername);

		return {
			userId,
			username: normalizedUsername,
			token,
		};
	} catch (error) {
		if (error.message && error.message.includes('already exists')) {
			throw error;
		}
		console.error('[Auth] Registration error:', error);
		throw new Error('Registration failed. Please try again.');
	}
}

/**
 * Login user
 */
export async function loginUser(username, password) {
	if (!username || !password) {
		throw new Error('Username and password are required');
	}

	const normalizedUsername = username.trim().toLowerCase();

	// Find user - try both normalized and original username
	let user = userDb.findByUsername(normalizedUsername);
	
	// If not found with normalized, try original (for backwards compatibility)
	if (!user) {
		user = userDb.findByUsername(username.trim());
	}

	if (!user) {
		console.log('[Auth] User not found for username:', normalizedUsername);
		throw new Error('Invalid username or password');
	}

	// Verify password
	if (!user.password_hash) {
		console.log('[Auth] User found but no password_hash:', user.id);
		throw new Error('Invalid username or password');
	}

	const isValid = verifyPassword(password, user.password_hash);
	
	if (!isValid) {
		console.log('[Auth] Password verification failed for user:', user.username);
		console.log('[Auth] Provided password hash:', hashPassword(password));
		console.log('[Auth] Stored password hash:', user.password_hash);
		throw new Error('Invalid username or password');
	}

	// Generate token
	const token = generateToken(user.id, user.username);

	return {
		userId: user.id,
		username: user.username,
		displayName: user.display_name,
		avatar: user.avatar,
		token,
	};
}

/**
 * Get user by ID (without password)
 */
export function getUserById(userId) {
	const user = userDb.findById(userId);
	if (!user) {
		return null;
	}

	return {
		id: user.id,
		username: user.username,
		email: user.email,
		displayName: user.display_name,
		avatar: user.avatar,
		createdAt: user.created_at,
	};
}

/**
 * Middleware to authenticate requests
 */
export function authenticateToken(req, res, next) {
	const authHeader = req.headers['authorization'];
	const token = authHeader && authHeader.split(' ')[1];

	if (!token) {
		return res.status(401).json({ error: 'Authentication required' });
	}

	const decoded = verifyToken(token);
	if (!decoded) {
		return res.status(403).json({ error: 'Invalid or expired token' });
	}

	req.userId = decoded.userId;
	req.username = decoded.username;
	next();
}
