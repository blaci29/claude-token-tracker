// Simple Express Server
const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from server!' });
});

app.post('/api/data', (req, res) => {
  const { name, value } = req.body;
  res.json({ 
    success: true, 
    data: { name, value, timestamp: Date.now() }
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
