import { Router } from 'express';
import { hashPassword, verifyPassword, issueJwt, verifyJwt } from '../lib/auth.js';
import { query, UNIQUE_VIOLATION } from '../lib/db.js';

import { config } from '../lib/config.js';

export const authRouter = Router();

function isEmail(s) {
  return typeof s === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

function isVitStudentEmail(s) {
  if (typeof s !== 'string') return false;
  const clean = s.trim().toLowerCase();
  return clean.endsWith('@vitstudent.ac.in');
}

authRouter.post('/signup', async (req, res, next) => {
  try {
    const { email, password, name, role } = req.body ?? {};
    if (!isEmail(email)) return res.status(400).json({ error: 'invalid_email' });
    
    if (!isVitStudentEmail(email)) {
      return res.status(400).json({
        error: 'vit_email_required',
        message: 'Access restricted: Only official VIT student email addresses (@vitstudent.ac.in) are accepted.',
      });
    }

    if (typeof password !== 'string' || password.length < 6)
      return res.status(400).json({ error: 'password_too_short', min: 6 });
    if (typeof name !== 'string' || !name.trim())
      return res.status(400).json({ error: 'name_required' });

    // CRITICAL: Public signup must NOT allow privileged role escalation
    if (role && role !== 'attendee') {
      return res.status(403).json({
        error: 'role_escalation_forbidden',
        message: 'Public registration is restricted to attendees only.',
      });
    }

    const assignedRole = 'attendee';
    const password_hash = await hashPassword(password);
    let rows;
    try {
      ({ rows } = await query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, role`,
        [email.toLowerCase().trim(), password_hash, name.trim(), assignedRole],
      ));
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION)
        return res.status(409).json({ error: 'email_already_registered' });
      throw err;
    }

    const user = rows[0];
    return res.status(201).json({ token: issueJwt(user), user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/provision-organizer', async (req, res, next) => {
  try {
    const { email, password, name, organizer_key } = req.body ?? {};
    if (!isEmail(email)) return res.status(400).json({ error: 'invalid_email' });
    
    if (!isVitStudentEmail(email)) {
      return res.status(400).json({
        error: 'vit_email_required',
        message: 'Access restricted: Only official VIT student email addresses (@vitstudent.ac.in) are accepted.',
      });
    }

    if (typeof password !== 'string' || password.length < 6)
      return res.status(400).json({ error: 'password_too_short', min: 6 });
    if (typeof name !== 'string' || !name.trim())
      return res.status(400).json({ error: 'name_required' });

    if (!organizer_key || organizer_key !== config.organizerProvisionKey) {
      return res.status(403).json({ error: 'invalid_organizer_provision_key' });
    }

    const password_hash = await hashPassword(password);
    let rows;
    try {
      ({ rows } = await query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, 'organizer')
         RETURNING id, email, name, role`,
        [email.toLowerCase().trim(), password_hash, name.trim()],
      ));
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION)
        return res.status(409).json({ error: 'email_already_registered' });
      throw err;
    }

    const user = rows[0];
    return res.status(201).json({ token: issueJwt(user), user });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!isEmail(email) || typeof password !== 'string')
      return res.status(400).json({ error: 'invalid_credentials' });

    if (!isVitStudentEmail(email)) {
      return res.status(400).json({
        error: 'vit_email_required',
        message: 'Access restricted: Only official VIT student email addresses (@vitstudent.ac.in) are accepted.',
      });
    }

    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (rows.length === 0) return res.status(401).json({ error: 'invalid_credentials' });

    const user = rows[0];
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

    const publicUser = { id: user.id, email: user.email, name: user.name, role: user.role };
    return res.json({ token: issueJwt(publicUser), user: publicUser });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthenticated' });
  try {
    const p = verifyJwt(token);
    return res.json({ user: { id: p.sub, email: p.email, name: p.name, role: p.role } });
  } catch {
    return res.status(401).json({ error: 'invalid_or_expired_token' });
  }
});
