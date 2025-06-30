import { Language, TransferOption } from '../types';

export const invoiceLabels: Record<Language, Record<string, string>> = {
  es: {
    invoiceTitle: 'Factura electrónica de venta',
    issuerData: 'Datos del Emisor',
    clientData: 'Datos del Cliente',
    issueDate: 'Fecha de emisión',
    dueDate: 'Fecha de vencimiento',
    item: 'Ítem',
    description: 'Descripción',
    quantity: 'Cantidad',
    unitPrice: 'Precio Unitario',
    total: 'Vr. Total',
    amountInWords: 'Valor en Letras',
    paymentTerms: 'Condiciones de Pago',
    observations: 'Observaciones',
    transferData: 'Datos para la transferencia',
    bankName: 'Nombre del Banco',
    bankAddress: 'Dirección del Banco',
    country: 'País',
    swiftCode: 'Código Swift Banco',
    accountOwner: 'Nombre completo del dueño de la cuenta',
    accountNumber: 'Numero de Cuenta y tipo',
    address: 'Dirección',
    totalToPay: 'Total a Pagar',
    paymentMethod: 'Forma de pago',
    footer: 'A esta factura de venta aplican las normas relativas a la letra de cambio (artículo 5 Ley 1231 de 2008). Con esta el Comprador declara haber recibido real y materialmente las mercancías o prestación de servicios descritos en este título - Valor. Número Autorización Electrónica 18764067937482 aprobado en 20240326 prefijo LP desde el número 51 al 199 Vigencia: 24 Meses - Actividad Económica Tarifa',
    accountOwnerAddress: 'Dirección del titular',
    routingNumber: 'Número de ruta',
    abaCode: 'Código ABA',
    transferOption: 'Opción de Transferencia',
  },
  en: {
    invoiceTitle: 'Electronic Sales Invoice',
    issuerData: 'Issuer Data',
    clientData: 'Client Data',
    issueDate: 'Issue Date',
    dueDate: 'Due Date',
    item: 'Item',
    description: 'Description',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    total: 'Total',
    amountInWords: 'Amount in Words',
    paymentTerms: 'Payment Terms',
    observations: 'Observations',
    transferData: 'Transfer Data',
    bankName: 'Bank Name',
    bankAddress: 'Bank Address',
    country: 'Country',
    swiftCode: 'Bank Swift Code',
    accountOwner: 'Full name of account owner',
    accountNumber: 'Account Number and type',
    address: 'Address',
    totalToPay: 'Total to Pay',
    paymentMethod: 'Payment Method',
    footer: 'This sales invoice is subject to the regulations related to bills of exchange (Article 5 Law 1231 of 2008). With this, the Buyer declares to have received the goods or services described in this title - Value. Electronic Authorization Number 18764067937482 approved on 20240326 prefix LP from number 51 to 199 Validity: 24 Months - Economic Activity Rate',
    accountOwnerAddress: 'Account owner address',
    routingNumber: 'Routing Number',
    abaCode: 'ABA Code',
    transferOption: 'Transfer Option',
  }
};

export const transferOptions: Record<TransferOption, {
  name: string;
  bankName: string;
  bankAddress: string;
  country: string;
  swiftCode: string;
  accountOwner: string;
  accountNumber: {
    es: string;
    en: string;
  };
  accountOwnerAddress: string;
  routingNumber?: string;
  abaCode?: string;
}> = {
  usa: {
    name: 'Bank of America (USA)',
    bankName: 'Bank of America',
    bankAddress: '222 Broadway New York, New York 10038',
    country: 'USA',
    swiftCode: 'BOFAUS3N',
    accountOwner: 'LUIS ORLANDO MAURY SANCHEZ',
    accountNumber: {
      es: 'Cuenta corriente No. 8980 2253 0922',
      en: 'Checking account No. 8980 2253 0922'
    },
    accountOwnerAddress: '12019 Suellen Circle, Wellington, FL, USA 33414',
    routingNumber: '026009593',
  },
  panama: {
    name: 'Banco Davivienda Panamá',
    bankName: 'Banco Davivienda Panamá',
    bankAddress: 'Av Balboa y Calle 47 Trr Davivienda, Panamá City, Panamá',
    country: 'Panamá',
    swiftCode: 'DAVPPAPAXXX',
    accountOwner: 'LUIS ORLANDO MAURY SANCHEZ',
    accountNumber: {
      es: 'Cuenta de Ahorros No. 010991023131',
      en: 'Savings account No. 010991023131'
    },
    accountOwnerAddress: 'Carrera 6 14-37 Mosquera, Cundinamarca, Colombia',
  },
  colombia: {
    name: 'Banco Davivienda Colombia',
    bankName: 'Banco Davivienda',
    bankAddress: 'Av. El dorado No. 68 C 61 Bogotá-Colombia',
    country: 'Colombia',
    swiftCode: 'CAFECOBBXXX',
    accountOwner: 'LUIS ORLANDO MAURY SANCHEZ',
    accountNumber: {
      es: 'Cuenta de Ahorros No. 010991023131',
      en: 'Savings account No. 010991023131'
    },
    accountOwnerAddress: 'Carrera 6 14-37 Mosquera, Cundinamarca, Colombia',
    abaCode: '026009593',
  }
};

// Mantener compatibilidad con el código existente
export const invoiceFixedValues = transferOptions.usa;