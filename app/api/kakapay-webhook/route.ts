// api/kkiapay-webhook/route.js
import { NextResponse } from 'next/server';
import pool from '../../../lib/db'; // Assurez-vous que le chemin est correct pour votre pool de connexion DB
import crypto from 'crypto'; // Nécessaire pour la vérification de signature HMAC

// La clé secrète de Kkiapay, utilisée pour vérifier la signature des webhooks.
// Doit être dans votre .env (NON NEXT_PUBLIC_)
const KAKAPAY_WEBHOOK_SECRET = process.env.KAKAPAY_SECRET; 

/**
 * @function isValidKakapayWebhookSignature
 * @description Vérifie la signature du webhook Kkiapay pour s'assurer de son authenticité.
 * @param {string} rawBody - Le corps brut de la requête HTTP (non parsé).
 * @param {string | null} signatureHeader - L'en-tête de signature X-Kkiapay-Signature.
 * @param {string | undefined} secret - La clé secrète du webhook Kkiapay.
 * @returns {boolean} True si la signature est valide, false sinon.
 */
function isValidKakapayWebhookSignature(rawBody, signatureHeader, secret) {
    if (!secret) {
        console.error('KAKAPAY_SECRET non configuré. Impossible de vérifier la signature du webhook.');
        return false;
    }
    if (!signatureHeader) {
        console.warn('Webhook reçu sans en-tête X-Kkiapay-Signature.');
        return false;
    }

    // Calculer le HMAC-SHA256 du corps brut de la requête avec la clé secrète
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const digest = hmac.digest('hex');

    // Comparer le digest calculé avec la signature reçue
    const isVerified = digest === signatureHeader;
    if (!isVerified) {
        console.error(`Signature de webhook invalide. Reçue: ${signatureHeader}, Calculée: ${digest}`);
    }
    return isVerified;
}

/**
 * @route POST /api/kkiapay-webhook
 * @description Gère les notifications asynchrones (webhooks) de Kkiapay.
 * Vérifie la signature du webhook et met à jour le statut final des commandes et paiements.
 * @access Public (appelé par Kkiapay)
 */
