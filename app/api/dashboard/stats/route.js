// app/api/dashboard/stats/route.js
import { NextResponse } from 'next/server';
import pool from '../../../../lib/db'; // Ajustez ce chemin si nécessaire
// import { getServerSession } from 'next-auth'; // Nécessaire si vous voulez protéger cette API
// import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Assurez-vous que le chemin est correct

export async function GET() {
    let connection;
    try {
        // Obtenez une connexion à la base de données
        connection = await pool.getConnection();

        // 1. Statistiques générales
        const [productsCountResult] = await connection.execute('SELECT COUNT(id) AS totalProducts FROM products');
        const totalProducts = productsCountResult[0].totalProducts;

        const [ordersCountResult] = await connection.execute('SELECT COUNT(id) AS totalOrders FROM orders');
        const totalOrders = ordersCountResult[0].totalOrders;

        const [pendingOrdersResult] = await connection.execute(`SELECT COUNT(id) AS pendingOrders FROM orders WHERE status = 'PENDING'`);
        const pendingOrders = pendingOrdersResult[0].pendingOrders;

        // Revenu total (somme des totalAmount des commandes COMPLETED)
        const [revenueResult] = await connection.execute('SELECT SUM(totalAmount) AS totalRevenue FROM orders WHERE status = "COMPLETED"');
        const totalRevenue = revenueResult[0].totalRevenue || 0; // Utiliser 0 si NULL

        const [usersCountResult] = await connection.execute('SELECT COUNT(id) AS totalUsers FROM users');
        const totalUsers = usersCountResult[0].totalUsers;

        // 2. Dernières commandes (pour le tableau des commandes récentes)
        const [recentOrdersResult] = await connection.execute(
            `SELECT
                o.id AS orderId,
                CONCAT(u.firstName, ' ', u.lastName) AS customerName,
                u.email AS customerEmail,
                o.totalAmount,
                o.status AS orderStatus,
                o.paymentStatus,
                o.orderDate
            FROM
                orders o
            JOIN
                users u ON o.userId = u.id
            ORDER BY
                o.orderDate DESC
            LIMIT 15`
        );
        const recentOrders = recentOrdersResult;

        // --- Données pour les diagrammes par mois ---

        // 3. Nombre de commandes par mois (pour les 6 derniers mois)
        const [ordersPerMonthResult] = await connection.execute(
            `SELECT
                DATE_FORMAT(orderDate, '%Y-%m') AS month,
                COUNT(id) AS orderCount
            FROM
                orders
            WHERE
                orderDate >= CURDATE() - INTERVAL 6 MONTH
            GROUP BY
                month
            ORDER BY
                month ASC`
        );

        // 4. Revenu total par mois (pour les 6 derniers mois)
        const [revenuePerMonthResult] = await connection.execute(
            `SELECT
                DATE_FORMAT(orderDate, '%Y-%m') AS month,
                SUM(totalAmount) AS totalMonthlyRevenue
            FROM
                orders
            WHERE
                status = 'COMPLETED' AND orderDate >= CURDATE() - INTERVAL 6 MONTH
            GROUP BY
                month
            ORDER BY
                month ASC`
        );

        // Retournez les données en tant que réponse JSON
        return NextResponse.json({
            success: true,
            totalProducts,
            totalOrders,
            pendingOrders,
            totalRevenue,
            totalUsers,
            recentOrders,
            ordersPerMonth: ordersPerMonthResult,
            revenuePerMonth: revenuePerMonthResult,
            message: "Dashboard stats fetched successfully."
        }, { status: 200 });

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        // En cas d'erreur, retournez une réponse d'erreur appropriée
        return NextResponse.json({ success: false, message: `Server error fetching dashboard stats: ${error.message}` }, { status: 500 });
    } finally {
        // Assurez-vous de relâcher la connexion à la base de données
        if (connection) connection.release();
    }
}