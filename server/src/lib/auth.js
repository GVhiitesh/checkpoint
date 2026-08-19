import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function issueJwt(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    config.jwtSecret,
    { expiresIn: '12h' },
  );
}

export function verifyJwt(token) {
  return jwt.verify(token, config.jwtSecret);
}
