// src/lib/axios.ts  (or wherever you define _axios)
import axios from "axios";
import { Config } from "./config";

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function normalizeIdAliases(value: JsonLike, visited: WeakSet<object> = new WeakSet()): JsonLike {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (visited.has(value as object)) {
    return value;
  }

  visited.add(value as object);

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = normalizeIdAliases(value[i], visited);
    }
    return value;
  }

  const obj = value as { [key: string]: JsonLike };

  // Keep both aliases so pages can work with either Mongo-style _id or SQL-style id.
  if (obj.id !== undefined && obj._id === undefined) {
    obj._id = obj.id;
  }
  if (obj._id !== undefined && obj.id === undefined) {
    obj.id = obj._id;
  }

  for (const key of Object.keys(obj)) {
    obj[key] = normalizeIdAliases(obj[key], visited);
  }

  return obj;
}

export const _axios = axios.create({
  baseURL: Config.baseUrl,
  withCredentials: true,
});

// REQUEST INTERCEPTOR — ADD TOKEN TO EVERY REQUEST
_axios.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// RESPONSE INTERCEPTOR — HANDLE 401, 500, etc.
_axios.interceptors.response.use(
  (response) => {
    response.data = normalizeIdAliases(response.data as JsonLike);
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.clear();
        window.location.href = "/";
      }
      return Promise.reject(new Error("Session expired. Please login again."));
    }

    if (error.response?.status >= 500) {
      return Promise.reject(new Error("Server error. Please try again later."));
    }

    const message = error.response?.data?.message || "An error occurred";
    return Promise.reject(new Error(message));
  }
);