export async function POST(req) {
    let connection; // Déclarer la connexion en dehors du try pour le finally
    let rawBody; // Déclarer rawBody pour qu'il soit accessible dans le catch

    try {
        // Lisez le corps de la requête comme du texte brut AVANT de le parser en JSON
        rawBody = await req.text(); 
        const event = JSON.parse(rawBody); // Ensuite, parsez-le en JSON

        // *** TRÈS IMPORTANT : VÉRIFIER LA SIGNATURE DU WEBHOOK POUR LA SÉCURITÉ ***
        // L'en-tête de signature de Kkiapay est généralement 'X-Kkiapay-Signature'
        const signature = req.headers.get('X-Kkiapay-Signature'); 

        if (!isValidKakapayWebhookSignature(rawBody, signature, KAKAPAY_WEBHOOK_SECRET)) {
            console.warn('Signature de webhook Kakapay invalide. Requête rejetée.');
            return NextResponse.json({ message: 'Signature de webhook invalide' }, { status: 401 });
        }

        console.log('--- Webhook Kakapay Reçu ---');
        console.log('Type d\'événement:', event.event_type); // Par exemple: 'transaction.success', 'transaction.failed'
        console.log('Données de l\'événement:', event.data); // Contient les détails de la transaction
        console.log('----------------------------');

        // Récupérez les informations pertinentes du webhook
        const kakapayTransactionId = event.data.id;     // L'ID de transaction unique de Kkiapay
        // La documentation Kkiapay indique que 'reference' est la référence de commande que vous avez envoyée
        const orderReference = event.data.reference;    // Votre Order ID (celui que vous avez généré)
        const paymentStatusFromKakapay = event.data.status; // Le statut de paiement envoyé par Kkiapay (ex: 'SUCCESS', 'FAILED', 'PENDING')
        const amount = event.data.amount; // Montant de la transaction
        const currency = event.data.currency || 'XOF'; // Devise de la transaction
        const paymentMethod = event.data.paymentMethod || 'Inconnu'; // Méthode de paiement

        let newOrderStatus;
        let newPaymentStatus;

        // Déterminer les statuts de commande et de paiement en fonction du statut Kkiapay
        switch (paymentStatusFromKakapay) {
            case 'SUCCESS':
                newOrderStatus = 'PAID_SUCCESS';
                newPaymentStatus = 'COMPLETED';
                console.log(`Paiement réussi confirmé par webhook pour la transaction Kkiapay: ${kakapayTransactionId}`);
                break;
            case 'FAILED':
            case 'CANCELLED': // Kkiapay peut envoyer 'CANCELLED' ou 'FAILED' pour un échec
                newOrderStatus = 'PAYMENT_FAILED';
                newPaymentStatus = 'FAILED';
                console.log(`Paiement échoué/annulé confirmé par webhook pour la transaction Kkiapay: ${kakapayTransactionId}`);
                break;
            case 'PENDING':
                newOrderStatus = 'PENDING';
                newPaymentStatus = 'PENDING';
                console.log(`Paiement en attente confirmé par webhook pour la transaction Kkiapay: ${kakapayTransactionId}`);
                break;
            default:
                // Gérer les statuts inattendus comme des échecs pour la sécurité
                newOrderStatus = 'PAYMENT_FAILED';
                newPaymentStatus = 'FAILED';
                console.warn(`Statut Kkiapay inattendu (${paymentStatusFromKakapay}) pour transaction ${kakapayTransactionId}. Traité comme échec.`);
        }

        connection = await pool.getConnection();
        await connection.beginTransaction(); // Démarre une transaction DB

        try {
            // 1. Mettre à jour le statut de la commande dans votre DB
            // On recherche la commande par son ID Kkiapay ou par la référence de commande que vous avez passée
            // La colonne `kakapayTransactionId` dans `orders` est l'ID de transaction Kkiapay.
            // La colonne `id` dans `orders` est votre `orderId` interne.
            // Le webhook peut arriver avant le callback, donc on doit être flexible.
            
            // Tenter de trouver la commande par l'ID de transaction Kkiapay
            let [orderRows] = await connection.execute(
                `SELECT id FROM \`orders\` WHERE \`kakapayTransactionId\` = ?`,
                [kakapayTransactionId]
            );
            let orderIdToUpdate = orderRows.length > 0 ? orderRows[0].id : null;

            // Si non trouvé par kakapayTransactionId, tenter de trouver par orderReference (si elle correspond à votre order.id)
            if (!orderIdToUpdate && orderReference) {
                [orderRows] = await connection.execute(
                    `SELECT id FROM \`orders\` WHERE \`id\` = ?`,
                    [orderReference]
                );
                if (orderRows.length > 0) {
                    orderIdToUpdate = orderRows[0].id;
                }
            }

            if (!orderIdToUpdate) {
                console.warn(`Commande non trouvée dans la DB pour Kkiapay Transaction ID: ${kakapayTransactionId} ou référence: ${orderReference}.`);
                // Si la commande n'existe pas, cela peut être un webhook pour une transaction non initiée chez vous,
                // ou un problème de synchronisation. On ne peut pas mettre à jour.
                await connection.rollback(); // Annuler la transaction DB
                return NextResponse.json({ message: 'Commande non trouvée pour la mise à jour.' }, { status: 404 });
            }

            await connection.execute(
                `UPDATE \`orders\` SET 
                    \`status\` = ?, 
                    \`paymentStatus\` = ?, 
                    \`kakapayTransactionId\` = ?,
                    \`updatedAt\` = NOW()
                 WHERE \`id\` = ?`,
                [newOrderStatus, newPaymentStatus, kakapayTransactionId, orderIdToUpdate]
            );
            console.log(`Commande ${orderIdToUpdate} mise à jour avec statut ${newOrderStatus} via webhook.`);

            // 2. Insérer ou mettre à jour l'enregistrement de paiement dans la table `payments`
            // Utilise ON DUPLICATE KEY UPDATE sur `transactionId` (qui est l'ID de Kkiapay)
            await connection.execute(
                `INSERT INTO \`payments\` (
                    \`id\`, \`orderId\`, \`paymentMethod\`, \`transactionId\`, \`amount\`, 
                    \`currency\`, \`status\`, \`paymentDate\`, \`createdAt\`
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE 
                    \`paymentMethod\` = VALUES(\`paymentMethod\`),
                    \`amount\` = VALUES(\`amount\`),
                    \`currency\` = VALUES(\`currency\`),
                    \`status\` = VALUES(\`status\`),
                    \`paymentDate\` = VALUES(\`paymentDate\`),
                    \`updatedAt\` = NOW()`,
                [uuidv4(), orderIdToUpdate, paymentMethod, kakapayTransactionId, amount, currency, newPaymentStatus]
            );
            console.log(`Enregistrement de paiement pour la commande ${orderIdToUpdate} mis à jour/inséré via webhook.`);

            await connection.commit(); // Valide la transaction DB
            console.log(`Transaction DB pour webhook committée pour commande ${orderIdToUpdate}.`);

        } catch (dbError) {
            await connection.rollback(); // Annule la transaction DB en cas d'erreur
            console.error(`Erreur DB lors du traitement du webhook pour transaction ${kakapayTransactionId}:`, dbError);
            return NextResponse.json({ message: 'Erreur DB interne lors du traitement du webhook.' }, { status: 500 });
        }

        // Il est crucial de renvoyer un statut 200 OK à Kkiapay pour indiquer que le webhook a été reçu et traité.
        return NextResponse.json({ message: 'Webhook Kakapay reçu et traité avec succès' }, { status: 200 });

    } catch (error) {
        // Gérer les erreurs de parsing JSON ou autres erreurs générales
        if (connection) {
            await connection.rollback(); // S'assurer que la transaction est annulée en cas d'erreur avant le commit
        }
        console.error('Erreur lors du traitement du webhook Kakapay (catch global):', error);
        // En cas d'erreur interne, renvoyez un 500 pour que Kkiapay puisse potentiellement réessayer.
        return NextResponse.json({ message: 'Erreur interne du serveur lors du traitement du webhook.' }, { status: 500 });
    } finally {
        if (connection) {
            connection.release(); // Toujours libérer la connexion à la base de données
        }
    }
}
