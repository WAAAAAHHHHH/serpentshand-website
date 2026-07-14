/**
 * POST /api/auth/login
 * Verifies email + password against D1, then creates a session
 * and sets the HttpOnly session cookie.
 */

import {
  validateEmail,
  verifyPassword,
  createSession,
  buildSessionCookie,
} from "../../_auth.js";

// Generic message used for both "no such user" and "wrong password"
// so the response never reveals which emails are registered.
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

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

    if (!validateEmail(email) || typeof password !== "string" || !password) {
      return new Response(JSON.stringify({ error: INVALID_CREDENTIALS_MESSAGE }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await db
      .prepare("SELECT id, email, password_hash, password_salt FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ error: INVALID_CREDENTIALS_MESSAGE }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const passwordOk = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!passwordOk) {
      return new Response(JSON.stringify({ error: INVALID_CREDENTIALS_MESSAGE }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { sessionId, expiresAt } = await createSession(db, user.id);
    const cookie = buildSessionCookie(sessionId, expiresAt);

    return new Response(
      JSON.stringify({ success: true, user: { id: user.id, email: user.email } }),
      {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookie,
        },
      }
    );
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return new Response(JSON.stringify({ error: "Failed to log in. Please try again later." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
