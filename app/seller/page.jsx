'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import Loading from '@/components/Loading';
import Link from 'next/link';
import {
    Package,
    ShoppingCart,
    Users,
    DollarSign,
    ArrowRight,
} from 'lucide-react';

// Importez les composants de Chart.js
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    LineElement,
    PointElement,
    ArcElement, // Pour le diagramme circulaire
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Enregistrez les composants Chart.js nécessaires
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    LineElement,
    PointElement,
    ArcElement
);

import { useAppContext } from '@/context/AppContext';

// --- PALETTE DE COULEURS ET VARIABLES DE STYLE ---
const ACCENT_COLOR = '#4F46E5';
const SECONDARY_ACCENT_COLOR = '#10B981';
const NEUTRAL_COLOR_LIGHT = '#F8FAFC';
const NEUTRAL_COLOR_DARK_TEXT = '#1F2937';
const TEXT_COLOR_DEFAULT = '#374151';
const TEXT_COLOR_LIGHT = '#6B7280';
const BORDER_COLOR = '#E5E7EB';

// Couleurs supplémentaires pour le diagramme circulaire
const PIE_CHART_COLORS = [
    '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#A855F7', '#14B8A6', '#6366F1'
];


// --- COMPOSANT STAT CARD ---
const StatCard = ({
    title,
    value,
    icon: Icon,
    description,
    linkHref,
    linkText,
    accentColor,
}) => (
    <div
        className="rounded-xl shadow-lg p-6 border flex flex-col justify-between transition-transform duration-300 hover:scale-[1.02]"
        style={{
            backgroundColor: 'white',
            borderColor: BORDER_COLOR,
            minHeight: '220px',
        }}
    >
        <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
                {Icon && <Icon className="h-7 w-7" style={{ color: accentColor }} />}
                <h3 className="text-xl font-semibold break-words" style={{ color: TEXT_COLOR_DEFAULT }}>{title}</h3>
            </div>
            <span className="text-3xl font-extrabold flex-shrink-0" style={{ color: NEUTRAL_COLOR_DARK_TEXT }}>{value}</span>
        </div>
        <p className="text-sm mb-5 text-balance" style={{ color: TEXT_COLOR_LIGHT }}>{description}</p>
        {linkHref && linkText && (
            <Link
                href={linkHref}
                className="inline-flex items-center text-sm font-medium group transition-colors duration-200 mt-auto"
                style={{ color: accentColor }}
            >
                {linkText}
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
        )}
    </div>
);

// --- COMPOSANT CHART CARD ---
const ChartCard = ({ title, subtitle, children }) => (
    <div className="bg-white rounded-xl p-8 shadow-lg border h-full" style={{ borderColor: BORDER_COLOR }}>
        <h3 className="text-2xl font-bold mb-2" style={{ color: TEXT_COLOR_DEFAULT }}>{title}</h3>
        <p className="text-sm mb-6" style={{ color: TEXT_COLOR_LIGHT }}>{subtitle}</p>
        <div className="flex justify-center items-center h-[300px]">
            {children}
        </div>
    </div>
);

