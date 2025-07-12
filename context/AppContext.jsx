'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-toastify';

const AppContext = createContext(null); // Initialisation avec null pour éviter les erreurs de type

const formatPriceInFCFA = (price) => {
    if (typeof price !== 'number') {
        price = parseFloat(price);
    }
    if (isNaN(price)) {
        return "N/A";
    }
    return new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XOF' }).format(price);
};

export const AppProvider = ({ children }) => {
    const router = useRouter();
    const { data: session, status } = useSession();     

    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);
    const [errorProducts, setErrorProducts] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [cartItems, setCartItems] = useState({});
    const [loadingCart, setLoadingCart] = useState(true);     
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);     
    const [userOrders, setUserOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(true);     
    const [userAddresses, setUserAddresses] = useState([]);
    const [loadingAddresses, setLoadingAddresses] = useState(true);     
    const [currency, setCurrency] = useState('XOF');     
    const [deliveryFee, setDeliveryFee] = useState(0);

    const url = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const fetchProducts = useCallback(async () => {
        setLoadingProducts(true);
        setErrorProducts(null);
        try {
            const response = await axios.get(`${url}/api/products`);
            if (response.status === 200 && Array.isArray(response.data)) {
                const apiProducts = response.data.map(product => {
                    let parsedImgUrls = [];
                    if (product.imgUrl) {
                        try {
                            const parsed = JSON.parse(product.imgUrl);
                            parsedImgUrls = Array.isArray(parsed) ? parsed : [parsed];
                        } catch {
                            parsedImgUrls = [product.imgUrl];
                        }
                    }
                    return {
                        ...product,
                        id: product.id,
                        imgUrl: parsedImgUrls,
                        price: parseFloat(product.price),
                        offerPrice: product.offerPrice ? parseFloat(product.offerPrice) : null,
                        rating: product.rating || 4.5,
                        category: product.category || 'Non classé',
                        stock: product.stock || 0,
                        description: product.description || 'Description non disponible',
                    };
                });
                setProducts(apiProducts);
            } else {
                setErrorProducts("Format de données de produits inattendu ou API indisponible.");
                toast.error("Format de données de produits inattendu ou API indisponible.");
                setProducts([]);
            }
        } catch (error) {
            console.error("Erreur API produits:", error);
            setErrorProducts("Erreur de chargement des produits. Vérifiez votre connexion à la base de données.");
            toast.error("Erreur de chargement des produits.");
            setProducts([]);
        } finally {
            setLoadingProducts(false);
        }
    }, [url]);

    const loadCartData = useCallback(async () => {
        if (!isLoggedIn || !currentUser?.id) {
            const savedCart = localStorage.getItem('cartItems');
            setCartItems(savedCart ? JSON.parse(savedCart) : {});
            setLoadingCart(false);
            return;
        }
        setLoadingCart(true);
        try {
            const response = await axios.get(`${url}/api/cart/${currentUser.id}`);
            if (response.status === 200) {     
                const cartData = {};
                if (Array.isArray(response.data)) {
                    response.data.forEach(item => {
                        if (item.productId && item.quantity) {
                            cartData[item.productId] = item.quantity;
                        }
                    });
                } else {
                    console.warn("La réponse de l'API /api/cart/[userId] n'est pas un tableau:", response.data);
                    toast.error("Format de données de panier inattendu.");
                }
                setCartItems(cartData);
            } else {
                toast.error(`Échec du chargement du panier: ${response.status}`);
            }
        } catch (error) {
            console.error("Erreur chargement panier:", error);
            if (axios.isAxiosError(error) && error.response) {
                if (error.response.status === 401 || error.response.status === 403) {
                    toast.info("Session expirée, veuillez vous reconnecter.");
                    if (isLoggedIn) router.push('/login');     
                } else if (error.response.status === 404) {
                    toast.error("Endpoint du panier non trouvé. Veuillez vérifier la route API.");
                }
            } else {
                toast.error("Erreur lors du chargement du panier. Veuillez réessayer.");
            }
        } finally {
            setLoadingCart(false);
        }
    }, [url, isLoggedIn, currentUser?.id, router]);

    const addToCart = useCallback(async (productId) => {
        if (!isLoggedIn || !currentUser?.id) {
            toast.info("Connectez-vous pour ajouter au panier.");
            router.push('/login');
            return;
        }
        setCartItems(prev => {
            const newCart = { ...prev, [productId]: (prev[productId] || 0) + 1 };
            localStorage.setItem('cartItems', JSON.stringify(newCart));
            return newCart;
        });
        try {
            await axios.post(
                `${url}/api/cart/${currentUser.id}`,
                { productId, quantity: 1 }     
            );
            toast.success("Produit ajouté au panier.");
        } catch (error) {
            console.error("Erreur ajout panier:", error);
            setCartItems(prev => {
                const newCart = { ...prev };
                if (newCart[productId] <= 1) {
                    delete newCart[productId];
                } else {
                    newCart[productId] -= 1;
                }
                localStorage.setItem('cartItems', JSON.stringify(newCart));
                return newCart;
            });
            if (axios.isAxiosError(error) && error.response) {
                if (error.response.status === 401 || error.response.status === 403) {
                    toast.info("Session expirée, veuillez vous reconnecter.");
                    router.push('/login');
                } else if (error.response.status === 404) {
                    toast.error("Endpoint ou produit non trouvé pour l'ajout au panier.");
                } else {
                    toast.error("Erreur lors de l'ajout au panier.");
                }
            } else {
                toast.error("Erreur inattendue lors de l'ajout au panier.");
            }
        }
    }, [url, isLoggedIn, currentUser?.id, router]);

    const removeFromCart = useCallback(async (productId) => {
        const oldQuantity = cartItems[productId] || 0;
        if (oldQuantity === 0) return;
        setCartItems(prev => {
            const newCart = { ...prev };
            if (newCart[productId] > 1) {
                newCart[productId] -= 1;
            } else {
                delete newCart[productId];
            }
            localStorage.setItem('cartItems', JSON.stringify(newCart));
            return newCart;
        });
        if (isLoggedIn && currentUser?.id) {
            try {
                await axios.put(
                    `${url}/api/cart/${currentUser.id}`,
                    { productId, quantity: oldQuantity - 1 }     
                );
                toast.info("Quantité du produit ajustée.");
            } catch (error) {
                console.error("Erreur retrait panier:", error);
                toast.error("Erreur lors de la mise à jour du panier.");
                setCartItems(prev => ({     
                    ...prev,
                    [productId]: oldQuantity
                }));
                if (axios.isAxiosError(error) && error.response) {
                    if (error.response.status === 401 || error.response.status === 403) {
                        toast.info("Session expirée, veuillez vous reconnecter.");
                        router.push('/login');
                    }
                }
            }
        }
    }, [url, isLoggedIn, currentUser?.id, router, cartItems]);

    const deleteFromCart = useCallback(async (productId) => {
        const oldQuantity = cartItems[productId];
        setCartItems(prev => {
            const newCart = { ...prev };
            delete newCart[productId];
            localStorage.setItem('cartItems', JSON.stringify(newCart));
            return newCart;
        });
        if (isLoggedIn && currentUser?.id) {
            try {
                await axios.delete(`${url}/api/cart/${currentUser.id}`, {
                    data: { productId }     
                });
                toast.success("Produit retiré du panier.");
            } catch (error) {
                console.error("Erreur suppression panier:", error);
                toast.error("Erreur lors de la suppression du panier.");
                setCartItems(prev => ({     
                    ...prev,
                    [productId]: oldQuantity
                }));
                if (axios.isAxiosError(error) && error.response) {
                    if (error.response.status === 401 || error.response.status === 403) {
                        toast.info("Session expirée, veuillez vous reconnecter.");
                        router.push('/login');
                    }
                }
            }
        }
    }, [url, isLoggedIn, currentUser?.id, router, cartItems]);

    const updateCartQuantity = useCallback(async (productId, quantity) => {
        const oldQuantity = cartItems[productId] || 0;
        setCartItems(prev => {
            const newCart = { ...prev };
            if (quantity <= 0) {
                delete newCart[productId];
            } else {
                newCart[productId] = quantity;
            }
            localStorage.setItem('cartItems', JSON.stringify(newCart));
            return newCart;
        });
        if (isLoggedIn && currentUser?.id) {
            try {
                await axios.put(
                    `${url}/api/cart/${currentUser.id}`,
                    { productId, quantity }     
                );
                toast.success("Quantité du produit mise à jour !");
            } catch (error) {
                console.error("Erreur lors de la mise à jour de la quantité du panier:", error);
                toast.error("Erreur lors de la mise à jour du panier.");
                // Revert to old quantity on error
                setCartItems(prev => ({     
                    ...prev,
                    [productId]: oldQuantity
                }));
                if (axios.isAxiosError(error) && error.response) {
                    if (error.response.status === 401 || error.response.status === 403) {
                        toast.info("Session expirée, veuillez vous reconnecter.");
                        router.push('/login');
                    }
                }
            }
        }
    }, [url, isLoggedIn, currentUser?.id, router, cartItems]); // Added cartItems to dependency array

    const getCartCount = useCallback(() => {
        return Object.values(cartItems).reduce((sum, quantity) => sum + quantity, 0);
    }, [cartItems]);

    const getCartAmount = useCallback(() => {
        return Object.entries(cartItems).reduce((total, [productId, quantity]) => {
            const product = products.find(p => String(p.id) === String(productId));
            if (product) {
                const price = product.offerPrice !== null ? product.offerPrice : product.price;
                return total + (price * quantity);
            }
            return total;
        }, 0);
    }, [cartItems, products]);

    const fetchUserOrders = useCallback(async () => {
        console.log("fetchUserOrders called. isLoggedIn:", isLoggedIn, "currentUser:", currentUser);
        if (!isLoggedIn || !currentUser?.id) {
            setLoadingOrders(false);
            setUserOrders([]);
            return;
        }
        setLoadingOrders(true);
        try {
            console.log(`Fetching orders from /api/user/orders for user: ${currentUser.id}`);
            // CORRECTION 1: Modifier l'URL de l'API pour correspondre à la nouvelle route
            const response = await axios.get(`${url}/api/user/orders`); 
            
            console.log("Orders API response:", response.data);
            if (response.status === 200 && Array.isArray(response.data)) {
                // CORRECTION 2: Les articles (items) sont déjà parsés par la nouvelle API,
                // ils ne sont plus sous 'order_items' et n'ont plus besoin de JSON.parse.
                // La nouvelle API retourne directement un tableau d'objets `items`.
                const ordersWithItems = response.data.map(order => ({
                    ...order,
                    // Utilisez 'order.items' car la nouvelle API les pré-parse
                    items: order.items || [] 
                }));
                setUserOrders(ordersWithItems);
            } else {
                toast.error("Format de données de commandes inattendu.");
                setUserOrders([]);
            }
        } catch (error) {
            console.error("Erreur chargement commandes:", error);
            if (axios.isAxiosError(error) && error.response) {
                if (error.response.status === 404) {
                    toast.info("Aucune commande trouvée pour cet utilisateur.");
                    setUserOrders([]);
                } else if (error.response.status === 401 || error.response.status === 403) {
                    toast.info("Session expirée lors du chargement des commandes, veuillez vous reconnecter.");
                    router.push('/login');
                } else {
                    toast.error("Erreur lors du chargement des commandes.");
                }
            } else {
                toast.error("Erreur inattendue lors du chargement des commandes.");
            }
            setUserOrders([]);
        } finally {
            setLoadingOrders(false);
        }
    }, [url, isLoggedIn, currentUser?.id, router]);

    const fetchUserAddresses = useCallback(async () => {
        if (!isLoggedIn || !currentUser?.id) {
            setLoadingAddresses(false);
            setUserAddresses([]);
            return;
        }
        setLoadingAddresses(true);
        try {
            const response = await axios.get(`${url}/api/addresses/${currentUser.id}`);
            if (response.status === 200 && Array.isArray(response.data)) {
                setUserAddresses(response.data);
            } else {
                toast.error("Format de données d'adresses inattendu.");
                setUserAddresses([]);
            }
        } catch (error) {
            console.error("Erreur chargement adresses:", error);
            if (axios.isAxiosError(error) && error.response) {
                if (error.response.status === 404) {
                    toast.info("Aucune adresse trouvée pour cet utilisateur.");
                    setUserAddresses([]);
                } else if (error.response.status === 401 || error.response.status === 403) {
                    toast.info("Session expirée lors du chargement des adresses, veuillez vous reconnecter.");
                    router.push('/login');
                } else {
                    toast.error("Erreur lors du chargement des adresses.");
                }
            } else {
                toast.error("Erreur inattendue lors du chargement des adresses.");
            }
            setUserAddresses([]);
        } finally {
            setLoadingAddresses(false);
        }
    }, [url, isLoggedIn, currentUser?.id, router]);

    // Initial data fetches
    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    // Authentication and user data fetching
    useEffect(() => {
        if (status === 'authenticated') {
            console.log("AppContext: User authenticated, fetching user specific data.", session.user.id);
            setCurrentUser(session.user);
            setIsLoggedIn(true);
        } else if (status === 'unauthenticated') {
            console.log("AppContext: User unauthenticated.");
            setCurrentUser(null);
            setIsLoggedIn(false);
            const savedCart = localStorage.getItem('cartItems');
            setCartItems(savedCart ? JSON.parse(savedCart) : {});
            setLoadingCart(false);
        }
    }, [status, session]);

    // Fetch user-specific data when currentUser and isLoggedIn change
    useEffect(() => {
        if (isLoggedIn && currentUser?.id) {
            loadCartData();
            fetchUserOrders();
            fetchUserAddresses();
        }
    }, [isLoggedIn, currentUser?.id, loadCartData, fetchUserOrders, fetchUserAddresses]);


    // Filter products when search term or category changes
    useEffect(() => {
        let currentFiltered = products;
        if (selectedCategory && selectedCategory !== 'All') {
            currentFiltered = currentFiltered.filter(product =>
                product.category.toLowerCase() === selectedCategory.toLowerCase()
            );
        }
        if (searchTerm) {
            currentFiltered = currentFiltered.filter(product =>
                product.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        setFilteredProducts(currentFiltered);
    }, [products, searchTerm, selectedCategory]);


    const contextValue = {
        products,
        loadingProducts,
        errorProducts,
        searchTerm,
        setSearchTerm,
        selectedCategory,
        setSelectedCategory,
        filteredProducts,
        cartItems,
        addToCart,
        removeFromCart,
        deleteFromCart,
        updateCartQuantity,
        getCartCount,
        getCartAmount,
        currency,
        formatPriceInFCFA,
        url,
        currentUser,
        setCurrentUser, 
        isLoggedIn,
        userOrders,
        loadingOrders,
        fetchUserOrders,
        userAddresses,
        loadingAddresses,
        fetchUserAddresses,
        router,
        deliveryFee,
        setDeliveryFee,
        loadCartData 
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    return useContext(AppContext);
};