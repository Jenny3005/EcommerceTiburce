// app/api/users/mot-de-passe-oublie/route.js
import { NextResponse } from 'next/server';
import pool from '../../../../lib/db'; // Ajuster le chemin si nécessaire
import crypto from 'crypto';
import nodemailer from 'nodemailer'; // Ou votre bibliothèque d'envoi d'e-mails préférée

// Configurez votre transporteur d'e-mails (exemple avec Nodemailer et Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Votre adresse e-mail Gmail
    pass: process.env.EMAIL_PASS, // Votre mot de passe d'application Gmail ou mot de passe réel (utiliser le mot de passe d'application pour la sécurité)
  },
});

export async function POST(req) {
  let connection;
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: 'L\'email est requis.' }, { status: 400 });
    }

    connection = await pool.getConnection();

    // 1. Trouver l'utilisateur par e-mail
    const [users] = await connection.execute('SELECT id, firstName FROM users WHERE email = ?', [email]);
    const user = users[0];

    if (!user) {
      // Pour des raisons de sécurité, ne révélez pas si l'e-mail existe ou non.
      // Envoyez toujours un message de succès, mais n'envoyez pas d'e-mail si l'utilisateur n'existe pas.
      return NextResponse.json({ message: 'Si un compte associé à cet email existe, un lien de réinitialisation de mot de passe a été envoyé.' }, { status: 200 });
    }

    // 2. Générer un jeton unique et définir le temps d'expiration (15 minutes)
    const resetToken = crypto.randomBytes(32).toString('hex'); // 32 octets pour une chaîne hexadécimale de 64 caractères
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // Jeton valide pour 15 minutes (15 * 60 * 1000 millisecondes)

    // 3. Stocker le jeton et son expiration dans la table `users`
    await connection.execute(
      'UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE id = ?',
      [resetToken, expiresAt, user.id]
    );

    // 4. Envoyer l'e-mail de réinitialisation du mot de passe
    const resetLink = `${process.env.NEXT_PUBLIC_BASE_URL}/reinitialiser-mot-de-passe?token=${resetToken}`; // L'URL de votre page de réinitialisation de mot de passe frontend

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <p>Bonjour ${user.firstName},</p>
        <p>Vous avez demandé une réinitialisation de votre mot de passe. Veuillez cliquer sur le lien ci-dessous pour réinitialiser votre mot de passe :</p>
        <p><a href="${resetLink}">Réinitialiser mon mot de passe</a></p>
        <p>Ce lien expirera dans 15 minutes.</p>
        <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet e-mail.</p>
      `,
    });

    return NextResponse.json(
      { message: 'Si un compte associé à cet email existe, un lien de réinitialisation de mot de passe a été envoyé.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur lors de la demande de réinitialisation du mot de passe:', error);
    return NextResponse.json({ message: 'Erreur interne du serveur.', error: error.message }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}