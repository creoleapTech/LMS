import { Elysia } from 'elysia'
import { logger } from '@rasla/logify'
import swagger from '@elysiajs/swagger'
// import { connectToDatabase } from './lib/db.config'
import { baseRouter } from './modules/router'
import { cors } from '@elysiajs/cors'
import mongoose, { connect } from 'mongoose'



const app = new Elysia()

// await connectToDatabase()
app.use(cors());

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ ERROR: MONGO_URI is not defined in environment variables.");
} else {
  // Add connection event listeners BEFORE calling connect
  mongoose.connection.on("connected", () => console.log("✅ Mongoose connected to MongoDB"));
  mongoose.connection.on("error", (err) => console.error("❌ Mongoose connection error:", err));
  mongoose.connection.on("disconnected", () => console.log("⚠️ Mongoose disconnected"));

  try {
    await connect(MONGO_URI, {
      dbName: "LMS",
      serverSelectionTimeoutMS: 5000, // Fail fast if no server is available
      socketTimeoutMS: 45000, // standard timeout
    });
  } catch (e) {
    console.error("❌ Fatal error during initial MongoDB connection:", e);
  }
}


// app.use(cors());

app.get("/health", () => {
    return "OK"
})

// app.use(swagger())

if (process.env.SWAGGER === "YES") {
    console.log("i am in swagger")
    app.use(
        swagger({
            path: "/docs",
            exclude: ["/docs", "/docs/json"],
            theme: "dark",
            documentation: {
                servers: [
                    {
                        url: "http://localhost:4000/",
                    }
                ],
                info: {
                    title: "LMS API docs",
                    version: "1.0.0",
                },
                components: {
                    securitySchemes: {
                        bearerAuth: {
                            scheme: "bearer",
                            type: "http",
                            bearerFormat: "JWT",
                        },
                    },
                },
            },
        })
    );
}


app.use(logger({ console: true, skip: ["/docs", "/docs/json"] }))

app.use(baseRouter)

// Example usage of TokenGenerator
// const localKey = TokenGenerator.generateKey()
// console.log(`Local Key: ${localKey}`)

export { app }
