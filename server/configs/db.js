import mongoose from 'mongoose';

// Reuse the connection between serverless invocations
const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) return;
    try {
        mongoose.connection.on('connected', () => console.log('Database connected'))
        await mongoose.connect(`${process.env.MONGODB_URI}/quickgpt`)
    } catch (error) {
        console.log(error.message)
    }
}

export default connectDB;