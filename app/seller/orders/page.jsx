'use client';
import React, { useEffect, useState, useCallback } from "react";
import { assets } from "@/assets/assets";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import Footer from "@/components/seller/Footer";
import Loading from "@/components/Loading";
import axios from "axios";
import { MoreHorizontal, Package, Trash2 } from 'lucide-react'; // Import Trash2 icon
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify'; // Import toast for notifications

const getStatusBadgeStyle = (status) => {
  switch (status) {
    case 'DELIVERED':
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'PENDING':
    case 'PROCESSING':
    case 'ON_HOLD':
    case 'SHIPPED':
      return 'bg-orange-100 text-orange-800';
    case 'CANCELLED':
    case 'FAILED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const Orders = () => {
  const { url, formatPriceInFCFA } = useAppContext();
  const { data: session, status } = useSession();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false); // State for confirmation modal
  const [orderToDelete, setOrderToDelete] = useState(null); // State to store the order ID to delete

  const fetchAllOrders = useCallback(async () => {
    if (status !== 'authenticated') {
      setLoading(false);
      setError("Vous devez être connecté pour voir les commandes.");
      return;
    }

    try {
      const response = await axios.get(`${url}/api/admin/orders`);
      if (response.status === 200 && Array.isArray(response.data)) {
        setOrders(response.data);
      } else {
        setError("Format de données inattendu.");
      }
    } catch (err) {
      setError("Erreur lors du chargement des commandes.");
    } finally {
      setLoading(false);
    }
  }, [url, status]);

  // Function to handle status change
  const handleStatusChange = async (event, orderId) => {
    const newStatus = event.target.value;
    try {
      const response = await axios.post(`${url}/api/admin/order-status`, {
        orderId,
        status: newStatus
      });

      if (response.data.success) {
        // Update the order in the local state to reflect the change
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId ? { ...order, orderStatus: newStatus } : order
          )
        );
        toast.success("Statut de la commande mis à jour avec succès !");
      } else {
        toast.error("Échec de la mise à jour du statut de la commande.");
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      toast.error("Erreur réseau ou du serveur lors de la mise à jour du statut.");
    }
  };

  // Function to initiate delete confirmation
  const handleDeleteClick = (orderId) => {
    setOrderToDelete(orderId);
    setShowConfirmModal(true);
  };

  // Function to confirm and execute delete
  const confirmDelete = async () => {
    setShowConfirmModal(false); // Close the modal
    if (!orderToDelete) return;

    try {
      const response = await axios.delete(`${url}/api/admin/orders/${orderToDelete}`); // Use DELETE method
      if (response.data.success) {
        setOrders(prevOrders => prevOrders.filter(order => order.id !== orderToDelete));
        toast.success("Commande supprimée avec succès !");
      } else {
        toast.error("Échec de la suppression de la commande.");
      }
    } catch (error) {
      console.error("Erreur lors de la suppression de la commande:", error);
      toast.error("Erreur réseau ou du serveur lors de la suppression de la commande.");
    } finally {
      setOrderToDelete(null); // Clear the order to delete
    }
  };

  // Function to cancel delete
  const cancelDelete = () => {
    setShowConfirmModal(false);
    setOrderToDelete(null);
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAllOrders();
    } else if (status === 'unauthenticated') {
      setLoading(false);
      setError("Non connecté. Veuillez vous connecter.");
    }
  }, [status, fetchAllOrders]);

  const formatFullDateTime = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 font-inter">
      <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-8">
          <Package className="w-10 h-10 text-blue-600" />
          <h1 className="text-4xl font-extrabold text-gray-900">Gestion des Commandes</h1>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64 bg-white rounded-xl shadow">
            <Loading />
          </div>
        ) : error ? (
          <div className="text-center bg-red-100 border border-red-300 text-red-800 p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-bold mb-3">Erreur</h2>
            <p>{error}</p>
            <button
              onClick={() => window.location.href = '/login'}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-transform duration-300 transform hover:scale-105"
            >
              Se connecter
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <h2 className="text-2xl font-semibold text-gray-800">Toutes les Commandes Clients</h2>
            </div>

            {orders.length === 0 ? (
              <p className="text-gray-600 text-center p-10">Aucune commande trouvée.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-100">
                    <tr>{/* Removed whitespace here */}
                      <th className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Client</th>
                      <th className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Articles</th>
                      <th className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Total</th>
                      <th className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Livraison</th>
                      <th className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Paiement</th>
                      <th className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Date</th>
                      {/* Statut Commande column moved before Actions */}
                      <th className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Statut Commande</th>
                      <th className="py-4 px-6 text-left font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-blue-50 transition duration-150">{/* Removed whitespace here */}
                        <td className="py-4 px-6">
                          <p className="font-semibold text-gray-800">{order.userName || 'N/A'}</p>
                          <p className="text-gray-600">{order.userEmail || 'N/A'}</p>
                        </td>
                        <td className="py-4 px-6">
                          {order.items?.length > 0 ? (
                            <ul className="space-y-1">
                              {order.items.map((item, index) => (
                                <li key={index} className="flex items-center gap-2">
                                  {item.imgUrl && (
                                    <Image
                                      src={item.imgUrl}
                                      alt={item.name}
                                      width={30}
                                      height={30}
                                      className="rounded object-cover"
                                    />
                                  )}
                                  <span className="text-gray-700">{item.name} x {item.quantity}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-500">Aucun</span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-bold text-gray-900">{formatPriceInFCFA(order.totalAmount)}</td>
                        <td className="py-4 px-6 text-gray-700">
                          <p>{order.shippingAddressLine1}</p>
                          {order.shippingAddressLine2 && <p>{order.shippingAddressLine2}</p>}
                          <p>{`${order.shippingCity || ''}, ${order.shippingState || ''}`}</p>
                          <p>{`${order.shippingZipCode || '', order.shippingCountry || ''}`}</p>
                          {order.shippingPhoneNumber && <p className="font-medium">Tél: {order.shippingPhoneNumber}</p>}
                          {!order.shippingPhoneNumber && <p className="font-medium text-gray-500">Tél: N/A</p>}
                        </td>
                        <td className="py-4 px-6 text-gray-700">
                          <p className="font-medium">Méthode : {order.paymentMethod}</p>
                          <p>Statut :
                            <span className={`ml-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeStyle(order.paymentStatusDetail)}`}>
                              {order.paymentStatusDetail?.replace(/_/g, ' ') || 'N/A'}
                            </span>
                          </p>
                          <p className="font-mono text-xs">ID: {order.paymentTransactionId || 'N/A'}</p>
                        </td>
                        <td className="py-4 px-6 text-gray-700 whitespace-nowrap">
                          {formatFullDateTime(order.orderDate)}
                        </td>
                        {/* Status Dropdown - Moved before Actions */}
                        <td className="py-4 px-6">
                          <select
                            onChange={(e) => handleStatusChange(e, order.id)}
                            value={order.orderStatus}
                            className={`p-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStatusBadgeStyle(order.orderStatus)}`}
                          >
                            <option value="PENDING">En attente</option>
                            <option value="DELIVERED">Livrée</option>
                          </select>
                        </td>
                        {/* Actions column with Delete button */}
                        <td className="py-4 px-6 text-left">
                          <button
                            onClick={() => handleDeleteClick(order.id)}
                            className="text-red-600 hover:text-red-800 transition-colors duration-200"
                            title="Supprimer la commande"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Confirmation Modal for Deletion */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Confirmer la suppression</h3>
              <p className="text-gray-700 mb-6">Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.</p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={cancelDelete}
                  className="px-6 py-3 bg-gray-300 text-gray-800 rounded-lg shadow hover:bg-gray-400 transition-transform duration-300 transform hover:scale-105"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-transform duration-300 transform hover:scale-105"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Orders;
