// app/api/order/prepare-payment/route.js
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
// Assurez-vous que le chemin vers authOptions est correct
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; 
import { v4 as uuidv4 } from 'uuid'; 

/**
 * @route GET /api/order/prepare-payment
 * @description Génère un ID de transaction unique (qui sera utilisé comme Order ID) pour Kkiapay.
 * Cette route ne persiste pas la commande dans la DB à ce stade.
 * La commande sera enregistrée après la confirmation du paiement via le callback Kkiapay.
 * @access Private (authentifié)
 */
export async function GET(request) {
    // Récupérer la session utilisateur pour l'authentification
    const session = await getServerSession(authOptions);

    // Vérifier si l'utilisateur est authentifié
    if (!session || !session.user || !session.user.id) {
        console.warn("Accès non autorisé à /api/order/prepare-payment: Pas de session ou user ID manquant.");
        return NextResponse.json({ success: false, message: 'Non authentifié. Veuillez vous connecter.' }, { status: 401 });
    }

    try {
        // Générer un UUID unique qui servira d'ID de transaction Kkiapay et d'ID de commande dans notre DB
        const transactionId = uuidv4(); 
        console.log(`Génération d'un transactionId pour Kkiapay: ${transactionId}`);

        // Retourner l'ID de transaction au frontend
        return NextResponse.json({ success: true, message: 'Transaction ID généré pour Kkiapay.', transactionId: transactionId }, { status: 200 });

    } catch (error) {
        // Gérer les erreurs internes du serveur
        console.error("Erreur lors de la génération du transactionId:", error);
        return NextResponse.json({ success: false, message: `Erreur serveur lors de la préparation du paiement: ${error.message}` }, { status: 500 });
    }
}
