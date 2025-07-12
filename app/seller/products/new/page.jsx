'use client';

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import Loading from '@/components/Loading'; // Assurez-vous que ce composant existe
import { ArrowLeft } from 'lucide-react'; // Icône de retour

// Définition des couleurs pour une cohérence UI
const ACCENT_COLOR = '#4F46E5'; // Bleu-violet
const NEUTRAL_COLOR_LIGHT = '#F8FAFC'; // Arrière-plan clair
const NEUTRAL_COLOR_DARK_TEXT = '#1F2937'; // Texte sombre principal
const TEXT_COLOR_DEFAULT = '#374151'; // Texte par défaut
const BORDER_COLOR = '#E5E7EB'; // Couleur des bordures et séparateurs

const NewProductPage = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    sku: '', // Référence
    description: '',
    price: '',
    stock: '', // Stock initial
    category: '', // Famille
    imgUrl: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/seller/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price), // Convertir en nombre
          stock: parseInt(formData.stock, 10), // Convertir en entier
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success('Produit enregistré avec succès !');
        router.push('/seller/stocks'); // Rediriger vers la page de gestion des stocks
      } else {
        toast.error(data.message || 'Erreur lors de l\'enregistrement du produit.');
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement du produit:', error);
      toast.error('Impossible d\'enregistrer le produit.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center" style={{ backgroundColor: NEUTRAL_COLOR_LIGHT }}>
        <Loading />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: NEUTRAL_COLOR_LIGHT }}>
      <main className="flex-1 p-6 md:p-10">
        <div className="max-w-4xl mx-auto bg-white rounded-xl p-8 shadow-lg border" style={{ borderColor: BORDER_COLOR }}>
          <button
            onClick={() => router.back()}
            className="mb-6 inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour
          </button>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-8 text-center" style={{ color: NEUTRAL_COLOR_DARK_TEXT }}>
            Enregistrer un Nouveau Produit
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                Nom du Produit
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                style={{ borderColor: BORDER_COLOR, focusRingColor: ACCENT_COLOR }}
              />
            </div>
            <div>
              <label htmlFor="sku" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                Référence (SKU)
              </label>
              <input
                type="text"
                id="sku"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                required
                className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                style={{ borderColor: BORDER_COLOR, focusRingColor: ACCENT_COLOR }}
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                style={{ borderColor: BORDER_COLOR, focusRingColor: ACCENT_COLOR }}
              ></textarea>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="price" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                  Prix (XOF)
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  required
                  className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  style={{ borderColor: BORDER_COLOR, focusRingColor: ACCENT_COLOR }}
                />
              </div>
              <div>
                <label htmlFor="stock" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                  Stock Initial
                </label>
                <input
                  type="number"
                  id="stock"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  min="0"
                  required
                  className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  style={{ borderColor: BORDER_COLOR, focusRingColor: ACCENT_COLOR }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                Famille (Catégorie)
              </label>
              <input
                type="text"
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                style={{ borderColor: BORDER_COLOR, focusRingColor: ACCENT_COLOR }}
              />
            </div>
            <div>
              <label htmlFor="imgUrl" className="block text-sm font-medium" style={{ color: TEXT_COLOR_DEFAULT }}>
                URL de l'Image du Produit
              </label>
              <input
                type="url"
                id="imgUrl"
                name="imgUrl"
                value={formData.imgUrl}
                onChange={handleChange}
                className="mt-1 block w-full border rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                style={{ borderColor: BORDER_COLOR, focusRingColor: ACCENT_COLOR }}
              />
            </div>
            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                style={{ backgroundColor: ACCENT_COLOR, hoverBackgroundColor: 'darken(' + ACCENT_COLOR + ', 10%)' }}
                disabled={loading}
              >
                {loading ? 'Enregistrement...' : 'Enregistrer le Produit'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default NewProductPage;