// --- COMPOSANT SELLER DASHBOARD ---
const SellerDashboard = () => {
    const { formatPriceInFCFA } = useAppContext();
    const [stats, setStats] = useState({
        totalProducts: 0,
        totalOrders: 0,
        totalRevenue: 0,
        totalUsers: 0,
        recentOrders: [],
        ordersPerMonth: [],
        revenuePerMonth: [],
    });
    const [loading, setLoading] = useState(true);

    // Helper pour générer les N derniers mois
    const generateLastNMonths = (n) => {
        const months = [];
        const today = new Date();
        for (let i = 0; i < n; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0'); // Mois sur 2 chiffres
            months.unshift(`${year}-${month}`); // Ajouter au début pour avoir les mois dans l'ordre croissant
        }
        return months;
    };

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/dashboard/stats');
                const data = await res.json();

                if (res.ok && data.success) {
                    const last6Months = generateLastNMonths(6);

                    // Mapper les données des commandes sur les mois par défaut
                    const mappedOrdersPerMonth = last6Months.map(month => {
                        const found = data.ordersPerMonth.find(item => item.month === month);
                        return { month: month, orderCount: found ? found.orderCount : 0 };
                    });

                    // Mapper les données de revenus sur les mois par défaut, en arrondissant à l'entier
                    const mappedRevenuePerMonth = last6Months.map(month => {
                        const found = data.revenuePerMonth.find(item => item.month === month);
                        return { month: month, totalMonthlyRevenue: found ? Math.round(found.totalMonthlyRevenue) : 0 };
                    });


                    setStats({
                        totalProducts: data.totalProducts || 0,
                        totalOrders: data.totalOrders || 0,
                        totalRevenue: data.totalRevenue || 0,
                        totalUsers: data.totalUsers || 0,
                        recentOrders: data.recentOrders || [],
                        ordersPerMonth: mappedOrdersPerMonth,
                        revenuePerMonth: mappedRevenuePerMonth,
                    });
                } else {
                    toast.error(data.message || 'Erreur lors du chargement des statistiques.');
                }
            } catch (error) {
                console.error('Erreur fetch stats:', error);
                toast.error('Impossible de récupérer les statistiques du tableau de bord.');
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex-1 min-h-screen flex items-center justify-center" style={{ backgroundColor: NEUTRAL_COLOR_LIGHT }}>
                <Loading />
            </div>
        );
    }

    // --- Préparation des données pour le diagramme des commandes par mois (Bar Chart) ---
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const ordersChartLabels = stats.ordersPerMonth.map(item => {
        const [year, monthNum] = item.month.split('-');
        return `${monthNames[parseInt(monthNum, 10) - 1]} ${year.slice(2)}`;
    });
    const ordersChartData = stats.ordersPerMonth.map(item => item.orderCount);

    const ordersChartConfig = {
        labels: ordersChartLabels,
        datasets: [
            {
                label: 'Nombre de Commandes',
                data: ordersChartData,
                backgroundColor: ACCENT_COLOR,
                borderColor: ACCENT_COLOR,
                borderWidth: 1,
            },
        ],
    };

    const ordersChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: TEXT_COLOR_DEFAULT
                }
            },
            title: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y + ' commandes';
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                ticks: { color: TEXT_COLOR_LIGHT },
                grid: { color: BORDER_COLOR },
                title: {
                    display: true,
                    text: 'Mois',
                    color: TEXT_COLOR_DEFAULT
                }
            },
            y: {
                ticks: {
                    color: TEXT_COLOR_LIGHT,
                    stepSize: 1
                },
                grid: { color: BORDER_COLOR },
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Nombre de Commandes',
                    color: TEXT_COLOR_DEFAULT
                }
            }
        }
    };

    // --- Préparation des données pour le diagramme des revenus par mois (Pie Chart) ---
    const revenuePieLabels = stats.revenuePerMonth.map(item => {
        const [year, monthNum] = item.month.split('-');
        return `${monthNames[parseInt(monthNum, 10) - 1]} ${year.slice(2)}`;
    });
    const revenuePieData = stats.revenuePerMonth.map(item => item.totalMonthlyRevenue);

    // Filtrer les données pour le graphique circulaire pour n'inclure que les mois avec des revenus > 0
    // afin d'éviter un graphique vide si toutes les valeurs sont 0
    const filteredRevenueData = revenuePieData.filter(value => value > 0);
    const filteredRevenueLabels = revenuePieLabels.filter((_, index) => revenuePieData[index] > 0);
    // Assurez-vous d'avoir suffisamment de couleurs si vous avez beaucoup de mois avec des revenus
    const filteredRevenueColors = PIE_CHART_COLORS.slice(0, filteredRevenueLabels.length);


    const revenuePieConfig = {
        labels: filteredRevenueLabels,
        datasets: [
            {
                label: 'Revenu Total',
                data: filteredRevenueData,
                backgroundColor: filteredRevenueColors,
                borderColor: 'white',
                borderWidth: 2,
            },
        ],
    };

    const revenuePieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    color: TEXT_COLOR_DEFAULT
                }
            },
            title: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed !== null) {
                            label += formatPriceInFCFA(Math.round(context.parsed));
                        }
                        return label;
                    }
                }
            }
        },
    };


    return (
        <div className="flex flex-col min-h-screen" style={{ backgroundColor: NEUTRAL_COLOR_LIGHT }}>
            <main className="flex-1 p-6 md:p-10">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-12" style={{ color: NEUTRAL_COLOR_DARK_TEXT }}>
                        Rapport Admin
                    </h1>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mb-12">
                        <StatCard
                            title="Total Produits"
                            value={stats.totalProducts}
                            icon={Package}
                            description="Nombre total de produits actifs."
                            linkHref="/seller/product-list"
                            linkText="Gérer les produits"
                            accentColor={ACCENT_COLOR}
                        />
                        <StatCard
                            title="Total Commandes"
                            value={stats.totalOrders}
                            icon={ShoppingCart}
                            description="Nombre total de commandes effectuées."
                            linkHref="/seller/orders"
                            linkText="Voir les commandes"
                            accentColor={ACCENT_COLOR}
                        />
                        <StatCard
                            title="Revenu Total"
                            value={formatPriceInFCFA(stats.totalRevenue)}
                            icon={DollarSign}
                            description="Revenu généré par vos ventes."
                            accentColor={SECONDARY_ACCENT_COLOR}
                        />
                        <StatCard
                            title="Utilisateurs Enregistrés"
                            value={stats.totalUsers}
                            icon={Users}
                            description="Nombre de clients enregistrés."
                            linkHref="/seller/users"
                            linkText="Voir les utilisateurs"
                            accentColor={ACCENT_COLOR}
                        />
                    </div>

                    {/* NOUVEAUX CADRES POUR LES DIAGRAMMES */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                        <ChartCard
                            title="Commandes par Mois"
                            subtitle="Vue d'ensemble du nombre de commandes sur les 6 derniers mois."
                        >
                            <Bar options={ordersChartOptions} data={ordersChartConfig} />
                        </ChartCard>

                        <ChartCard
                            title="Revenu Total par Mois"
                            subtitle="Distribution du revenu total par mois sur les 6 derniers mois."
                        >
                            {/* Afficher le Pie Chart uniquement s'il y a des données de revenus non nulles */}
                            {filteredRevenueData.length > 0 ? (
                                <Pie options={revenuePieOptions} data={revenuePieConfig} />
                            ) : (
                                <p className="text-base font-medium text-center" style={{ color: TEXT_COLOR_LIGHT }}>
                                    Aucun revenu enregistré pour les 6 derniers mois.
                                </p>
                            )}
                        </ChartCard>
                    </div>

                    {/* SECTION COMMANDES RÉCENTES (existante) */}
                    <div className="bg-white rounded-xl p-8 shadow-lg border" style={{ borderColor: BORDER_COLOR }}>
                        <h3 className="text-2xl font-bold mb-6" style={{ color: TEXT_COLOR_DEFAULT }}>
                            Commandes Récentes
                        </h3>
                        {stats.recentOrders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Numéro de Commande
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Nom de l'utilisateur
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Email
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Montant Commande
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Statut Paiement
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {stats.recentOrders.map((order) => (
                                            <tr key={order.orderId}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {order.orderId}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {order.customerName || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {order.customerEmail || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {formatPriceInFCFA(order.totalAmount)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        order.paymentStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                        order.paymentStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {order.paymentStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                    {new Date(order.orderDate).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-base font-medium" style={{ color: TEXT_COLOR_LIGHT }}>
                                Aucune commande récente pour le moment.
                            </p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SellerDashboard;