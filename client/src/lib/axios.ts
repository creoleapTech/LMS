// src/lib/axios.ts  (or wherever you define _axios)
import axios from "axios";
import { Config } from "./config";

export const _axios = axios.create({
  baseURL: Config.baseUrl, // http://localhost:4000/api
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
  (response) => response,
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