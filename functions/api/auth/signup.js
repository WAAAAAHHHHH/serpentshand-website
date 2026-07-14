/**
 * POST /api/auth/signup
 * Creates a new user account and logs them in immediately
 * (creates a session + sets the HttpOnly cookie).
 */

import {
  validateEmail,
  validatePassword,
  hashPassword,
  createSession,
  buildSessionCookie,
} from "../../_auth.js";

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "Database binding 'DB' not found." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    let data;
    try {
      data = await context.request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const password = typeof data.password === "string" ? data.password : "";

    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: "Please provide a valid email address." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!validatePassword(password)) {
      return new Response(
        JSON.stringify({ error: "Password must be between 8 and 200 characters." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check for an existing account with this email (prepared statement).
    const existing = await db
      .prepare("SELECT id FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (existing) {
      // Deliberately vague to avoid confirming which emails are registered
      // beyond what's already implied by "email in use" — this is a
      // reasonable tradeoff for a small personal site; tighten further
      // (e.g. generic message + rate limiting) if this becomes public-facing.
      return new Response(JSON.stringify({ error: "An account with this email already exists." }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { hash, salt } = await hashPassword(password);

    const info = await db
      .prepare("INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)")
      .bind(email, hash, salt)
      .run();

    if (!info.success) {
      throw new Error("Database insert failed");
    }

    const userId = info.meta?.last_row_id;
    if (!userId) {
      throw new Error("Could not determine new user id");
    }

    const { sessionId, expiresAt } = await createSession(db, userId);
    const cookie = buildSessionCookie(sessionId, expiresAt);

    return new Response(
      JSON.stringify({ success: true, user: { id: userId, email } }),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookie,
        },
      }
    );
  } catch (error) {
    console.error("POST /api/auth/signup error:", error);
    return new Response(JSON.stringify({ error: "Failed to create account. Please try again later." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
