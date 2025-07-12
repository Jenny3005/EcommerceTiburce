// app/api/admin/order-status/route.js

import { NextResponse } from 'next/server';
import pool from '../../../../lib/db'; // Adaptez le chemin selon votre projet
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adaptez le chemin selon votre projet

export async function POST(request) {
    const session = await getServerSession(authOptions);

    // Vérification de l'authentification
    if (!session || !session.user) {
        console.warn("Accès non authentifié à l'API /api/admin/order-status.");
        return NextResponse.json({ message: 'Non authentifié.' }, { status: 401 });
    }

    // Vérification du rôle de l'utilisateur (doit être 'admin')
    if (session.user.role?.toLowerCase() !== 'admin') {
        console.warn(`Accès non autorisé à l'API /api/admin/order-status par l'utilisateur ${session.user.id} (Rôle: ${session.user.role || 'Aucun'})`);
        return NextResponse.json({ message: 'Accès interdit. Seuls les administrateurs peuvent modifier le statut des commandes.' }, { status: 403 });
    }

    let connection;
    try {
        const { orderId, status } = await request.json();

        // Validation des données reçues
        if (!orderId || !status) {
            return NextResponse.json({ success: false, message: 'ID de commande et statut sont requis.' }, { status: 400 });
        }

        connection = await pool.getConnection();

        // Mise à jour du statut de la commande dans la base de données
        const [result] = await connection.execute(
            `UPDATE \`orders\`
             SET status = ?
             WHERE id = ?`,
            [status, orderId]
        );

        // Vérifier si la mise à jour a affecté une ligne
        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: 'Commande non trouvée ou statut inchangé.' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Statut de la commande mis à jour avec succès.' }, { status: 200 });

    } catch (error) {
        console.error("Erreur CRITIQUE dans l'API /api/admin/order-status:", error);
        return NextResponse.json({ success: false, message: "Erreur serveur lors de la mise à jour du statut de la commande.", error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release(); // Libérer la connexion à la base de données
    }
}
