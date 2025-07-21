// app/api/users/reinitialiser-mot-de-passe/route.js
import { NextResponse } from 'next/server';
import pool from '../../../../lib/db'; // Ajuster le chemin si nécessaire
import bcrypt from 'bcryptjs';

export async function POST(req) {
  let connection;
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ message: 'Le jeton et le nouveau mot de passe sont requis.' }, { status: 400 });
    }

    if (newPassword.length < 6) { // Exemple : imposer une longueur minimale de mot de passe
        return NextResponse.json({ message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' }, { status: 400 });
    }

    connection = await pool.getConnection();

    // 1. Trouver l'utilisateur par le jeton et vérifier son expiration
    const [users] = await connection.execute(
      'SELECT id, resetPasswordExpires FROM users WHERE resetPasswordToken = ?',
      [token]
    );
    const user = users[0];

    if (!user) {
      return NextResponse.json({ message: 'Jeton invalide ou expiré.' }, { status: 400 });
    }

    // 2. Vérifier si le jeton a expiré
    // Les dates MySQL sont parfois récupérées sous forme de chaînes, assurez-vous de les convertir en objets Date
    const expiresAt = new Date(user.resetPasswordExpires);
    if (new Date() > expiresAt) {
      // Nettoyer le jeton même s'il a expiré naturellement
      await connection.execute('UPDATE users SET resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?', [user.id]);
      return NextResponse.json({ message: 'Jeton invalide ou expiré.' }, { status: 400 });
    }

    // 3. Hacher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4. Mettre à jour le mot de passe de l'utilisateur et nettoyer les champs du jeton
    await connection.execute(
      'UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    return NextResponse.json({ message: 'Votre mot de passe a été réinitialisé avec succès.' }, { status: 200 });
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe:', error);
    return NextResponse.json({ message: 'Erreur interne du serveur.', error: error.message }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}