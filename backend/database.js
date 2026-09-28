const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, 'packai.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) console.error('SQLite connection failed:', err.message);
  else console.log('SQLite connected:', DB_PATH);
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT,
    commodity TEXT NOT NULL,
    food_item TEXT,
    moisture REAL,
    fat REAL,
    ph REAL,
    respiration TEXT,
    shelf_life REAL,
    temperature REAL,
    humidity REAL,
    transport TEXT,
    storage TEXT,
    material TEXT,
    description TEXT,
    match_score REAL,
    otr TEXT,
    wvtr TEXT,
    thickness TEXT,
    sealability TEXT,
    strength TEXT,
    map_suitability TEXT,
    oxygen REAL,
    carbon_dioxide REAL,
    nitrogen REAL,
    sustainability REAL,
    cost_level TEXT,
    estimated_shelf TEXT,
    recyclability TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

module.exports = db;
