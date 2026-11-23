import { FastifyRequest, FastifyReply } from "fastify";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
  orgId?: string;
  branchId?: string;
  isOrgAdmin?: boolean;
  jti?: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({
      statusCode: 401,
      error: "Unauthorized",
      message: "Invalid or expired access token",
    });
  }
}

export function authorize(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "You do not have permission to access this resource",
      });
    }

    const isAuthorized =
      roles.includes(request.user.role) ||
      (roles.includes("admin") && Boolean(request.user.isOrgAdmin));

    if (!isAuthorized) {
      return reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "You do not have permission to access this resource",
      });
    }
  };
}
