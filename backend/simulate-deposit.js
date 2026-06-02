import axios from 'axios';
import { MpesaService } from './src/services/mpesaService.js';
import { config } from 'dotenv';
config();

const checkoutRequestId = process.argv[2];
if (!checkoutRequestId) {
  console.error('Usage: node simulate-deposit.js <CheckoutRequestID>');
  process.exit(1);
}

const token = await MpesaService.getAccessToken();
const response = await axios.post(
  'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/simulate',
  {
    CheckoutRequestID: checkoutRequestId,
    ResultCode: 0,
    ResultDesc: 'Success'
  },
  {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);
console.log('Simulation response:', response.data);