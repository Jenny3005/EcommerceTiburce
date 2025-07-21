// lib/auth.ts

import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import pool from "./db"; // Assurez-vous que le chemin vers votre DB est correct
import { v4 as uuidv4 } from 'uuid';

// Définir le type pour les utilisateurs de la base de données
interface DbUser {
    id: string;
    email: string;
    password?: string;
    firstName: string;
    lastName: string;
    role: string;
}

// C'est ici que nous définissons ET EXPORTONS la configuration
export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            // ... toute votre configuration de CredentialsProvider ...
            // (J'ai abrégé pour la clarté, mais collez tout votre bloc ici)
            name: "Credentials",
            credentials: { /* ... */ },
            async authorize(credentials) {
                if (!credentials) return null;
                // ... votre logique authorize ...
                let connection;
                try {
                    connection = await pool.getConnection();
                    const [users] = await connection.execute(
                        `SELECT id, email, password, firstName, lastName, role FROM users WHERE email = ?`,
                        [credentials.email]
                    );
                    const user = (users as DbUser[])[0];
                    if (!user) return null;
                    const isPasswordValid = await bcrypt.compare(credentials.password, user.password!);
                    if (!isPasswordValid) return null;
                    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
                    return { id: user.id, email: user.email, name: fullName, role: user.role };
                } catch (error) {
                    return null;
                } finally {
                    if (connection) connection.release();
                }
            },
        }),
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    // ... collez également vos blocs session, callbacks, pages, debug, secret ici ...
    session: { strategy: "jwt" },
    callbacks: {
        async signIn({ user, account, profile }) { /* ... votre logique signIn ... */ return true },
        async jwt({ token, user }) { if (user) { token.id = user.id; token.role = user.role; } return token; },
        async session({ session, token }) { if (session.user) { session.user.id = token.id as string; session.user.role = token.role as string; } return session; },
    },
    pages: { signIn: "/login" },
    debug: process.env.NODE_ENV === "development",
    secret: process.env.NEXTAUTH_SECRET,
};