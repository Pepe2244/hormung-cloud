import type { APIRoute } from 'astro';
import { neon } from '@neondatabase/serverless';

const sql = neon(import.meta.env.DATABASE_URL);

export const GET: APIRoute = async ({ request }) => {
  const userId = request.headers.get('x-user-id');
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    const result = await sql`SELECT data FROM projects WHERE user_id = ${userId}`;
    const projects = result.map(row => row.data);
    return new Response(JSON.stringify({ projects }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Fetch Error' }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const userId = request.headers.get('x-user-id');
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try {
    const body = await request.json();
    const { project } = body;
    await sql`
      INSERT INTO projects (id, user_id, name, client, data, updated_at)
      VALUES (${project.id}, ${userId}, ${project.name}, ${project.client}, ${project}, NOW())
      ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        client = EXCLUDED.client,
        data = EXCLUDED.data,
        updated_at = NOW()
    `;
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Save Error' }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const userId = request.headers.get('x-user-id');
  if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const url = new URL(request.url);
  const projectId = url.searchParams.get('id');
  await sql`DELETE FROM projects WHERE id = ${projectId} AND user_id = ${userId}`;
  return new Response(JSON.stringify({ success: true }), { status: 200 });
};
