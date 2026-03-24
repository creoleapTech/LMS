import { Elysia } from "elysia";
import { app } from "./setup";
import { generateKeys } from "paseto-ts/v4";
import * as crypto from "node:crypto";

const getRandomValues = (array: Uint8Array) => {
  const bytes = crypto.randomBytes(array.length);
  array.set(bytes);
  return array;
};

const PORT = process.env.PORT || 3000

app.listen({ port: PORT }, ({ hostname, port }) => {

    console.log(`🚀 Server is running at → http://${hostname}:${port} `)
    console.log(`📘 Swagger docs available at → http://${hostname}:${port}/docs`)
})