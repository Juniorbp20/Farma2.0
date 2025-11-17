// src/utils/formatters.js

const currencyNumberFormatter = new Intl.NumberFormat('es-DO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatterIntl = new Intl.NumberFormat('es-DO');

export const getCurrencySymbol = () =>
  (typeof window !== 'undefined' && window.sessionStorage.getItem('currencySymbol')) || 'RD$';

export const formatCurrency = (amount) => {
  const symbol = getCurrencySymbol();
  return `${symbol}${currencyNumberFormatter.format(Number(amount || 0))}`;
};

export const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('es-CO');
};

export const formatNumber = (number, decimals = 0) => {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number || 0);
};

export const truncateText = (text, maxLength = 50) => {
  if (!text) return '-';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};
