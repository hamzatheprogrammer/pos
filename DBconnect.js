const dns = require('dns');
const mongoose = require('mongoose');

require('dotenv').config({ quiet: true });

const dnsServers = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

if (dnsServers.length) {
    dns.setServers(dnsServers);
}

dns.setDefaultResultOrder('ipv4first');

function parseSrvUri(srvUri) {
    const match = srvUri.match(/^mongodb\+srv:\/\/([^@/]+)@([^/]+)\/([^?]*)(\?.*)?$/);

    if (!match) {
        return null;
    }

    return {
        credentials: match[1],
        clusterHost: match[2],
        database: match[3],
        query: match[4] || ''
    };
}

function buildDirectUri(parsed, srvRecords) {
    const hosts = srvRecords.map((record) => `${record.name}:${record.port}`).join(',');
    const params = new URLSearchParams(parsed.query.replace(/^\?/, ''));

    if (!params.has('ssl')) {
        params.set('ssl', 'true');
    }

    if (!params.has('authSource')) {
        params.set('authSource', 'admin');
    }

    const query = params.toString();
    return `mongodb://${parsed.credentials}@${hosts}/${parsed.database}${query ? `?${query}` : ''}`;
}

function buildUriFromParts() {
    const user = process.env.MONGO_USER;
    const password = process.env.MONGO_PASSWORD;
    const cluster = process.env.MONGO_CLUSTER || 'pos.pgjj9ee.mongodb.net';
    const database = process.env.MONGO_DB || 'pos';

    if (!user || !password) {
        return null;
    }

    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);

    return `mongodb+srv://${encodedUser}:${encodedPassword}@${cluster}/${database}?retryWrites=true&w=majority`;
}

async function resolveMongoUri(uri) {
    if (!uri || !uri.startsWith('mongodb+srv://')) {
        return uri;
    }

    if (process.env.MONGO_URI_DIRECT) {
        return process.env.MONGO_URI_DIRECT;
    }

    const parsed = parseSrvUri(uri);

    if (!parsed) {
        throw new Error('MONGO_URI is not a valid mongodb+srv connection string');
    }

    const srvRecords = await dns.promises.resolveSrv(`_mongodb._tcp.${parsed.clusterHost}`);
    return buildDirectUri(parsed, srvRecords);
}

function getMongoUri() {
    if (process.env.MONGO_URI_DIRECT) {
        return process.env.MONGO_URI_DIRECT;
    }

    const fromParts = buildUriFromParts();

    if (fromParts) {
        return fromParts;
    }

    return process.env.MONGO_URI;
}

function printAuthHelp() {
    console.error('');
    console.error('Authentication failed. Fix in MongoDB Atlas:');
    console.error('  1. Database Access → your user → Edit → Reset Password');
    console.error('  2. Copy the new password into .env (MONGO_PASSWORD or MONGO_URI)');
    console.error('  3. Use the exact username shown in Atlas (not your Atlas login email)');
    console.error('  4. If the password has @ # : / etc., use MONGO_USER + MONGO_PASSWORD in .env instead of MONGO_URI');
    console.error('  5. Set MONGO_DB=pos (not "databaseName")');
}

const connectDB = async () => {
    const uri = getMongoUri();

    if (!uri || uri.includes('username:password') || uri.includes('/databaseName')) {
        console.error('MongoDB connection failed: Fix .env — use real Atlas user/password and MONGO_DB=pos');
        process.exit(1);
    }

    try {
        const connectionUri = await resolveMongoUri(uri);
        const options = {
            serverSelectionTimeoutMS: 15000
        };

        if (connectionUri !== uri && !process.env.MONGO_URI_DIRECT) {
            console.log('Using direct MongoDB hosts (SRV workaround applied).');
        }

        await mongoose.connect(connectionUri, options);
        console.log('MongoDB connected successfully');
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);

        if (/auth|authentication|bad auth/i.test(err.message)) {
            printAuthHelp();
        } else if (/ECONNREFUSED|querySrv|ENOTFOUND/i.test(err.message)) {
            console.error('');
            console.error('Network/DNS tips: check internet, Atlas cluster not paused, or set MONGO_URI_DIRECT.');
        }

        process.exit(1);
    }
};

module.exports = connectDB;
