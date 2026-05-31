import { randomBytes } from 'crypto';

export const generateInviteCode = () => {
  return randomBytes(4).toString('hex').toUpperCase();
};

export const calculateWinnings = (totalPool, adminCutPercent = 20) => {
  const adminAmount = (totalPool * adminCutPercent) / 100;
  const winnersPool = totalPool - adminAmount;
  return { adminAmount, winnersPool };
};

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const formatPhoneNumber = (phone) => {
  // Convert 07XX XXX XXX to 2547XX XXX XXX
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '254' + cleaned.substring(1);
  } else if (cleaned.startsWith('254')) {
    // Already correct
  } else if (cleaned.startsWith('7')) {
    cleaned = '254' + cleaned;
  }
  return cleaned;
};