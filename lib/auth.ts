import { SignJWT, jwtVerify } from 'jose';
import { User } from '@/types';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'abudhabi-warehouse-secret-2024'
);

export type UserPayload = Omit<User, never>;

export async function signToken(payload: UserPayload): Promise<string> {
  return new SignJWT({ id: payload.id, username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return {
      id: payload.id as number,
      username: payload.username as string,
      role: payload.role as 'admin' | 'employee',
    };
  } catch {
    return null;
  }
}

export async function authFromRequest(req: Request): Promise<UserPayload | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}
