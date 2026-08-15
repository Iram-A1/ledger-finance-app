import React, { useState } from "react";
import { supabase } from "./supabase";

export default function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password
        });

        if (error) throw error;

        setMessage(
          "Account created. Check your email and confirm your address before signing in."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;
      }
    } catch (err) {
      setMessage(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F4F6F3",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "Inter, sans-serif"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#FFFFFF",
          border: "1px solid #DCE3DD",
          borderRadius: 20,
          padding: 24
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#122019",
            marginBottom: 6
          }}
        >
          Ledger
        </div>

        <div
          style={{
            fontSize: 14,
            color: "#4B5A52",
            marginBottom: 22
          }}
        >
          {mode === "signin"
            ? "Sign in to access your private finance dashboard."
            : "Create your private Ledger account."}
        </div>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#4B5A52",
              marginBottom: 6
            }}
          >
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: 10,
              border: "1px solid #DCE3DD",
              fontSize: 15,
              marginBottom: 14,
              boxSizing: "border-box"
            }}
          />

          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#4B5A52",
              marginBottom: 6
            }}
          >
            Password
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            placeholder="At least 6 characters"
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: 10,
              border: "1px solid #DCE3DD",
              fontSize: 15,
              marginBottom: 16,
              boxSizing: "border-box"
            }}
          />

          {message && (
            <div
              style={{
                background: "#F7E7E3",
                color: "#AD4A3C",
                borderRadius: 10,
                padding: 10,
                fontSize: 13,
                marginBottom: 14,
                lineHeight: 1.4
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "11px 16px",
              border: "none",
              borderRadius: 12,
              background: "#1B7A6B",
              color: "#FFFFFF",
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 13,
            color: "#4B5A52"
          }}
        >
          {mode === "signin"
            ? "Don't have an account?"
            : "Already have an account?"}
        </div>

        <button
          type="button"
          onClick={() =>
            setMode((current) =>
              current === "signin" ? "signup" : "signin"
            )
          }
          style={{
            width: "100%",
            marginTop: 8,
            padding: "9px 14px",
            borderRadius: 10,
            border: "1px solid #DCE3DD",
            background: "#FFFFFF",
            color: "#122019",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          {mode === "signin" ? "Create account" : "Back to sign in"}
        </button>

        <div
          style={{
            marginTop: 20,
            fontSize: 11.5,
            color: "#7B877F",
            lineHeight: 1.5
          }}
        >
          Do not store banking passwords, PINs, full card numbers or security
          codes in Ledger.
        </div>
      </div>
    </div>
  );
}
