import { useState, useEffect, useCallback } from 'react';
import { getRpcProxyUrl, getNetworkById } from '../config/networks';

export const useRpcProxy = (chainId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const network = getNetworkById(chainId);
  const baseUrl = network ? getRpcProxyUrl(network) : null;

  // Test connection to RPC proxy
  const testConnection = useCallback(async () => {
    if (!baseUrl) return false;
    
    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/health`);
      const isHealthy = response.ok;
      setIsConnected(isHealthy);
      setError(isHealthy ? null : 'RPC Proxy not available');
      return isHealthy;
    } catch (err) {
      setIsConnected(false);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  // Get network info from proxy
  const getNetworkInfo = async () => {
    if (!baseUrl) return null;
    
    try {
      const response = await fetch(`${baseUrl}/network`);
      if (!response.ok) throw new Error('Failed to get network info');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  // Broadcast transaction through proxy
  const broadcastTransaction = async (transactionData) => {
    if (!baseUrl) throw new Error('Network not supported');
    
    try {
      setLoading(true);
      const response = await fetch(`${baseUrl}/tx/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to broadcast transaction');
      }

      return await response.json();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get transaction status
  const getTransactionStatus = async (txHash) => {
    if (!baseUrl) return null;
    
    try {
      const response = await fetch(`${baseUrl}/tx/${txHash}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to get transaction status');
      }
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  // Get delay proof for claim
  const getDelayProof = async (txHash) => {
    if (!baseUrl) return null;
    
    try {
      const response = await fetch(`${baseUrl}/tx/${txHash}/proof`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to get delay proof');
      }
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  // Get proxy statistics
  const getProxyStats = async () => {
    if (!baseUrl) return null;
    
    try {
      const response = await fetch(`${baseUrl}/stats`);
      if (!response.ok) throw new Error('Failed to get proxy stats');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  // Test connection on mount and network change
  useEffect(() => {
    if (baseUrl) {
      testConnection();
    }
  }, [baseUrl, testConnection]);

  return {
    isConnected,
    loading,
    error,
    baseUrl,
    testConnection,
    getNetworkInfo,
    broadcastTransaction,
    getTransactionStatus,
    getDelayProof,
    getProxyStats,
  };
};
