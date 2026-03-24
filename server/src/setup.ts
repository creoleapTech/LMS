import { Elysia } from 'elysia'
import { logger } from '@rasla/logify'
import swagger from '@elysiajs/swagger'
// import { connectToDatabase } from './lib/db.config'
import { baseRouter } from './modules/router'
import { cors } from '@elysiajs/cors'
import { connect } from 'mongoose'



const app = new Elysia()

// await connectToDatabase()
app.use(cors());

try {
  await connect(process.env.MONGO_URI as string, {
    dbName: "LMS",
  });
  console.log("Connected to MongoDB");
} catch (e) {
  console.log(e);
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
