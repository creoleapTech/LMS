import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mydatabase'

export async function connectToDatabase() {
    try {
        await mongoose.connect(MONGO_URI, {
            // Add these options to fix TLS issues
            tls: true,
            tlsAllowInvalidCertificates: true,
            tlsAllowInvalidHostnames: true,
            // Additional recommended options
            retryWrites: true,
            w: 'majority'
        });
        console.log('🎉 Connected to database successfully ')
    } catch (error) {
        console.error('Error connecting to database:', error)
        process.exit(1); // Exit process on connection failure
    }
}