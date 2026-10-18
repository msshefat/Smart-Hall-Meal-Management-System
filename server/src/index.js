const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const { connectDb } = require('./db');
const { User } = require('./models');
const authRoutes = require('./routes/auth');
const hallRoutes = require('./routes/hall');

const app = express();
const port = Number(process.env.PORT || 47241);

app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use(session({
  name: 'hallmeal.sid',
  secret: process.env.SESSION_SECRET || 'hallmeal-mern-dev',
  resave: false,
  saveUninitialized: false,
  unset: 'destroy',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.setHeader('x-csrf-token', req.session.csrf);
  next();
});

app.use(async (req, res, next) => {
  try {
    req.user = null;
    if (!req.session.userId) return next();
    const user = await User.findById(req.session.userId);
    if (!user || user.status !== 'active') {
      return req.session.destroy(() => res.status(401).json({ message: 'Sign in again.' }));
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
});

app.use((req, res, next) => {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method)) return next();
  if (req.path === '/api/login') return next();
  const token = req.get('x-csrf-token');
  if (!req.session || !req.session.csrf || token !== req.session.csrf) {
    return res.status(403).json({ message: 'The form expired. Refresh the page and try again.' });
  }
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', authRoutes);
app.use('/api', hallRoutes);
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'That page is not part of the hall system.' });
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res, next) => {
  const index = path.join(clientDist, 'index.html');
  res.sendFile(index, (error) => {
    if (error) res.status(404).json({ message: 'That page is not part of the hall system.' });
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  const status = error.status || 500;
  const message = status === 400 || status === 409
    ? error.message
    : 'The page could not be completed. Check that MongoDB is running, then try again.';
  res.status(status).json({ message });
});

connectDb()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`HallMeal API at http://127.0.0.1:${port}`);
    });
  })
  .catch((error) => {
    console.error('Could not connect to MongoDB.');
    console.error(error.message);
    process.exit(1);
  });
