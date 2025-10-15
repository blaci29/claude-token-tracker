// API Routes
const express = require('express');
const router = express.Router();

router.get('/users', async (req, res) => {
  // Mock user data
  const users = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' }
  ];
  res.json(users);
});

router.post('/users', async (req, res) => {
  const { name, email } = req.body;
  res.status(201).json({ id: 3, name, email });
});

module.exports = router;
