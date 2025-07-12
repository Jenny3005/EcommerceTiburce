// app/api/user/orders/route.js
import { NextResponse } from 'next/server';
import pool from '../../../../lib/db'; // Assurez-vous que le chemin est correct pour votre connexion DB
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Assurez-vous que le chemin est correct

export async function GET(request) {
    const session = await getServerSession(authOptions);

    // 1. Vérification de l'authentification et de la disponibilité de l'ID utilisateur
    if (!session || !session.user || !session.user.id) {
        console.warn("Accès non authentifié ou ID utilisateur manquant à l'API /api/user/orders.");
        return NextResponse.json({ message: 'Non authentifié ou ID utilisateur non disponible.' }, { status: 401 });
    }

    const userId = session.user.id; // Récupère l'ID de l'utilisateur connecté depuis la session

    let connection;
    try {
        connection = await pool.getConnection();

        // 2. Requête SQL pour récupérer les commandes de l'utilisateur connecté
        // Ajout de LIMIT 10 pour n'afficher que les 10 dernières commandes (ordonnées par date DESC)
        const [orders] = await connection.execute(
            `SELECT
                o.id,
                o.totalAmount,
                o.status AS orderStatus,
                COALESCE(p.status, o.paymentStatus) AS paymentStatus,
                o.shippingAddressLine1,
                o.shippingAddressLine2,
                o.shippingCity,
                o.shippingState,
                o.shippingZipCode,
                o.shippingCountry,
                a.phoneNumber AS shippingPhoneNumber,
                o.orderDate,
                p.paymentMethod,
                p.status AS paymentStatusDetail,
                p.transactionId AS paymentTransactionId,
                p.paymentDate
             FROM \`orders\` o
             LEFT JOIN \`addresses\` a ON o.shippingAddressId = a.id
             LEFT JOIN \`payments\` p ON o.id = p.orderId
             WHERE o.userId = ?
             ORDER BY o.orderDate DESC
             LIMIT 10`, // <-- AJOUTÉE : Limite le résultat aux 10 dernières commandes
            [userId]
        );

        // 3. Pour chaque commande, récupérer les articles associés avec les détails du produit
        const ordersWithItems = await Promise.all(orders.map(async (order) => {
            const [items] = await connection.execute(
                `SELECT
                    oi.productId,
                    oi.quantity,
                    oi.priceAtOrder,
                    p.name,
                    p.imgUrl
                 FROM \`order_items\` oi
                 JOIN \`products\` p ON oi.productId = p.id
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
                        if (typeof item.imgUrl === 'string' && (item.imgUrl.startsWith('/') || item.imgUrl.startsWith('http'))) {
                            itemImgUrl = [item.imgUrl];
                        } else {
                            itemImgUrl = [];
                        }
                    }
                }
                return { ...item, imgUrl: itemImgUrl.length > 0 ? itemImgUrl[0] : '/placeholder-product.png' };
            });

            return { ...order, items: parsedItems };
        }));

        return NextResponse.json(ordersWithItems, { status: 200 });

    } catch (error) {
        console.error("Erreur CRITIQUE dans l'API /api/user/orders:", error);
        return NextResponse.json({ message: "Erreur serveur lors de la récupération des commandes.", error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}