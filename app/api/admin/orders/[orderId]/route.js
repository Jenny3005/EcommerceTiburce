// app/api/admin/orders/[orderId]/route.js

import { NextResponse } from 'next/server';
import pool from '../../../../../lib/db'; // Adaptez le chemin selon votre projet
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adaptez le chemin selon votre projet

export async function DELETE(request, { params }) {
    const session = await getServerSession(authOptions);

    // Vérification de l'authentification
    if (!session || !session.user) {
        console.warn("Accès non authentifié à l'API DELETE /api/admin/orders/[orderId].");
        return NextResponse.json({ message: 'Non authentifié.' }, { status: 401 });
    }

    // Vérification du rôle de l'utilisateur (doit être 'admin')
    if (session.user.role?.toLowerCase() !== 'admin') {
        console.warn(`Accès non autorisé à l'API DELETE /api/admin/orders/[orderId] par l'utilisateur ${session.user.id} (Rôle: ${session.user.role || 'Aucun'})`);
        return NextResponse.json({ message: 'Accès interdit. Seuls les administrateurs peuvent supprimer des commandes.' }, { status: 403 });
    }

    const orderId = params.orderId; // Récupère l'ID de la commande depuis l'URL

    if (!orderId) {
        return NextResponse.json({ success: false, message: 'ID de commande manquant.' }, { status: 400 });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Démarre une transaction pour assurer l'intégrité des données
        await connection.beginTransaction();

        // Supprimer d'abord les éléments de commande associés
        const [deleteItemsResult] = await connection.execute(
            `DELETE FROM \`order_items\` WHERE orderId = ?`,
            [orderId]
        );

        // Supprimer ensuite les paiements associés (si la relation est CASCADE ON DELETE, ce n'est pas strictement nécessaire ici, mais bonne pratique)
        const [deletePaymentsResult] = await connection.execute(
            `DELETE FROM \`payments\` WHERE orderId = ?`,
            [orderId]
        );

        // Enfin, supprimer la commande elle-même
        const [deleteOrderResult] = await connection.execute(
            `DELETE FROM \`orders\` WHERE id = ?`,
            [orderId]
        );

        // Vérifier si la commande a été réellement supprimée
        if (deleteOrderResult.affectedRows === 0) {
            await connection.rollback(); // Annuler la transaction si la commande n'existe pas
            return NextResponse.json({ success: false, message: 'Commande non trouvée ou déjà supprimée.' }, { status: 404 });
        }

        await connection.commit(); // Valider la transaction si tout s'est bien passé

        return NextResponse.json({ success: true, message: 'Commande et ses éléments associés supprimés avec succès.' }, { status: 200 });

    } catch (error) {
        await connection.rollback(); // Annuler la transaction en cas d'erreur
        console.error("Erreur CRITIQUE dans l'API DELETE /api/admin/orders/[orderId]:", error);
        return NextResponse.json({ success: false, message: "Erreur serveur lors de la suppression de la commande.", error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release(); // Libérer la connexion à la base de données
    }
}
