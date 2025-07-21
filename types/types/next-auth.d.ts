// types/next-auth.d.ts

import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
    /**
     * L'objet Session retourné par `useSession`, `getSession` et reçu comme prop
     */
    interface Session {
        user: {
            id: string;
            role: string;
        } & DefaultSession["user"]; // Conserve les propriétés par défaut
    }

    /**
     * L'objet User passé aux callbacks
     */
    interface User extends DefaultUser {
        role: string;
    }
}

declare module "next-auth/jwt" {
    /**
     * Le token JWT décodé passé aux callbacks
     */
    interface JWT extends DefaultJWT {
        id: string;
        role: string;
    }
}