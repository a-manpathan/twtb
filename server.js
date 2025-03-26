const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');
require('dotenv').config();
const app = express();

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3001',
        'https://minitwt.vercel.app',
        'https://twtb.onrender.com'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());

// PostgreSQL Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Test database connection
pool.connect((err) => {
    if (err) {
        console.error('Error connecting to PostgreSQL:', err);
        return;
    }
    console.log('Connected to PostgreSQL database');
});

// Routes
// User Registration
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const query = 'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id';
        const result = await pool.query(query, [username, email, hashedPassword]);
        
        res.status(201).json({ message: 'User created successfully', userId: result.rows[0].id });
    } catch (error) {
        if (error.code === '23505') { // Unique violation in PostgreSQL
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        res.status(500).json({ error: 'Error creating user' });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await pool.query(query, [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        const user = result.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);
        
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        delete user.password;
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error during login' });
    }
});

// Create Tweet
app.post('/api/tweets', async (req, res) => {
    const { userId, content } = req.body;
    
    try {
        const query = 'INSERT INTO tweets (user_id, content) VALUES ($1, $2) RETURNING id';
        const result = await pool.query(query, [userId, content]);
        res.status(201).json({ message: 'Tweet created successfully', tweetId: result.rows[0].id });
    } catch (error) {
        res.status(500).json({ error: 'Error creating tweet' });
    }
});

// Get Tweets
app.get('/api/tweets', async (req, res) => {
    try {
        const query = `
            SELECT tweets.*, users.username 
            FROM tweets 
            JOIN users ON tweets.user_id = users.id 
            ORDER BY tweets.created_at DESC
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching tweets' });
    }
});

// Like Tweet
app.post('/api/tweets/:tweetId/like', async (req, res) => {
    const { tweetId } = req.params;
    const { userId } = req.body;
    
    try {
        const query = 'INSERT INTO likes (user_id, tweet_id) VALUES ($1, $2)';
        await pool.query(query, [userId, tweetId]);
        res.json({ message: 'Tweet liked successfully' });
    } catch (error) {
        if (error.code === '23505') { // Unique violation in PostgreSQL
            return res.status(400).json({ error: 'Tweet already liked' });
        }
        res.status(500).json({ error: 'Error liking tweet' });
    }
});

// Search Tweets
app.get('/api/tweets/search', async (req, res) => {
    const { query } = req.query;
    
    try {
        const searchQuery = `
            SELECT tweets.*, users.username 
            FROM tweets 
            JOIN users ON tweets.user_id = users.id 
            WHERE tweets.content ILIKE $1 OR users.username ILIKE $1
            ORDER BY tweets.created_at DESC
        `;
        
        const searchParam = `%${query}%`;
        const result = await pool.query(searchQuery, [searchParam]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error searching tweets' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 
