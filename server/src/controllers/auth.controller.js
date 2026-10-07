import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_development_secret_key_policypal_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function register(req, res, next) {
  try {
    const { email, password, full_name, preferred_language = 'en' } = req.body;

    // Check for existing user
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }

    // Hash password with bcrypt cost 10+
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const userRes = await query(
      `INSERT INTO users (email, password_hash, full_name, preferred_language)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, preferred_language, created_at`,
      [email.toLowerCase(), passwordHash, full_name, preferred_language]
    );

    const newUser = userRes.rows[0];

    // Initialize blank user profile
    await query(
      `INSERT INTO profiles (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id]
    );

    const token = generateToken(newUser.id);

    return res.status(201).json({
      success: true,
      data: {
        user: newUser,
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const userRes = await query(
      `SELECT id, email, password_hash, full_name, preferred_language, created_at
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }

    const user = userRes.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }

    const token = generateToken(user.id);
    const safeUser = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      preferred_language: user.preferred_language,
      created_at: user.created_at,
    };

    return res.json({
      success: true,
      data: {
        user: safeUser,
        token,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    return res.json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  // Client discards the token; endpoint returns 200
  return res.json({
    success: true,
    data: {
      message: 'Logged out successfully',
    },
  });
}
