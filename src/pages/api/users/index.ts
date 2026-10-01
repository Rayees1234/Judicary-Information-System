import type { APIRoute } from 'astro';
import { requireRole } from '../../../lib/auth';
import { getAllUsers, createUser, getJudges, getLawyers } from '../../../lib/services/userService';
import { userCreateSchema } from '../../../lib/schema';

export const GET: APIRoute = async ({ url }) => {
  try {
    const role = url.searchParams.get('role');
    if (role === 'JUDGE') {
      return new Response(JSON.stringify({ users: getJudges() }), { status: 200 });
    }
    if (role === 'LAWYER') {
      return new Response(JSON.stringify({ users: getLawyers() }), { status: 200 });
    }

    const users = getAllUsers();
    return new Response(JSON.stringify({ users }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const adminUser = requireRole(request, ['ADMIN']);
    const body = await request.json();
    const parsed = userCreateSchema.parse(body);

    const created = createUser(
      {
        username: parsed.username,
        email: parsed.email,
        fullName: parsed.fullName,
        role: parsed.role,
        password: parsed.password,
        phone: parsed.phone,
        courtName: parsed.courtName,
        designation: parsed.designation,
        courtroom: parsed.courtroom,
        barRegistrationNo: parsed.barRegistrationNo,
        idNumber: parsed.idNumber,
        address: parsed.address,
      },
      adminUser,
      clientAddress || '127.0.0.1'
    );

    return new Response(JSON.stringify({ user: created, success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return new Response(
        JSON.stringify({ error: error.errors[0]?.message || 'Validation error', details: error.errors }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
};
