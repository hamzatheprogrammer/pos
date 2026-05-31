require('dotenv').config({ quiet: true });

const express = require('express');
const routes = require('./router');
const connectDB = require('./DBconnect');
const session = require('express-session');

const port = process.env.PORT || 3000;

async function start() {
    await connectDB();

    const app = express();

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: false,
            maxAge: 1000 * 60 * 60
        }
    }));

    app.use(routes);
    app.use(express.static('public'));

    app.listen(port, () => {
        console.log(`Server is running on port  http://localhost:${port}`);
    });
}

start().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
});
