"use client"; // Cette directive marque le composant comme un composant client

import React, { useState, useEffect } from 'react';

// Composant pour la page de gestion des stocks
const StockPage = () => {
  // État pour stocker la liste des produits
  const [products, setProducts] = useState([]);
  // État pour gérer le produit en cours d'édition
  const [editingProduct, setEditingProduct] = useState(null);
  // État pour les valeurs du formulaire d'édition
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    description: '',
    category: '',
    price: '', // Initialisé à une chaîne vide pour éviter null sur l'input
    offerPrice: '', // Initialisé à une chaîne vide pour éviter null sur l'input
    stock: 0,
    imgUrl: ''
  });
  // État pour le message de confirmation/erreur
  const [message, setMessage] = useState('');
  // État pour gérer l'état de chargement des données
  const [loading, setLoading] = useState(true);
  // État pour gérer les erreurs de chargement
  const [error, setError] = useState(null);
  // État pour stocker la date et l'heure actuelles (supprimé, mais laissé pour référence si besoin de le réactiver)
  // const [currentDateTime, setCurrentDateTime] = useState('');

  // Effet pour charger les données des produits depuis l'API backend
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/products');
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const data = await response.json();

        setProducts(data.map(product => {
          let imageUrl = '';
          try {
            const parsedImgUrl = JSON.parse(product.imgUrl);
            if (Array.isArray(parsedImgUrl) && parsedImgUrl.length > 0) {
              imageUrl = parsedImgUrl[0];
            } else {
              imageUrl = product.imgUrl;
            }
          } catch (e) {
            imageUrl = product.imgUrl;
          }

          return {
            id: product.id,
            name: product.name,
            description: product.description || '',
            category: product.category || 'Général',
            // Assurez-vous que price est un nombre, par défaut 0 si null/undefined/NaN
            price: product.price ? parseInt(product.price, 10) : 0,
            // Assurez-vous que offerPrice est un nombre ou null
            offerPrice: product.offerPrice ? parseInt(product.offerPrice, 10) : null,
            stock: parseInt(product.stock, 10),
            imgUrl: imageUrl
          };
        }));
      } catch (err) {
        console.error("Erreur lors de la récupération des produits:", err);
        setError("Impossible de charger les produits. Veuillez vérifier que votre API est fonctionnelle et que les données sont au bon format.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Effet pour afficher la date et l'heure de Porto-Novo (supprimé)
  /*
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      const options = {
        timeZone: 'Africa/Porto-Novo',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // Format 24 heures
      };
      setCurrentDateTime(now.toLocaleString('fr-FR', options));
    };

    // Met à jour immédiatement et ensuite toutes les secondes
    updateDateTime();
    const intervalId = setInterval(updateDateTime, 1000);

    // Nettoyage de l'intervalle lors du démontage du composant
    return () => clearInterval(intervalId);
  }, []); // Le tableau vide assure que cet effet ne s'exécute qu'une seule fois au montage
  */

  // Gère l'ouverture du modal d'édition
  const handleEditClick = (product) => {
    setEditingProduct(product);
    setEditForm({
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price !== null && product.price !== undefined ? product.price : '', // Affiche '' si null/undefined
      offerPrice: product.offerPrice !== null && product.offerPrice !== undefined ? product.offerPrice : '', // Affiche '' si null/undefined
      stock: product.stock,
      imgUrl: product.imgUrl
    });
    setMessage('');
  };

  // Gère la fermeture du modal d'édition
  const handleCloseModal = () => {
    setEditingProduct(null);
    // Réinitialise les champs numériques à '' pour éviter les erreurs de null sur l'input
    setEditForm({ id: '', name: '', stock: 0, price: '', description: '', category: '', offerPrice: '', imgUrl: '' });
    setMessage('');
  };

  // Gère les changements dans le formulaire d'édition
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => {
      if (name === 'stock' || name === 'price' || name === 'offerPrice') {
        // Si la valeur est une chaîne vide, stocke null pour offerPrice (si optionnel)
        // ou 0 pour price/stock (si requis). Pour l'input, on garde la chaîne vide.
        // La conversion en nombre pour l'API se fera dans handleFormSubmit.
        return { ...prev, [name]: value };
      }
      return { ...prev, [name]: value };
    });
  };

  // Gère la soumission du formulaire d'édition
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setMessage('Mise à jour en cours...');

    // Préparation des données à envoyer à l'API
    const dataToSend = {
      name: editForm.name,
      description: editForm.description,
      category: editForm.category,
      price: parseInt(editForm.price, 10), // Convertit en entier pour l'API
      // Convertit en entier ou null pour l'API si le champ est vide
      offerPrice: editForm.offerPrice !== '' ? parseInt(editForm.offerPrice, 10) : null,
      stock: parseInt(editForm.stock, 10),
      imgUrl: editForm.imgUrl,
    };

    try {
      const response = await fetch(`/api/products/${editForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(`Erreur HTTP: ${response.status} - ${result.message || 'Erreur inconnue'}`);
      }

      // Met à jour l'état local des produits après un succès API
      setProducts(products.map(p =>
        p.id === editForm.id ? {
          ...p,
          ...editForm,
          stock: parseInt(editForm.stock, 10),
          price: parseInt(editForm.price, 10),
          offerPrice: editForm.offerPrice !== '' ? parseInt(editForm.offerPrice, 10) : null,
          imgUrl: editForm.imgUrl
        } : p
      ));
      setMessage('Produit mis à jour avec succès !');

      // Le message disparaît après 3 secondes
      setTimeout(() => {
        setMessage('');
      }, 3000); // 3000 millisecondes = 3 secondes

      setEditingProduct(null);
    } catch (err) {
      console.error("Erreur lors de la mise à jour du produit:", err);
      setMessage(`Erreur lors de la mise à jour: ${err.message}. Veuillez vérifier votre API.`);
      // Le message d'erreur reste jusqu'à ce qu'une nouvelle action soit effectuée
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 font-sans">
      {/* Le conteneur principal prend une largeur maximale plus grande et est centré */}
      <div className="w-full max-w-screen-xl mx-auto bg-white p-6 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Gestion du Stock des Produits</h1>

        {message && (
          <div className={`p-3 mb-4 rounded-md text-center ${message.includes('succès') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}

        {loading && (
          <div className="text-center text-blue-600 text-lg">Chargement des produits...</div>
        )}

        {error && (
          <div className="p-3 mb-4 rounded-md text-center bg-red-100 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto rounded-lg shadow-md">
            <table className="min-w-full bg-white border-collapse">
              <thead className="bg-gray-200">
                <tr>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider rounded-tl-lg">Référence</th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Image</th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Nom du Produit</th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Quantité en Stock</th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Prix Unitaire</th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Prix Total</th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-4 px-4 text-center text-gray-500">Aucun produit trouvé.</td>
                  </tr>
                ) : (
                  products.map((product, index) => (
                    <tr key={product.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors duration-200`}>
                      <td className="py-3 px-4 border-b border-gray-200 text-gray-800 text-center whitespace-nowrap">{product.id}</td>
                      <td className="py-3 px-4 border-b border-gray-200 text-center whitespace-nowrap">
                        {product.imgUrl ? (
                          <img
                            src={product.imgUrl}
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded-md shadow-sm mx-auto"
                            onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/64x64/cccccc/000000?text=No+Image"; }}
                          />
                        ) : (
                          <img
                            src="https://placehold.co/64x64/cccccc/000000?text=No+Image"
                            alt="No Image"
                            className="w-16 h-16 object-cover rounded-md shadow-sm mx-auto"
                          />
                        )}
                      </td>
                      <td className="py-3 px-4 border-b border-gray-200 text-gray-800 text-center whitespace-nowrap">{product.name}</td>
                      <td className="py-3 px-4 border-b border-gray-200 text-gray-800 text-center whitespace-nowrap">{product.stock}</td>
                      <td className="py-3 px-4 border-b border-gray-200 text-gray-800 text-center whitespace-nowrap">{product.price} FCFA</td>
                      <td className="py-3 px-4 border-b border-gray-200 text-gray-800 text-center whitespace-nowrap">
                        {(product.price * product.stock)} FCFA
                      </td>
                      <td className="py-3 px-4 border-b border-gray-200 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleEditClick(product)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
                        >
                          Modifier
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal d'édition */}
        {editingProduct && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 opacity-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Modifier le Produit</h2>
              <form onSubmit={handleFormSubmit}>
                <div className="mb-4">
                  <label htmlFor="name" className="block text-gray-700 text-sm font-bold mb-2">Nom du Produit:</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={editForm.name}
                    onChange={handleFormChange}
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">Description:</label>
                  <textarea
                    id="description"
                    name="description"
                    value={editForm.description}
                    onChange={handleFormChange}
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500 h-24 resize-y"
                  ></textarea>
                </div>
                <div className="mb-4">
                  <label htmlFor="category" className="block text-gray-700 text-sm font-bold mb-2">Catégorie:</label>
                  <input
                    type="text"
                    id="category"
                    name="category"
                    value={editForm.category}
                    onChange={handleFormChange}
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="price" className="block text-gray-700 text-sm font-bold mb-2">Prix:</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={editForm.price}
                    onChange={handleFormChange}
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    required
                    min="0"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="offerPrice" className="block text-gray-700 text-sm font-bold mb-2">Prix Offre (Optionnel):</label>
                  <input
                    type="number"
                    id="offerPrice"
                    name="offerPrice"
                    value={editForm.offerPrice}
                    onChange={handleFormChange}
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    min="0"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="stock" className="block text-gray-700 text-sm font-bold mb-2">Quantité en Stock:</label>
                  <input
                    type="number"
                    id="stock"
                    name="stock"
                    value={editForm.stock}
                    onChange={handleFormChange}
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    required
                    min="0"
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="imgUrl" className="block text-gray-700 text-sm font-bold mb-2">URL de l'Image:</label>
                  <input
                    type="text"
                    id="imgUrl"
                    name="imgUrl"
                    value={editForm.imgUrl}
                    onChange={handleFormChange}
                    className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-blue-500"
                    required
                  />
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="submit"
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
                  >
                    Enregistrer les modifications
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-300 ease-in-out transform hover:scale-105"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* L'affichage de la date et l'heure a été supprimé de cette page */}
      </div>
    </div>
  );
};

export default StockPage;
