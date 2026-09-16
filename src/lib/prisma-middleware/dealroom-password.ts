import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Prisma middleware to enforce bcrypt hashing on all DealRoom password writes
 *
 * This is defense-in-depth: API routes should hash explicitly, but this middleware
 * ensures no plaintext password ever reaches the database, even if a route forgets.
 *
 * Detection: Bcrypt hashes always start with "$2a$", "$2b$", or "$2y$"
 */
export function dealRoomPasswordMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    const isDealRoomWrite =
      params.model === "DealRoom" &&
      ["create", "update", "updateMany", "upsert"].includes(params.action);

    if (!isDealRoomWrite) {
      return next(params);
    }

    /**
     * Hash password if it's a plain string (not already hashed)
     */
    const hashIfPlaintext = async (password: unknown): Promise<unknown> => {
      if (typeof password === "string" && password.length > 0) {
        // Bcrypt hashes start with $2a$, $2b$, or $2y$ (bcrypt version prefix)
        if (!password.startsWith("$2")) {
          return bcrypt.hash(password, 12);
        }
      }
      return password;
    };

    // Handle create and update
    if (["create", "update"].includes(params.action)) {
      if (params.args.data?.password) {
        params.args.data.password = await hashIfPlaintext(params.args.data.password);
      }
    }

    // Handle upsert (has both create and update data)
    if (params.action === "upsert") {
      if (params.args.create?.password) {
        params.args.create.password = await hashIfPlaintext(params.args.create.password);
      }
      if (params.args.update?.password) {
        params.args.update.password = await hashIfPlaintext(params.args.update.password);
      }
    }

    // Handle updateMany
    if (params.action === "updateMany" && params.args.data?.password) {
      params.args.data.password = await hashIfPlaintext(params.args.data.password);
    }

    return next(params);
  };
}
