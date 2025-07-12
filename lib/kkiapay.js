// lib/kkiapay.js
import { kkiapay } from "@kkiapay-org/nodejs-sdk";

// Configuration du SDK
const k = kkiapay({
  privatekey: process.env.KKIAPAY_PRIVATE_API_KEY,
  publickey: process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_API_KEY, // Assurez-vous d'utiliser NEXT_PUBLIC_ ici si c'est la clé publique
  secretkey: process.env.KKIAPAY_SECRET_API_KEY,
  sandbox: process.env.KKIAPAY_ENV === 'sandbox' // true si KKIAPAY_ENV=sandbox
});

/**
 * Vérifie une transaction Kkiapay en utilisant le SDK officiel
 * @param {string} transactionId
 * @returns {Promise<Object>} - Réponse Kkiapay
 * @throws {Error} - Lance une erreur si la vérification échoue ou si la réponse est inattendue.
 */
export async function verifyKkiapayTransaction(transactionId) {
  try {
    console.log(`Vérification de la transactionId=${transactionId} via SDK Kkiapay...`);
    console.log(`  Configuration SDK: PrivateKey=${process.env.KKIAPAY_PRIVATE_API_KEY ? 'DEFINED' : 'UNDEFINED'}, PublicKey=${process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_API_KEY ? 'DEFINED' : 'UNDEFINED'}, SecretKey=${process.env.KKIAPAY_SECRET_API_KEY ? 'DEFINED' : 'UNDEFINED'}, Sandbox=${process.env.KKIAPAY_ENV === 'sandbox'}`);

    const result = await k.verify(transactionId);
    
    // Log complet du résultat pour le débogage
    console.log("✅ Réponse brute du SDK Kkiapay (result):", result);

    // Vérifier si le résultat est un objet valide et contient un statut
    if (result && typeof result === 'object' && result.status) {
      console.log("✅ Réponse du SDK Kkiapay (statut):", result.status);
      return result;
    } else {
      // Si le résultat n'est pas ce qui est attendu, lancer une erreur
      const errorMessage = `Réponse inattendue du SDK Kkiapay pour transaction ${transactionId}: ${JSON.stringify(result)}`;
      console.error("❌ " + errorMessage);
      throw new Error(errorMessage);
    }
  } catch (err) {
    // Capturer l'erreur lancée par le SDK ou par notre vérification
    console.error("❌ Erreur lors de la vérification via SDK:", err.message || err);
    throw err; // Relancer l'erreur pour qu'elle soit gérée par le callback route
  }
}
