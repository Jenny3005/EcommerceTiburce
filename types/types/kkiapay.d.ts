// types/kkiapay.d.ts
// Déclaration du composant personnalisé Kkiapay pour TypeScript

declare global {
  interface Window {
    openKkiapayWidget: (options: KkiapayOptions) => void;
    addSuccessListener: (callback: (response: KkiapaySuccessResponse) => void) => void;
    addFailedListener: (callback: (error: KkiapayErrorResponse) => void) => void;
  }

  namespace JSX {
    interface IntrinsicElements {
      'kkiapay-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        amount?: number;
        api_key?: string;
        callback?: string;
        transaction_id?: string;
        email?: string;
        phone?: string;
        position?: 'center' | 'bottom';
        sandbox?: boolean;
        data?: string; // Ajouté pour le passage de données personnalisées
        theme?: string;
        paymentmethod?: 'momo' | 'card';
        name?: string;
      };
    }
  }
}

export {};

// Interfaces pour les options et réponses de Kkiapay (répétées ici pour la clarté, mais devraient être dans un fichier dédié si possible)
interface KkiapayOptions {
  amount: number;
  api_key: string;
  callback?: string;
  transaction_id?: string;
  email?: string;
  phone?: string;
  position?: "left" | "right" | "center";
  sandbox?: "true" | "false" | boolean; // Peut être boolean
  data?: string;
  theme?: string;
  paymentmethod?: "momo" | "card";
  name?: string;
}

interface KkiapaySuccessResponse {
  transactionId: string;
  data?: string;
  // Autres champs que Kkiapay pourrait renvoyer en cas de succès
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
