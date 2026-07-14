/**
 * Cloudflare Pages Function to handle the global forum.
 * Requires a D1 Database binding named `DB`.
 */

export async function onRequestGet(context) {
  try {
    const db = context.env.DB;
    
    // Fetch all messages, ordered newest to oldest
    const { results } = await db.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
    
    // Map database rows to the frontend format
    const threads = results.map(row => {
      let replies = [];
      try {
        if (row.replies) {
          replies = JSON.parse(row.replies);
        }
      } catch (e) {
        console.error("Failed to parse replies for row", row.id, e);
      }
      
      return {
        id: row.id,
        name: row.name,
        subject: row.subject,
        body: row.entry,
        // Frontend expects time in milliseconds
        time: new Date(row.created_at).getTime(),
        replies: replies
      };
    });

    return new Response(JSON.stringify(threads), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("GET /api/messages error:", error);
    return new Response(JSON.stringify({ error: `Failed to fetch messages: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestPost(context) {
  try {
    // Cloudflare WAF or Rate Limiting Rules (configured in dashboard) 
    // should be used to prevent spam.
    const db = context.env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "Database binding 'DB' not found." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    let data;
    try {
      data = await context.request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const name = typeof data.name === 'string' ? data.name.trim() : 'Anonymous';
    const subject = typeof data.subject === 'string' ? data.subject.trim() : '';
    const entry = typeof data.body === 'string' ? data.body.trim() : '';

    if (!subject || !entry) {
      return new Response(JSON.stringify({ error: "Subject and entry are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const createdAt = new Date().toISOString();
    const emptyReplies = JSON.stringify([]);

    // Prevent SQL injection by using prepared statements.
    // Omit created_at so the database uses DEFAULT CURRENT_TIMESTAMP.
    const info = await db.prepare(
      "INSERT INTO messages (name, replies, subject, entry) VALUES (?, ?, ?, ?)"
    ).bind(
      name.substring(0, 40), 
      emptyReplies,
      subject.substring(0, 80), 
      entry.substring(0, 600)
    ).run();

    if (info.success) {
      // Return the created thread so the frontend can dynamically update the list
      // Note: Cloudflare D1 doesn't consistently return the inserted ID yet in `meta.last_row_id` for all queries,
      // but we can generate a temporary ID for the frontend if needed, or simply return success and let the frontend 
      // rely on its own generation or refetch. We'll return the object.
      return new Response(JSON.stringify({ 
        success: true, 
        thread: {
          id: info.meta?.last_row_id || `temp-${Date.now()}`,
          name: name.substring(0, 40),
          subject: subject.substring(0, 80),
          body: entry.substring(0, 600),
          time: new Date(createdAt).getTime(),
          replies: []
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      throw new Error("Database insert failed");
    }

  } catch (error) {
    console.error("POST /api/messages error:", error);
    return new Response(JSON.stringify({ error: `Failed to create message: ${error.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
