// Database Configuration
const config = {
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  user: 'admin',
  password: process.env.DB_PASSWORD,
  pool: {
    min: 2,
    max: 10
  }
};

module.exports = config;
