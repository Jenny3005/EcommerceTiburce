'use client';
import React, { useEffect, useState } from "react";
import { assets } from "@/assets/assets";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import Footer from "@/components/Footer";
import Loading from "@/components/Loading";

const MyOrders = () => {
    const { currency, userOrders, loadingOrders, fetchUserOrders, isLoggedIn, currentUser } = useAppContext();

    const orders = userOrders;
    const loading = loadingOrders;
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isLoggedIn && currentUser?.id) {
            console.log("MyOrders component: User is logged in and currentUser.id is available, fetching orders.");
            fetchUserOrders();
            setError(null);
        } else if (!isLoggedIn) {
            setError("Veuillez vous connecter à votre compte pour consulter l'historique de vos commandes.");
        }
    }, [isLoggedIn, currentUser?.id, fetchUserOrders]);

    const formatFullDateTime = (timestamp) => {
        if (!timestamp) return "N/A";
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            try {
                const numericTimestamp = parseInt(timestamp, 10);
                if (!isNaN(numericTimestamp) && numericTimestamp > 1000000000000) { 
                    return new Date(numericTimestamp).toLocaleString();
                } else if (!isNaN(numericTimestamp) && numericTimestamp < 1000000000000) { 
                    return new Date(numericTimestamp * 1000).toLocaleString();
                }
            } catch (e) {
                console.error("Failed to parse timestamp:", timestamp, e);
            }
            return "Date invalide";
        }
        return date.toLocaleString('fr-FR', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
            hour12: false
        }); // Ajout du formatage pour une meilleure lisibilité
    };

    // Fonction pour déterminer le style du badge de statut
    const getStatusBadgeStyle = (status) => {
        switch (status) {
            case 'DELIVERED':
            case 'COMPLETED':
                return 'text-green-600';
            case 'PENDING':
            case 'PROCESSING':
            case 'SHIPPED':
                return 'text-orange-500';
            case 'CANCELLED':
            case 'FAILED':
                return 'text-red-500';
            default:
                return 'text-gray-600';
        }
    };

    return (
        <>
            <div className="flex flex-col justify-between px-6 md:px-16 lg:px-32 py-6 min-h-screen">
                <div className="space-y-5">
                    <h2 className="text-lg font-medium mt-6">Mes Commandes</h2>
                    {loading ? (
                        <Loading />
                    ) : error ? ( 
                        <p className="text-red-500 text-center mt-4">{error}</p>
                    ) : (
                        <div className="max-w-5xl border-t border-gray-300 text-sm">
                            {orders.length === 0 ? (
                                <p className="text-gray-600 mt-4 text-center">Vous n'avez pas encore passé de commandes.</p>
                            ) : (
                                orders.map((order) => (
                                    <div key={order.id} className="flex flex-col md:flex-row gap-5 justify-between p-5 border-b border-gray-300">
                                        <div className="flex-1 flex flex-col gap-3 max-w-80">
                                            <Image
                                                className="max-w-16 max-h-16 object-cover mb-2"
                                                src={assets.box_icon}
                                                alt="box_icon"
                                            />
                                            <p className="font-medium text-base">
                                                <span>
                                                    Articles ({order.items ? order.items.length : 0}) :{" "}
                                                    {order.items && order.items.length > 0 ? 
                                                        order.items.map((item) => `${item.name} x ${item.quantity}`).join(", ")
                                                        : "Aucun article"
                                                    }
                                                </span>
                                            </p>
                                            <p>Montant total : {currency}{parseFloat(order.totalAmount).toFixed(2)}</p>
                                            <p>Statut de la commande : <span className={`font-semibold ${getStatusBadgeStyle(order.orderStatus)}`}>{order.orderStatus}</span></p>
                                        </div>
                                        
                                        <div className="flex flex-col">
                                            <p className="font-semibold mb-2">Adresse de livraison :</p>
                                            <p>
                                                <span>{order.shippingAddressLine1 || 'N/A'}</span>
                                                {order.shippingAddressLine2 && <><br /><span>{order.shippingAddressLine2}</span></>}
                                                <br />
                                                <span>{`${order.shippingCity || ''}, ${order.shippingState || ''}`}</span>
                                                <br />
                                                <span>{order.shippingZipCode || 'N/A'}</span>
                                                <br />
                                                <span>{order.shippingCountry || 'N/A'}</span>
                                                {/* Ajout du numéro de téléphone de livraison ici */}
                                                {order.shippingPhoneNumber && <><br /><span className="font-medium">Tél: {order.shippingPhoneNumber}</span></>}
                                                {!order.shippingPhoneNumber && <><br /><span className="font-medium text-gray-500">Tél: N/A</span></>}
                                            </p>
                                        </div>
                                        
                                        <div className="flex flex-col">
                                            <p className="font-semibold mb-2">Détails du paiement :</p>
                                            <p>
                                                <span>Méthode : {order.paymentMethod || 'Non spécifié'}</span>
                                                <br />
                                                <span>Paiement : <span className={`font-semibold ${getStatusBadgeStyle(order.paymentStatus)}`}>{order.paymentStatus}</span></span>
                                                <br />
                                                <span>Date : {formatFullDateTime(order.orderDate)}</span> 
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </>
    );
};

export default MyOrders;