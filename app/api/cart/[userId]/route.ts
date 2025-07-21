// app/api/cart/[userId]/route.ts
// VERSION COMPLÈTE AVEC LA "SOLUTION MAGIQUE"

import { NextResponse, type NextRequest } from 'next/server';
import pool from '../../../../lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// La définition de type qui contourne le bug de Next.js
type Context = { params: Promise<{ userId: string }> };

// ==============================================================================
// GET: Récupérer le panier
// ==============================================================================
export async function GET(req: NextRequest, context: Context) {
    // La ligne magique pour résoudre la "fausse" promesse
    const resolvedParams = await context.params;
    const userIdFromParams = resolvedParams.userId;

    const session = await getServerSession(authOptions);

    // Si l'utilisateur n'est pas ADMIN, il ne peut voir que son propre panier
    if (!session || (session.user.role !== 'ADMIN' && session.user.id !== userIdFromParams)) {
        return NextResponse.json({ message: 'Non autorisé.' }, { status: 403 });
    }

    const userId = userIdFromParams;
    let connection;

    try {
        connection = await pool.getConnection();
        const [cartItems] = await connection.execute(
            `SELECT ci.id, ci.quantity, p.id as productId, p.name, p.price, p.mainImage 
             FROM cart_items ci 
             JOIN products p ON ci.productId = p.id 
             WHERE ci.userId = ?`,
            [userId]
        );
        return NextResponse.json(cartItems, { status: 200 });
    } catch (error: any) {
        console.error("Erreur GET panier:", error);
        return NextResponse.json({ message: "Erreur serveur lors de la récupération du panier.", error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// ==============================================================================
// POST: Ajouter au panier (logique d'upsert)
// ==============================================================================
export async function POST(req: NextRequest, context: Context) {
    const resolvedParams = await context.params;
    const userIdFromParams = resolvedParams.userId;

    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.id !== userIdFromParams)) {
        return NextResponse.json({ message: 'Non autorisé.' }, { status: 403 });
    }

    const userId = userIdFromParams;
    const { productId, quantity = 1 } = await req.json();

    if (!productId || quantity <= 0) {
        return NextResponse.json({ success: false, message: "L'ID du produit et une quantité positive sont requis." }, { status: 400 });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        const [existingItem]: any[] = await connection.execute(
            `SELECT id, quantity FROM cart_items WHERE userId = ? AND productId = ?`,
            [userId, productId]
        );

        if (existingItem.length > 0) {
            await connection.execute(
                `UPDATE cart_items SET quantity = quantity + ? WHERE id = ?`,
                [quantity, existingItem[0].id]
            );
        } else {
            const newCartItemId = uuidv4();
            await connection.execute(
                `INSERT INTO cart_items (id, userId, productId, quantity) VALUES (?, ?, ?, ?)`,
                [newCartItemId, userId, productId, quantity]
            );
        }

        return NextResponse.json({ success: true, message: "Article ajouté/mis à jour dans le panier." }, { status: 200 });

    } catch (error: any) {
        console.error("Erreur POST panier:", error);
        return NextResponse.json({ success: false, message: `Erreur serveur: ${error.message}` }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// ==============================================================================
// PUT: Mettre à jour la quantité (définir une quantité spécifique)
// ==============================================================================
export async function PUT(req: NextRequest, context: Context) {
    const resolvedParams = await context.params;
    const userIdFromParams = resolvedParams.userId;

    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.id !== userIdFromParams)) {
        return NextResponse.json({ message: 'Non autorisé.' }, { status: 403 });
    }

    const userId = userIdFromParams;
    const { productId, quantity } = await req.json();

    if (!productId || quantity === undefined || quantity < 0) {
        return NextResponse.json({ success: false, message: "L'ID du produit et une quantité valide sont requis." }, { status: 400 });
    }

    let connection;
    try {
        connection = await pool.getConnection();

        if (quantity === 0) {
            await connection.execute(
                `DELETE FROM cart_items WHERE userId = ? AND productId = ?`,
                [userId, productId]
            );
            return NextResponse.json({ success: true, message: "Article retiré du panier." }, { status: 200 });
        } else {
            const [result]: any = await connection.execute(
                `UPDATE cart_items SET quantity = ? WHERE userId = ? AND productId = ?`,
                [quantity, userId, productId]
            );

            if (result.affectedRows === 0) {
                return NextResponse.json({ success: false, message: "Article non trouvé dans le panier." }, { status: 404 });
            }
            return NextResponse.json({ success: true, message: "Quantité du panier mise à jour." }, { status: 200 });
        }
    } catch (error: any) {
        console.error("Erreur PUT panier:", error);
        return NextResponse.json({ success: false, message: `Erreur serveur: ${error.message}` }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// ==============================================================================
// DELETE: Supprimer un article spécifique du panier
// ==============================================================================
export async function DELETE(req: NextRequest, context: Context) {
    const resolvedParams = await context.params;
    const userIdFromParams = resolvedParams.userId;

    const session = await getServerSession(authOptions);

    if (!session || (session.user.role !== 'ADMIN' && session.user.id !== userIdFromParams)) {
        return NextResponse.json({ message: 'Non autorisé.' }, { status: 403 });
    }

    const userId = userIdFromParams;
    // L'ID du produit à supprimer est généralement passé dans le corps de la requête DELETE
    const { productId } = await req.json(); 

    if (!productId) {
        return NextResponse.json({ success: false, message: "L'ID du produit est requis pour la suppression." }, { status: 400 });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [result]: any = await connection.execute(
            `DELETE FROM cart_items WHERE userId = ? AND productId = ?`,
            [userId, productId]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: "Article non trouvé dans le panier ou utilisateur non autorisé." }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Article retiré du panier." }, { status: 200 });
    } catch (error: any) {
        console.error("Erreur DELETE panier:", error);
        return NextResponse.json({ success: false, message: `Erreur serveur: ${error.message}` }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}