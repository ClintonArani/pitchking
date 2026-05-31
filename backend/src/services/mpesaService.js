import axios from 'axios';
import { mpesaConfig } from '../config/mpesa.js';
import logger from '../utils/logger.js';
import { formatPhoneNumber } from '../utils/helpers.js';

export class MpesaService {
  static async getAccessToken() {
    try {
      const auth = Buffer.from(`${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`).toString('base64');
      const response = await axios.get(mpesaConfig.authUrl, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });
      return response.data.access_token;
    } catch (error) {
      logger.error('M-Pesa auth error:', error.response?.data || error.message);
      throw new Error('Failed to get M-Pesa access token');
    }
  }
  
  static async stkPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = Buffer.from(
        `${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`
      ).toString('base64');
      
      const data = {
        BusinessShortCode: mpesaConfig.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formatPhoneNumber(phoneNumber),
        PartyB: mpesaConfig.shortcode,
        PhoneNumber: formatPhoneNumber(phoneNumber),
        CallBackURL: `${mpesaConfig.callbackBaseUrl}/api/mpesa/stk-callback`,
        AccountReference: accountReference.slice(0, 12),
        TransactionDesc: transactionDesc.slice(0, 13)
      };
      
      const response = await axios.post(mpesaConfig.stkPushUrl, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      logger.info(`STK Push initiated: ${response.data.CheckoutRequestID}`);
      return response.data;
    } catch (error) {
      logger.error('STK Push error:', error.response?.data || error.message);
      throw new Error('Failed to initiate M-Pesa payment');
    }
  }
  
  static async queryStatus(checkoutRequestId) {
    try {
      const token = await this.getAccessToken();
      const timestamp = this.getTimestamp();
      const password = Buffer.from(
        `${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`
      ).toString('base64');
      
      const data = {
        BusinessShortCode: mpesaConfig.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };
      
      const response = await axios.post(mpesaConfig.queryUrl, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      logger.error('Query status error:', error.response?.data || error.message);
      throw new Error('Failed to query transaction status');
    }
  }
  
  static async b2c(phoneNumber, amount, commandId = 'BusinessPayment') {
    try {
      const token = await this.getAccessToken();
      const data = {
        InitiatorName: 'apitest',
        SecurityCredential: 'TODO: Generate security credential',
        CommandID: commandId,
        Amount: Math.round(amount),
        PartyA: mpesaConfig.shortcode,
        PartyB: formatPhoneNumber(phoneNumber),
        Remarks: 'PitchKing withdrawal',
        QueueTimeOutURL: `${mpesaConfig.callbackBaseUrl}/api/mpesa/b2c-timeout`,
        ResultURL: `${mpesaConfig.callbackBaseUrl}/api/mpesa/b2c-result`,
        Occasion: 'Withdrawal'
      };
      
      const response = await axios.post(mpesaConfig.b2cUrl, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      logger.info(`B2C initiated: ${response.data.ConversationID}`);
      return response.data;
    } catch (error) {
      logger.error('B2C error:', error.response?.data || error.message);
      throw new Error('Failed to process withdrawal');
    }
  }
  
  static getTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }
}