import dotenv from 'dotenv';
dotenv.config();

export const mpesaConfig = {
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  passkey: process.env.MPESA_PASSKEY,
  shortcode: process.env.MPESA_SHORTCODE || '174379',
  environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
  callbackBaseUrl: process.env.MPESA_CALLBACK_BASE_URL,
  initiatorName: process.env.MPESA_INITIATOR_NAME || 'apitest',
  initiatorPassword: process.env.MPESA_INITIATOR_PASSWORD,
  
  // API URLs (unchanged)
  get authUrl() {
    return this.environment === 'production'
      ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
      : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
  },
  
  get stkPushUrl() {
    return this.environment === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
  },
  
  get b2cUrl() {
    return this.environment === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/b2c/v3/paymentrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest';
  },
  
  get queryUrl() {
    return this.environment === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';
  }
};