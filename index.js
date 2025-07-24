require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// MongoDB connect pakai ENV dari Railway (bukan localhost)
mongoose.connect(process.env.MONGODB_URI, {});

const UserSchema = new mongoose.Schema({
  username: String,
  password: String,
  balance: { type: Number, default: 0 }
});

const TicketSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  prize: String,
  isScratched: { type: Boolean, default: false }
});

const User = mongoose.model('User', UserSchema);
const Ticket = mongoose.model('Ticket', TicketSchema);

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  const hashed = await require('bcryptjs').hash(password, 10);
  const user = new User({ username, password: hashed });
  await user.save();
  res.json({ success: true });
});

// Login
const jwt = require('jsonwebtoken');
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ error: "User not found" });
  const valid = await require('bcryptjs').compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Wrong password" });
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
  res.json({ token });
});

// Middleware Auth
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "No token" });
  jwt.verify(token, process.env.JWT_SECRET, (err, data) => {
    if (err) return res.status(401).json({ error: "Invalid token" });
    req.userId = data.userId;
    next();
  });
};

// Buy ticket
app.post('/api/ticket', auth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (user.balance < 10) return res.status(400).json({ error: "Insufficient balance" });
  user.balance -= 10;
  await user.save();
  const prizes = ["WIN $50", "WIN $100", "TRY AGAIN"];
  const prize = prizes[Math.floor(Math.random() * prizes.length)];
  const ticket = new Ticket({ userId: user._id, prize });
  await ticket.save();
  res.json(ticket);
});

// Top up balance
app.post('/api/topup', auth, async (req, res) => {
  const user = await User.findById(req.userId);
  user.balance += 100;
  await user.save();
  res.json({ balance: user.balance });
});

// Get user tickets
app.get('/api/mytickets', auth, async (req, res) => {
  const tickets = await Ticket.find({ userId: req.userId });
  res.json(tickets);
});

// Scratch ticket
app.post('/api/scratch/:id', auth, async (req, res) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, userId: req.userId });
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  ticket.isScratched = true;
  await ticket.save();
  res.json(ticket);
});

// Listen port dari Railway
app.listen(process.env.PORT || 3000, () => console.log('Backend running'));
