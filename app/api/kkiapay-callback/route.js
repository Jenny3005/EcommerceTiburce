// api/kkiapay-callback/route.js
import { NextResponse } from 'next/server';
import pool from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { verifyKkiapayTransaction } from '../../../lib/kkiapay'; 

// Clés API Kkiapay depuis les variables d'environnement
// Note: Kkiapay SDK utilise déjà ces clés via process.env, donc cette ligne n'est pas strictement nécessaire ici
// mais laissons-la pour la clarté si d'autres parties du code en avaient besoin directement.
const KKIA_PRIVATE_API_KEY = process.env.KAKAPAY_PRIVATE_API_KEY; 

/**
 * @route GET /api/kkiapay-callback
 * @description Gère la redirection de Kkiapay après un paiement.
 * Vérifie le statut de la transaction auprès de Kkiapay et met à jour/insère
 * la commande et le paiement dans la base de données.
 * @access Public (appelé par Kkiapay)
 */
export async function GET(request) {
    console.log("==> Kkiapay Callback GET reçu");

    const { searchParams } = new URL(request.url);
    // Votre ID de commande (généré par votre système, passé au widget)
    const yourGeneratedOrderId = searchParams.get('transactionId'); 
    // L'ID de transaction réel de Kkiapay (passé par Kkiapay dans le callback)
    // Kkiapay peut le nommer 'transaction_id' ou 'id'
    const kkiapayActualTransactionId = searchParams.get('transaction_id') || searchParams.get('id'); 
    
    const statusFromKkiapayCallback = searchParams.get('status'); // Statut initial du callback
    const reference = searchParams.get('reference'); // Référence Kkiapay (peut être votre orderId)

    console.log("Params callback:", { yourGeneratedOrderId, kkiapayActualTransactionId, statusFromKkiapayCallback, reference });

    // L'ID à utiliser pour la VÉRIFICATION avec le SDK Kkiapay est l'ID réel de Kkiapay
    const transactionIdToVerify = kkiapayActualTransactionId; // Prioriser l'ID de Kkiapay
    // L'ID de la commande dans votre base de données reste votre ID généré
    const orderIdForDatabase = yourGeneratedOrderId;

    // Vérifier la présence de l'ID de transaction pour la vérification
    if (!transactionIdToVerify) {
        console.error("Callback Kkiapay: ID de transaction Kkiapay réel manquant pour la vérification.");
        return NextResponse.redirect(`${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('ID de transaction Kkiapay manquant pour la vérification.')}`);
    }
    
    // Vérifier que votre ID de commande est aussi présent (pour la base de données)
    if (!orderIdForDatabase) {
        console.error("Callback Kkiapay: Votre ID de commande (transactionId) est manquant dans l'URL.");
        return NextResponse.redirect(`${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('Votre ID de commande est manquant dans le callback.')}`);
    }

    let connection; // Déclarer la connexion en dehors du try pour le bloc finally
    let kkiapayErrorMessage = ''; // Initialiser le message d'erreur pour la redirection

    try {
        connection = await pool.getConnection(); // Obtenir une connexion à la base de données
        await connection.beginTransaction(); // Démarrer une transaction de base de données

        let verification;
        try {
            // Utiliser l'ID de transaction réel de Kkiapay pour la vérification via le SDK
            verification = await verifyKkiapayTransaction(transactionIdToVerify);
            console.log("Réponse vérifiée du SDK Kkiapay:", verification);
        } catch (verifyError) {
            // L'erreur est maintenant plus descriptive grâce au SDK
            console.error("Erreur vérification Kkiapay (via SDK):", verifyError.message);
            await connection.rollback();
            return NextResponse.redirect(`${request.nextUrl.origin}/order-status?orderId=${orderIdForDatabase}&status=failed&message=${encodeURIComponent('Erreur lors de la vérification Kkiapay: ' + (verifyError.message || 'Erreur inconnue.'))}`);
        }

        const isSuccess = verification.status === 'SUCCESS';
        const kkiapayTransactionAmount = verification.amount || 0;
        const kkiapayPaymentMethod = verification.paymentMethod || 'Mobile Money';
        const kkiapayActualTransactionIdFromSDK = verification.transactionId || transactionIdToVerify; // Utiliser l'ID du SDK si différent

        let orderPayload;
        try {
            orderPayload = verification.data ? JSON.parse(verification.data) : null;
        } catch (parseErr) {
            console.warn("Erreur parsing data (payload Kkiapay):", parseErr.message);
            orderPayload = {}; // Assurer que orderPayload n'est pas null pour les accès suivants
        }

        const userId = orderPayload?.userId;
        const items = orderPayload?.items || [];
        const shippingAddress = orderPayload?.shippingAddress || {};
        const totalAmount = orderPayload?.totalAmount || 0;
        const currency = orderPayload?.currency || 'XOF';
        
        // L'ID de la commande dans votre DB est votre ID généré
        const orderId = orderIdForDatabase; 

        // Vérifier si la commande existe déjà pour éviter les doublons (idempotence)
        const [existingOrderRows] = await connection.execute(
            `SELECT id FROM orders WHERE id = ?`,
            [orderId]
        );

        if (isSuccess) {
            if (existingOrderRows.length === 0) {
                // ✅ Créer nouvelle commande
                await connection.execute(
                    `INSERT INTO orders (id, userId, totalAmount, kakapayTransactionId, status, paymentStatus,
                        shippingAddressLine1, shippingAddressLine2, shippingCity, shippingState, shippingZipCode, shippingCountry, orderDate, shippingAddressId)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
                    [
                        orderId, // Votre ID de commande
                        userId,
                        totalAmount,
                        kkiapayActualTransactionIdFromSDK, // L'ID de transaction réel de Kkiapay (du SDK)
                        'PAID_SUCCESS',
                        'COMPLETED',
                        shippingAddress.fullName || '',
                        shippingAddress.area || '',
                        shippingAddress.city || '',
                        shippingAddress.state || '',
                        shippingAddress.pincode || '',
                        shippingAddress.country || 'Bénin',
                        shippingAddress.id || null
                    ]
                );

                for (const item of items) {
                    await connection.execute(
                        `INSERT INTO order_items (id, orderId, productId, quantity, priceAtOrder, createdAt)
                         VALUES (?, ?, ?, ?, ?, NOW())`,
                        [uuidv4(), orderId, item.productId, item.quantity, item.price]
                    );
                }

                await connection.execute(
                    `INSERT INTO payments (id, orderId, paymentMethod, transactionId, amount, currency, status, paymentDate, createdAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [uuidv4(), orderId, kkiapayPaymentMethod, kkiapayActualTransactionIdFromSDK, kkiapayTransactionAmount, currency, 'COMPLETED']
                );

                await connection.execute(`DELETE FROM cart_items WHERE userId = ?`, [userId]);

                console.log(`Commande ${orderId} créée et panier vidé.`);
            } else {
                // 🛠 Mettre à jour commande existante
                await connection.execute(
                    `UPDATE orders SET status = 'PAID_SUCCESS', paymentStatus = 'COMPLETED', kakapayTransactionId = ? WHERE id = ?`,
                    [kkiapayActualTransactionIdFromSDK, orderId]
                );

                await connection.execute(
                    `UPDATE payments SET status = 'COMPLETED', amount = ?, paymentDate = NOW() WHERE transactionId = ?`,
                    [kkiapayTransactionAmount, kkiapayActualTransactionIdFromSDK]
                );

                console.log(`Commande ${orderId} mise à jour.`);
            }

            await connection.commit();
            return NextResponse.redirect(`${request.nextUrl.origin}/order-status?orderId=${orderId}&status=success`);
        } else {
            // ❌ Paiement échoué
            const failMessage = verification.message || 'Échec du paiement Kkiapay';

            if (existingOrderRows.length > 0) {
                await connection.execute(
                    `UPDATE orders SET status = 'PAYMENT_FAILED', paymentStatus = 'FAILED', kakapayTransactionId = ? WHERE id = ?`,
                    [kkiapayActualTransactionIdFromSDK, orderId]
                );
            } else if (orderPayload?.userId) { // S'assurer que userId est disponible pour insérer une nouvelle commande échouée
                await connection.execute(
                    `INSERT INTO orders (id, userId, totalAmount, kakapayTransactionId, status, paymentStatus,
                        shippingAddressLine1, shippingAddressLine2, shippingCity, shippingState, shippingZipCode, shippingCountry, orderDate)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        orderId,
                        userId,
                        totalAmount,
                        kkiapayActualTransactionIdFromSDK,
                        'PAYMENT_FAILED',
                        'FAILED',
                        shippingAddress.fullName || '',
                        shippingAddress.area || '',
                        shippingAddress.city || '',
                        shippingAddress.state || '',
                        shippingAddress.pincode || '',
                        shippingAddress.country || 'Bénin'
                    ]
                );
            }

            await connection.execute(
                `INSERT INTO payments (id, orderId, paymentMethod, transactionId, amount, currency, status, paymentDate, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE status=VALUES(status), paymentDate=VALUES(paymentDate), updatedAt=NOW()`,
                [uuidv4(), orderId, kkiapayPaymentMethod, kkiapayActualTransactionIdFromSDK, kkiapayTransactionAmount, currency, 'FAILED']
            );

            await connection.commit();
            return NextResponse.redirect(`${request.nextUrl.origin}/order-status?orderId=${orderId}&status=failed&message=${encodeURIComponent(failMessage)}`);
        }

    } catch (err) {
        console.error("Erreur interne (hors vérification Kkiapay):", err.message || err);
        if (connection) await connection.rollback();
        return NextResponse.redirect(`${request.nextUrl.origin}/order-status?status=error&message=${encodeURIComponent('Erreur serveur interne.')}`);
    } finally {
        if (connection) connection.release();
    }
}

export async function POST(request) {
    console.log("Kkiapay Callback POST reçu → on redirige vers GET");
    return GET(request);
}
