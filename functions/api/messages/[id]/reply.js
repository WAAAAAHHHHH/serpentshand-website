/**
 * Cloudflare Pages Function to handle replies to a specific thread.
 * Requires a D1 Database binding named `DB`.
 */

export async function onRequestPost(context) {
  try {
    const db = context.env.DB;
    const threadId = context.params.id; // Extracted from the URL /api/threads/[id]/reply
    
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
    const body = typeof data.body === 'string' ? data.body.trim() : '';

    if (!body) {
      return new Response(JSON.stringify({ error: "Reply body is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // First, fetch the existing replies for this thread
    const existing = await db.prepare("SELECT replies FROM messages WHERE id = ?").bind(threadId).first();
    
    if (!existing) {
      return new Response(JSON.stringify({ error: "Thread not found." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    let replies = [];
    try {
      if (existing.replies) {
        replies = JSON.parse(existing.replies);
      }
    } catch (e) {
      console.error("Failed to parse existing replies, initializing as empty array.", e);
    }

    // Create the new reply object
    const newReply = {
      name: name.substring(0, 40),
      body: body.substring(0, 400),
      time: Date.now()
    };

    // Append the new reply
    replies.push(newReply);
    
    // Update the database with the new JSON string of replies
    const info = await db.prepare("UPDATE messages SET replies = ? WHERE id = ?").bind(JSON.stringify(replies), threadId).run();

    if (info.success) {
      return new Response(JSON.stringify({ success: true, reply: newReply }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      throw new Error("Database update failed");
    }
  } catch (error) {
    console.error("POST /api/threads/[id]/reply error:", error);
    return new Response(JSON.stringify({ error: "Failed to post reply. Please try again later." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
