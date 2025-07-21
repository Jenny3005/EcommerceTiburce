// app/api/addresses/[userId]/route.ts

import { NextResponse, type NextRequest } from 'next/server';
import pool from '../../../../lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

type Context = { params: Promise<{ userId: string }> };

// ==========================
// GET: Récupérer les adresses
// ==========================
export async function GET(req: NextRequest, context: Context) {
    const resolvedParams = await context.params;
    const userIdFromParams = resolvedParams.userId;

    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ message: 'Non authentifié.' }, { status: 401 });
    }
    if (String(session.user.id) !== String(userIdFromParams)) {
        return NextResponse.json({ message: 'Non autorisé.' }, { status: 403 });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [addresses] = await connection.execute(
            `SELECT id, fullName, phoneNumber, pincode, area, city, state, isDefault FROM addresses WHERE userId = ? ORDER BY isDefault DESC, createdAt DESC`,
            [session.user.id]
        );
        return NextResponse.json(addresses);
    } catch (error: any) {
        console.error('Erreur GET adresses:', error);
        return NextResponse.json({ message: 'Erreur serveur.', error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// ==========================
// POST: Ajouter une adresse
// ==========================
export async function POST(req: NextRequest, context: Context) {
    const resolvedParams = await context.params;
    const userIdFromParams = resolvedParams.userId;

    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ message: 'Non authentifié.' }, { status: 401 });
    }
    if (String(session.user.id) !== String(userIdFromParams)) {
        return NextResponse.json({ message: 'Non autorisé.' }, { status: 403 });
    }

    const userId = session.user.id;
    const { fullName, phoneNumber, pincode, area, city, state, isDefault = false } = await req.json();

    if (!fullName || !phoneNumber || !pincode || !area || !city || !state || isDefault === undefined) {
        return NextResponse.json({ success: false, message: "Tous les champs sont requis." }, { status: 400 });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const newAddressId = uuidv4();
        await connection.beginTransaction();

        if (isDefault) {
            await connection.execute(`UPDATE addresses SET isDefault = 0 WHERE userId = ?`, [userId]);
        }

        await connection.execute(
            `INSERT INTO addresses (id, userId, fullName, phoneNumber, pincode, area, city, state, isDefault, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [newAddressId, userId, fullName, phoneNumber, pincode, area, city, state, isDefault]
        );

        await connection.commit();
        return NextResponse.json({ success: true, message: "Adresse ajoutée avec succès.", id: newAddressId }, { status: 201 });
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Erreur POST adresse:", error);
        return NextResponse.json({ success: false, message: "Erreur serveur.", error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// ==========================
// PUT: Mettre à jour une adresse
// ==========================
export async function PUT(req: NextRequest, context: Context) {
    const resolvedParams = await context.params;
    const userIdFromParams = resolvedParams.userId;

    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ message: 'Non authentifié.' }, { status: 401 });
    }
    if (String(session.user.id) !== String(userIdFromParams)) {
        return NextResponse.json({ message: 'Non autorisé.' }, { status: 403 });
    }

    const userId = session.user.id;
    const { id, fullName, phoneNumber, pincode, area, city, state, isDefault } = await req.json();

    if (!id || fullName === undefined || phoneNumber === undefined || area === undefined || city === undefined || state === undefined || isDefault === undefined) {
        return NextResponse.json({ success: false, message: "Tous les champs sont requis pour la mise à jour." }, { status: 400 });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        if (isDefault) {
            await connection.execute(`UPDATE addresses SET isDefault = 0 WHERE userId = ? AND id != ?`, [userId, id]);
        }

        const [result]: any = await connection.execute(
            `UPDATE addresses SET fullName = ?, phoneNumber = ?, pincode = ?, area = ?, city = ?, state = ?, isDefault = ?, updatedAt = NOW() WHERE id = ? AND userId = ?`,
            [fullName, phoneNumber, pincode, area, city, state, isDefault, id, userId]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "Adresse non trouvée ou non autorisée." }, { status: 404 });
        }

        await connection.commit();
        return NextResponse.json({ success: true, message: "Adresse mise à jour avec succès." }, { status: 200 });
    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error("Erreur PUT adresse:", error);
        return NextResponse.json({ success: false, message: "Erreur serveur.", error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// ==========================
// DELETE: Supprimer une adresse
// ==========================
export async function DELETE(req: NextRequest, context: Context) {
    const resolvedParams = await context.params;
    const userIdFromParams = resolvedParams.userId;

    const session = await getServerSession(authOptions);

    if (!session) {
        return NextResponse.json({ message: 'Non authentifié.' }, { status: 401 });
    }
    if (String(session.user.id) !== String(userIdFromParams)) {
        return NextResponse.json({ message: 'Non autorisé.' }, { status: 403 });
    }

    const userId = session.user.id;
    const { id } = await req.json();

    if (!id) {
        return NextResponse.json({ success: false, message: "L'ID de l'adresse est requis." }, { status: 400 });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [result]: any = await connection.execute(
            `DELETE FROM addresses WHERE id = ? AND userId = ?`,
            [id, userId]
        );

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: "Adresse non trouvée ou non autorisée." }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Adresse supprimée avec succès." }, { status: 200 });
    } catch (error: any) {
        console.error("Erreur DELETE adresse:", error);
        return NextResponse.json({ success: false, message: "Erreur serveur.", error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
