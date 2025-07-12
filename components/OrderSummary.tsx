// 'use client'; // Gardez cette directive en haut du fichier

import React, { useEffect, useState, useRef } from "react";
import { useAppContext } from "@/context/AppContext"; // Assurez-vous que le chemin est correct
import { toast } from "react-toastify";
import axios from "axios";
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation'; // Importez useRouter si vous ne l'avez pas déjà

// Déclarations TypeScript pour les fonctions globales de Kkiapay (répétées pour la clarté, mais devraient être dans types/kkiapay.d.ts)
declare global {
    interface Window {
        openKkiapayWidget: (options: KkiapayOptions) => void;
        addSuccessListener: (callback: (response: KkiapaySuccessResponse) => void) => void;
        addFailedListener: (callback: (error: KkiapayErrorResponse) => void) => void;
    }
}

// Interfaces pour les options et réponses de Kkiapay (répétées ici pour la clarté)
interface KkiapayOptions {
    amount: number;
    api_key: string;
    callback?: string;
    transaction_id?: string;
    email?: string;
    phone?: string;
    position?: "left" | "right" | "center";
    sandbox?: boolean; // Type corrigé en boolean
    data?: string;
    theme?: string;
    paymentmethod?: "momo" | "card";
    name?: string;
}

interface KkiapaySuccessResponse {
    transactionId: string;
    data?: string;
    amount?: number;
    paymentMethod?: string;
    reference?: string;
    status?: string;
    email?: string;
    phone?: string;
}

interface KkiapayErrorReason {
    code?: string;
    message?: string;
}

interface KkiapayErrorResponse {
    transactionId?: string;
    reason?: KkiapayErrorReason;
    message?: string;
}

// Interface pour Address (pour la sûreté de type)
interface Address {
    id: string; // Ou number, selon votre type d'ID
    _id?: string; // Pour MongoDB ObjectId si applicable
    fullName: string;
    phoneNumber: string;
    pincode: string;
    area: string;
    city: string;
    state: string;
    isDefault: boolean;
    country?: string; // Ajouté car utilisé dans le backend
}

// Interface pour Product (pour la sûreté de type dans le mappage orderItems)
interface Product {
    id: string; // Ou number
    name: string;
    price: number;
    offerPrice?: number; // Optionnel
    imgUrl?: string[]; // Tableau de chaînes
}

// Interface pour CartItem (pour la sûreté de type des éléments du panier)
// Cette interface décrit la structure d'un élément INDIVIDUEL du panier,
// si cartItems était un tableau d'objets comme { productId: "...", quantity: ... }
// Puisque cartItems est un objet { [productId]: quantity }, cette interface n'est pas directement utilisée
// pour le type de cartItems lui-même, mais pour la structure des éléments après Object.entries().map
interface CartItemsMap {
    [productId: string]: number; // Maps product ID strings to their quantities (numbers)
}


