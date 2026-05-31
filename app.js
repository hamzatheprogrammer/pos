const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const connectDB = require('./DBconnect');
const routes = require('./router');

let appInstance;

async function createApp() {
    if (!process.env.SESSION_SECRET) {
        throw new Error('SESSION_SECRET environment variable is required');
    }

    await connectDB();

    const app = express();
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    app.set('trust proxy', 1);

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    app.use(session({
        name: 'flowpos.sid',
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        proxy: true,
        store: MongoStore.create({
            client: mongoose.connection.getClient(),
            dbName: mongoose.connection.name,
            collectionName: 'sessions',
            ttl: 60 * 60 * 24
        }),
        cookie: {
            secure: isProduction,
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24,
            path: '/'
        }
    }));

    app.use(routes);
    app.use(express.static(path.join(__dirname, 'public')));

    return app;
}

async function getApp() {
    if (!appInstance) {
        appInstance = await createApp();
    }

    return appInstance;
}

module.exports = { createApp, getApp };
