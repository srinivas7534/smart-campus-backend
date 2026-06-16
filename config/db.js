const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const connectDB = async () => {
    try {
        // Use Atlas if provided, otherwise use in-memory MongoDB
        if (process.env.MONGO_URI && process.env.MONGO_URI.includes('mongodb+srv')) {
            const conn = await mongoose.connect(process.env.MONGO_URI);
            console.log(`📡 MongoDB Connected: ${conn.connection.host}`);
            return;
        }

        mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        const conn = await mongoose.connect(uri);
        console.log(`📡 MongoDB Connected (In-Memory): ${conn.connection.host}`);
        console.log('⚠️  Data will be lost when the server stops. For persistent data, install MongoDB locally.');
    } catch (error) {
        console.error(`❌ Database Connection Error: ${error.message}`);
        process.exit(1);
    }
};

process.on('SIGINT', async () => {
    if (mongoServer) await mongoServer.stop();
    process.exit(0);
});

module.exports = connectDB;
