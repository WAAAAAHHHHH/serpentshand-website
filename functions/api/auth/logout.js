/**
 * POST /api/auth/logout
 * Destroys the current session (if any) and clears the session cookie.
 * Always returns success, even if there was no session — logout is
 * idempotent from the client's point of view.
 */

import { parseCookies, destroySession, clearSessionCookie } from "../../_auth.js";

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "Database binding 'DB' not found." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cookies = parseCookies(context.request);
    const sessionId = cookies["session_id"];

    if (sessionId) {
      await destroySession(db, sessionId);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": clearSessionCookie(),
      },
    });
  } catch (error) {
    console.error("POST /api/auth/logout error:", error);
    return new Response(JSON.stringify({ error: "Failed to log out. Please try again later." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
