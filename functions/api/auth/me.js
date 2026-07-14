/**
 * GET /api/auth/me
 * Returns the currently logged-in user (based on the session cookie),
 * or { user: null } if there is no valid session. Never errors out
 * for "not logged in" — that's a normal, expected state.
 */

import { getUserFromSession } from "../../_auth.js";

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "Database binding 'DB' not found." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await getUserFromSession(context.request, db);

    return new Response(JSON.stringify({ user: user || null }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return new Response(JSON.stringify({ error: "Failed to check session." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