const OrderSummary = () => {
    const router = useRouter(); // Initialiser useRouter
    const {
        currency,
        getCartCount,
        getCartAmount,
        currentUser,
        userAddresses,
        loadingAddresses,
        fetchUserAddresses,
        url,
        products,
        cartItems, // cartItems est de type CartItemsMap (un objet)
        formatPriceInFCFA,
    } = useAppContext();

    const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showKakapayWidget, setShowKakapayWidget] = useState(false);
    const [transactionIdForKakapay, setTransactionIdForKakapay] = useState<string | null>(null);
    const [preparedOrderPayload, setPreparedOrderPayload] = useState<any>(null); // Type plus spécifique si possible

    const [isKkiapayWidgetApiReady, setIsKkiapayWidgetApiReady] = useState(false);
    const kkiapayApiCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const kkiapayOpenRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Calcul du montant total à payer (avec 2% de frais si applicable)
    const totalAmountToPay = getCartCount() > 0 ? getCartAmount() + Math.floor(getCartAmount() * 0.02) : 0;
    
    // Récupération de la clé publique Kkiapay
    const KAKAPAY_PUBLIC_API_KEY: string | undefined = process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_API_KEY;

    // Effet pour définir l'adresse par défaut
    useEffect(() => {
        if (!loadingAddresses && userAddresses.length > 0) {
            const defaultAddress = userAddresses.find((addr: Address) => addr.isDefault) || userAddresses[0];
            setSelectedAddress(defaultAddress);
        } else if (!loadingAddresses && userAddresses.length === 0) {
            setSelectedAddress(null);
        }
    }, [userAddresses, loadingAddresses]);

    // Effet pour vérifier la disponibilité de l'API Kkiapay
    useEffect(() => {
        // Nettoyer l'intervalle précédent si existant
        if (kkiapayApiCheckIntervalRef.current) {
            clearInterval(kkiapayApiCheckIntervalRef.current);
            kkiapayApiCheckIntervalRef.current = null;
        }

        // Fonction pour vérifier la disponibilité complète des fonctions Kkiapay
        const checkKkiapayApiFullAvailability = () => {
            return typeof window !== "undefined" &&
                typeof window.openKkiapayWidget === 'function' &&
                typeof window.addSuccessListener === 'function' &&
                typeof window.addFailedListener === 'function';
        };

        // Vérifier immédiatement
        if (checkKkiapayApiFullAvailability()) {
            console.log('[Kkiapay Init] API openKkiapayWidget et les écouteurs sont immédiatement disponibles !');
            setIsKkiapayWidgetApiReady(true);
            return;
        }

        console.log("[Kkiapay Init] Démarrage du sondage pour la disponibilité de l'API Kkiapay...");
        // Sondage régulier pour attendre que l'API Kkiapay soit prête
        kkiapayApiCheckIntervalRef.current = setInterval(() => {
            if (checkKkiapayApiFullAvailability()) {
                console.log('[Kkiapay Init] API openKkiapayWidget et les écouteurs sont maintenant disponibles ! Activation du bouton.');
                setIsKkiapayWidgetApiReady(true);
                // Arrêter le sondage une fois que l'API est prête
                if (kkiapayApiCheckIntervalRef.current) {
                    clearInterval(kkiapayApiCheckIntervalRef.current);
                    kkiapayApiCheckIntervalRef.current = null;
                }
            } else {
                console.log('[Kkiapay Init] API Kkiapay (openKkiapayWidget / addSuccessListener / addFailedListener) non encore disponible, attente en cours...');
            }
        }, 100); // Vérifier toutes les 100ms

        // Fonction de nettoyage pour l'intervalle
        return () => {
            if (kkiapayApiCheckIntervalRef.current) {
                clearInterval(kkiapayApiCheckIntervalRef.current);
                kkiapayApiCheckIntervalRef.current = null;
            }
            console.log('[Kkiapay Init] Sondage de l\'API Kkiapay arrêté.');
        };
    }, []);

    // Gérer la sélection d'une adresse et la définir comme par défaut
    const handleAddressSelect = async (address: Address) => {
        setSelectedAddress(address);
        setIsDropdownOpen(false);

        if (currentUser && currentUser.id && address.id) {
            try {
                const headers = { 'Content-Type': 'application/json' };

                const response = await axios.put(
                    `${url}/api/addresses/${currentUser.id}`,
                    {
                        id: address.id,
                        fullName: address.fullName,
                        phoneNumber: address.phoneNumber,
                        pincode: address.pincode,
                        area: address.area,
                        city: address.city,
                        state: address.state,
                        isDefault: true // Définir cette adresse comme par défaut
                    },
                    { headers }
                );

                if (response.status === 200 && response.data.success) {
                    toast.success("Adresse par défaut définie avec succès !");
                    fetchUserAddresses(); // Recharger les adresses pour mettre à jour le contexte
                } else {
                    toast.error(`Échec de la définition de l'adresse par défaut: ${response.data.message || 'Erreur inconnue.'}`);
                }
            } catch (error) {
                console.error("Erreur setting default address:", error);
                toast.error(`Erreur réseau lors de la définition de l'adresse par défaut.`);
            }
        }
    };

    // Fonction pour créer la commande et initier le paiement Kkiapay
    const createOrder = async () => {
        console.log("--- Début de la fonction createOrder ---");

        // Vérifications préliminaires
        if (!selectedAddress) {
            console.log("[Create Order] ERREUR: Aucune adresse sélectionnée.");
            toast.error("Veuillez sélectionner ou ajouter une adresse de livraison pour continuer.");
            return;
        }

        if (!currentUser || !currentUser.id) {
            console.log("[Create Order] ERREUR: Utilisateur non connecté ou ID manquant.");
            toast.error("Veuillez vous connecter pour passer commande.");
            router.push('/login');
            return;
        }

        if (getCartCount() === 0) {
            console.log("[Create Order] ERREUR: Panier vide.");
            toast.error("Votre panier est vide.");
            return;
        }

        if (!isKkiapayWidgetApiReady) {
            console.log("[Create Order] ERREUR: API openKkiapayWidget non prête. Clic du bouton bloqué.");
            toast.info("Le module de paiement n'est pas encore prêt. Veuillez patienter un instant et réessayer.");
            return;
        }

        // Vérifier si la clé API publique Kkiapay est définie
        if (!KAKAPAY_PUBLIC_API_KEY) {
            console.log("[Create Order] ERREUR: KAKAPAY_PUBLIC_API_KEY est indéfini.");
            toast.error("La clé d'API publique Kkiapay n'est pas configurée. Veuillez contacter le support.");
            setIsLoading(false); // S'assurer que l'état de chargement est désactivé
            return;
        }

        setIsLoading(true); // Activer l'état de chargement
        toast.info("Préparation du paiement Kkiapay...");

        try {
            // Étape 1: Obtenir un transactionId du backend (qui sera notre orderId)
            console.log("[Create Order] Appel à /api/order/prepare-payment pour obtenir un transactionId (GET)...");
            const prepareResponse = await axios.get(`${url}/api/order/prepare-payment`);

            if (prepareResponse.status === 200 && prepareResponse.data.success && prepareResponse.data.transactionId) {
                const newTransactionId = prepareResponse.data.transactionId;
                setTransactionIdForKakapay(newTransactionId); // Stocker l'ID de transaction généré
                console.log("[Create Order] Transaction ID reçu de l'API:", newTransactionId);

                // --- CORRECTION ICI : Utiliser Object.entries pour itérer sur l'objet cartItems ---
                const orderItems = Object.entries(cartItems).map(([productId, quantity]) => {
                    const numericQuantity = quantity as number; // S'assurer que la quantité est un nombre
                    const product = products.find(p => String(p.id) === String(productId));
                    if (!product) {
                        console.warn(`[Create Order] Produit avec ID ${productId} non trouvé dans la liste des produits.`);
                        return null; // Filtrera les articles nuls plus tard
                    }
                    return {
                        productId: productId,
                        quantity: numericQuantity,
                        price: product.offerPrice || product.price, // Prix au moment de la commande
                        name: product.name,
                        imgUrl: product.imgUrl && product.imgUrl[0] ? product.imgUrl[0] : ''
                    };
                }).filter(item => item !== null); // Filtrer les articles nuls

                if (orderItems.length === 0) {
                    console.log("[Create Order] ERREUR: Le panier ne contient pas d'articles valides pour la commande après filtrage.");
                    toast.error("Le panier ne contient pas d'articles valides pour la commande.");
                    setIsLoading(false);
                    return;
                }

                const fullOrderPayload = {
                    userId: currentUser.id,
                    items: orderItems,
                    totalAmount: totalAmountToPay,
                    shippingAddress: selectedAddress,
                    userEmail: currentUser.email || '',
                    userPhoneNumber: selectedAddress?.phoneNumber || '',
                    currency: currency,
                    orderId: newTransactionId, // Inclure notre orderId dans le payload
                };
                setPreparedOrderPayload(fullOrderPayload); // Stocker le payload préparé

                toast.success("Commande préparée ! Tentative d'ouverture du paiement Kkiapay...");
                setShowKakapayWidget(true); // Déclenche l'ouverture du widget dans l'useEffect suivant
                console.log("[Create Order] showKakapayWidget mis à true, déclenchement de l'ouverture du widget.");

            } else {
                console.error("[Create Order] L'API prepare-payment a échoué ou n'a pas renvoyé de transactionId.", prepareResponse.data);
                toast.error(`Erreur lors de la préparation de la commande: ${prepareResponse.data.message || 'Erreur inconnue.'}`);
            }
        } catch (error) {
            console.error("[Create Order] Erreur lors de la préparation de la commande Kkiapay (bloc catch):", error);
            if (axios.isAxiosError(error) && error.response) {
                toast.error(`Erreur serveur: ${error.response.data.message || 'Impossible de préparer la commande.'}`);
            } else {
                toast.error("Erreur inattendue lors de la commande.");
            }
        } finally {
            setIsLoading(false); // Désactiver l'état de chargement
            console.log("--- Fin de la fonction createOrder ---");
        }
    };

    // Effet pour initier l'ouverture du widget Kkiapay (approche JS directe)
    useEffect(() => {
        // Nettoyer le timeout précédent si existant
        if (kkiapayOpenRetryTimeoutRef.current) {
            clearTimeout(kkiapayOpenRetryTimeoutRef.current);
            kkiapayOpenRetryTimeoutRef.current = null;
        }

        // Ouvrir le widget seulement si showKakapayWidget est true, transactionId est là, ET le payload est prêt
        if (showKakapayWidget && transactionIdForKakapay && preparedOrderPayload) {
            console.log("[Kkiapay Widget] Conditions showKakapayWidget, transactionIdForKakapay et preparedOrderPayload remplies. Déclenchement de la logique d'ouverture...");

            let retryCount = 0;
            const maxRetries = 60; // Max 60 retries (6 secondes)
            const retryDelay = 100; // 100ms de délai entre les tentatives

            const tryOpenKkiapayWidget = () => {
                if (typeof window.openKkiapayWidget === 'function') {
                    console.log("[Kkiapay Widget] openKkiapayWidget() est ENFIN disponible. Ouverture du widget !");
                    window.openKkiapayWidget({
                        amount: totalAmountToPay,
                        api_key: KAKAPAY_PUBLIC_API_KEY as string, // S'assurer que la clé est une chaîne
                        // L'URL de callback où Kkiapay redirigera l'utilisateur après le paiement
                        callback: `${window.location.origin}/api/kkiapay-callback?transactionId=${transactionIdForKakapay}`,
                        transaction_id: transactionIdForKakapay, // L'ID de transaction que vous avez généré
                        email: currentUser?.email || '',
                        phone: selectedAddress?.phoneNumber || '',
                        position: "center",
                        sandbox: process.env.NODE_ENV === 'development', // Active le mode sandbox en développement
                        data: JSON.stringify(preparedOrderPayload) // ENVOI DU PAYLOAD COMPLET À KKIAY
                    });

                    // Ajouter les écouteurs pour les événements de succès et d'échec
                    if (typeof window.addSuccessListener === 'function') {
                        window.addSuccessListener((response: KkiapaySuccessResponse) => {
                            console.log("[Kkiapay Widget] Paiement Kkiapay succès via addSuccessListener:", response);
                            setShowKakapayWidget(false); // Cacher le widget
                            // Rediriger vers la page de statut de commande
                            router.push(`/order-status?orderId=${response.transactionId || transactionIdForKakapay}&status=success`);
                        });
                    } else {
                        console.warn("[Kkiapay Widget] addSuccessListener non trouvé. Les événements de succès ne seront pas capturés.");
                    }

                    if (typeof window.addFailedListener === 'function') {
                        window.addFailedListener((error: KkiapayErrorResponse) => {
                            const errorMessage = error.reason?.message || error.message || "Le paiement a échoué ou a été annulé.";
                            console.warn("[Kkiapay Widget] Paiement Kkiapay échec via addFailedListener:", error);
                            setShowKakapayWidget(false); // Cacher le widget
                            // Rediriger vers la page de statut de commande avec un message d'erreur
                            router.push(`/order-status?orderId=${transactionIdForKakapay}&status=failed&message=${encodeURIComponent(errorMessage)}`);
                        });
                    } else {
                        console.warn("[Kkiapay Widget] addFailedListener non trouvé. Les événements d'échec ne seront pas capturés.");
                    }

                } else {
                    // Si l'API n'est pas encore disponible, réessayer après un court délai
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.warn(`[Kkiapay Widget] openKkiapayWidget() n'est pas encore disponible. Nouvelle tentative (${retryCount}/${maxRetries})...`);
                        kkiapayOpenRetryTimeoutRef.current = setTimeout(tryOpenKkiapayWidget, retryDelay);
                    } else {
                        // Si le nombre maximal de tentatives est atteint, afficher une erreur critique
                        console.error("[Kkiapay Widget] CRITIQUE FINALE : openKkiapayWidget() n'est pas devenu disponible après de multiples tentatives. Le widget ne peut pas s'ouvrir. Problème d'initialisation de l'API JavaScript Kkiapay.");
                        toast.error("Erreur critique : Le module de paiement n'est pas utilisable. Veuillez contacter le support technique de Kkiapay.");
                        setShowKakapayWidget(false);
                    }
                }
            };

            tryOpenKkiapayWidget(); // Lancer la première tentative

        } else if (showKakapayWidget && !transactionIdForKakapay) {
            console.log("[Kkiapay Widget] Le widget Kkiapay ne peut pas s'ouvrir : ID de transaction manquant (log dans showKakapayWidget useEffect).", { showKakapayWidget, transactionIdForKakapay });
        } else if (showKakapayWidget && !preparedOrderPayload) {
            console.log("[Kkiapay Widget] Le widget Kkiapay ne peut pas s'ouvrir : Payload de commande non préparé.", { showKakapayWidget, preparedOrderPayload });
        }

        // Fonction de nettoyage pour le timeout de retry
        return () => {
            if (kkiapayOpenRetryTimeoutRef.current) {
                clearTimeout(kkiapayOpenRetryTimeoutRef.current);
                kkiapayOpenRetryTimeoutRef.current = null;
            }
        };
    }, [showKakapayWidget, transactionIdForKakapay, preparedOrderPayload, totalAmountToPay, currentUser, selectedAddress, KAKAPAY_PUBLIC_API_KEY, currency, router]);


    // Déterminer si le bouton de paiement doit être désactivé
    const isButtonDisabled = getCartCount() === 0 || isLoading || !isKkiapayWidgetApiReady || !KAKAPAY_PUBLIC_API_KEY;

    // Logs de débogage pour l'état du composant
    console.log("--- État du composant OrderSummary ---");
    console.log("Panier vide (getCartCount() === 0):", getCartCount() === 0);
    console.log("En chargement (isLoading):", isLoading);
    console.log("API Kkiapay prête (isKkiapayWidgetApiReady - CLÉ pour activer le bouton):", isKkiapayWidgetApiReady);
    console.log("Clé publique Kkiapay définie (KAKAPAY_PUBLIC_API_KEY):", KAKAPAY_PUBLIC_API_KEY ? "Defined" : "Undefined");
    console.log("Bouton désactivé (isButtonDisabled - calculé):", isButtonDisabled);
    console.log("Transaction ID for Kkiapay (état local):", transactionIdForKakapay);
    console.log("Prepared Order Payload (état local):", preparedOrderPayload);
    console.log("Current user:", currentUser);
    console.log("User Addresses:", userAddresses);
    console.log("Cart Items:", cartItems);
    console.log("Products (sample):", products.length > 0 ? products.slice(0, 2) : "No products loaded");
    console.log("-----------------------------------");

    return (
        <div className="w-full md:w-96 bg-white rounded-lg shadow-md p-6 space-y-6">
            <h2 className="text-2xl font-semibold text-gray-800">
                Résumé de la commande
            </h2>

            <div>
                <label className="block text-gray-600 font-medium mb-2">
                    Sélectionnez une adresse
                </label>
                <div className="relative">
                    <button
                        className="w-full px-4 py-3 border rounded-md bg-gray-50 text-gray-700 focus:outline-none hover:bg-gray-100 flex justify-between items-center"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        disabled={loadingAddresses || isLoading}
                    >
                        <span>
                            {loadingAddresses
                                ? "Chargement des adresses..."
                                : selectedAddress
                                    ? `${selectedAddress.fullName}, ${selectedAddress.city}`
                                    : "Veuillez sélectionner une adresse"}
                        </span>
                        <svg
                            className={`w-5 h-5 ml-2 inline transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {isDropdownOpen && (
                        <ul className="absolute mt-2 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                            {userAddresses.length > 0 ? (
                                userAddresses.map((address: Address) => (
                                    <li
                                        key={address.id || address._id}
                                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                                        onClick={() => handleAddressSelect(address)}
                                    >
                                        {address.fullName}, {address.area}, {address.city}, {address.state}
                                    </li>
                                ))
                            ) : (
                                <li className="px-4 py-2 text-gray-500 text-center">Aucune adresse trouvée.</li>
                            )}
                            <li
                                className="px-4 py-2 text-blue-600 hover:text-blue-800 hover:bg-gray-100 cursor-pointer text-center border-t mt-1 pt-1"
                                onClick={() => {
                                    setIsDropdownOpen(false);
                                    router.push("/add-address");
                                }}
                            >
                                + Ajouter une nouvelle adresse
                            </li>
                        </ul>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between text-gray-700">
                    <span>Articles ({getCartCount()})</span>
                    <span>{formatPriceInFCFA(getCartAmount())}</span>
                </div>

                <div className="flex justify-between text-gray-700 font-semibold border-t pt-4">
                    <span>Total à payer</span>
                    <span>{formatPriceInFCFA(totalAmountToPay)}</span>
                </div>
            </div>

            <button
                onClick={createOrder}
                className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center justify-center"
                disabled={isButtonDisabled}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Préparation du paiement...
                    </>
                ) : (
                    "Procéder au Paiement avec Kakapay"
                )}
            </button>

            {/* La modale de statut de commande est maintenant gérée par la page /order-status */}
        </div>
    );
};

export default OrderSummary;