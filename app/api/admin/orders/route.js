// app/api/admin/orders/route.js

import { NextResponse } from 'next/server';
import pool from '../../../../lib/db'; // adapte le chemin selon ton projet
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        console.warn("Accès non authentifié à l'API /api/admin/orders.");
        return NextResponse.json({ message: 'Non authentifié.' }, { status: 401 });
    }

    // Vérification du rôle de l'utilisateur
    // Assurez-vous que session.user.role est bien défini et contient le rôle de l'utilisateur
    if (session.user.role?.toLowerCase() !== 'admin') {
        console.warn(`Accès non autorisé à l'API /api/admin/orders par l'utilisateur ${session.user.id} (Rôle: ${session.user.role || 'Aucun'})`);
        return NextResponse.json({ message: 'Accès interdit. Seuls les administrateurs peuvent voir cette page.' }, { status: 403 });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        // Requête principale pour récupérer les commandes, les informations utilisateur et les paiements
        const [orders] = await connection.execute(
            `SELECT
                o.id,
                o.totalAmount,
                o.status AS orderStatus,
                -- Utilisation de COALESCE pour le statut de paiement, priorisant 'payments'
                COALESCE(p.status, o.paymentStatus) AS paymentStatus, 
                o.shippingAddressLine1,
                o.shippingAddressLine2,
                o.shippingCity,
                o.shippingState,
                o.shippingZipCode,
                o.shippingCountry,
                o.orderDate,
                CONCAT(u.firstName, ' ', u.lastName) AS userName,
                u.email AS userEmail,
                u.phoneNumber AS userPhoneNumber,
                p.paymentMethod,
                p.status AS paymentStatusDetail, -- Garde cet alias si le frontend l'utilise spécifiquement
                p.transactionId AS paymentTransactionId,
                p.paymentDate
             FROM \`orders\` o
             JOIN \`users\` u ON o.userId = u.id -- Jointure avec la table users pour les infos client
             LEFT JOIN \`payments\` p ON o.id = p.orderId
             ORDER BY o.orderDate DESC`
        );

        // Pour chaque commande, récupérer les articles associés avec les détails du produit
        const ordersWithItems = await Promise.all(orders.map(async (order) => {
            const [items] = await connection.execute(
                `SELECT 
                    oi.productId, 
                    oi.quantity, 
                    oi.priceAtOrder, 
                    p.name,      -- Nom du produit de la table products
                    p.imgUrl     -- URL de l'image du produit de la table products
                 FROM \`order_items\` oi
                 JOIN \`products\` p ON oi.productId = p.id  -- Jointure avec la table products
                 WHERE oi.orderId = ?`,
                [order.id]
            );

            const parsedItems = items.map(item => {
                let itemImgUrl = [];
                if (item.imgUrl) {
                    try {
                        const parsed = JSON.parse(item.imgUrl);
                        if (Array.isArray(parsed)) {
                            itemImgUrl = parsed;
                        } else if (typeof parsed === 'string') {
                            itemImgUrl = [parsed];
                        }
                    } catch {
                        // Gérer les cas où imgUrl n'est pas un JSON valide mais une simple chaîne
                        if (typeof item.imgUrl === 'string' && (item.imgUrl.startsWith('/') || item.imgUrl.startsWith('http'))) {
                            itemImgUrl = [item.imgUrl];
                        } else {
                            itemImgUrl = []; // Si le format est inconnu ou invalide
                        }
                    }
                }
                // Retourner l'élément avec la première image ou une image de remplacement
                return { ...item, imgUrl: itemImgUrl.length > 0 ? itemImgUrl[0] : '/placeholder-product.png' };
            });

            return { ...order, items: parsedItems };
        }));

        return NextResponse.json(ordersWithItems, { status: 200 });

    } catch (error) {
        console.error("Erreur CRITIQUE dans l'API /api/admin/orders:", error);
        return NextResponse.json({ message: "Erreur serveur lors de la récupération des commandes.", error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}