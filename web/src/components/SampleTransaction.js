import React, { useState, useEffect } from 'react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'ethers';
import { useRpcProxy } from '../hooks/useRpcProxy';
import toast from 'react-hot-toast';

const SampleTransaction = ({ network }) => {
  const { isConnected } = useAccount();
  const { isConnected: proxyConnected } = useRpcProxy(network?.id);
  const [txData, setTxData] = useState({
    to: '0x1234567890123456789012345678901234567890',
    value: '0.001',
    gasLimit: '21000',
    gasPrice: '20',
  });
  
  const { sendTransaction, data: hash, error, isPending } = useSendTransaction();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle transaction success
  useEffect(() => {
    if (isSuccess && hash) {
      toast.success('Transaction submitted and intercepted by RPC Proxy!');
      console.log('Transaction hash:', hash);
    }
  }, [isSuccess, hash]);

  // Handle transaction errors
  useEffect(() => {
    if (error) {
      console.error('Transaction error:', error);
    }
  }, [error]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTxData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!proxyConnected) {
      toast.error('RPC Proxy not connected');
      return;
    }

    try {
      // Use wallet to sign and send transaction
      // This will automatically go through the RPC proxy if configured correctly
      sendTransaction({
        to: txData.to,
        value: parseEther(txData.value),
      });
    } catch (err) {
      console.error('Failed to submit transaction:', err);
      if (err?.message?.includes('User rejected')) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(`Failed to submit transaction: ${err?.message || err}`);
      }
    }
  };

  const resetForm = () => {
    setTxData({
      to: '0x1234567890123456789012345678901234567890',
      value: '0.001',
      gasLimit: '21000',
      gasPrice: '20',
    });
  };

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sample Transaction</h2>
      
      <div className="mb-6">
        <div className="alert-info">
          <p className="text-sm">
            This form allows you to submit a sample transaction through the RPC Proxy 
            to test delay tracking. The transaction will likely fail due to insufficient 
            funds, but the proxy will record the attempt.
          </p>
        </div>
      </div>

      {!proxyConnected && (
        <div className="alert-warning mb-6">
          <p className="text-sm">
            RPC Proxy is not connected for network: {network?.name || 'Unknown'}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="form-group">
            <label className="label">To Address</label>
            <input
              type="text"
              name="to"
              value={txData.to}
              onChange={handleInputChange}
              className="input"
              placeholder="0x..."
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Value (ETH)</label>
            <input
              type="number"
              name="value"
              value={txData.value}
              onChange={handleInputChange}
              className="input"
              step="0.001"
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Gas Limit</label>
            <input
              type="number"
              name="gasLimit"
              value={txData.gasLimit}
              onChange={handleInputChange}
              className="input"
              min="21000"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Gas Price (Gwei)</label>
            <input
              type="number"
              name="gasPrice"
              value={txData.gasPrice}
              onChange={handleInputChange}
              className="input"
              min="1"
              required
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={resetForm}
            className="btn-secondary"
            disabled={isPending}
          >
            Reset
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!isConnected || !proxyConnected || isPending || isConfirming}
          >
            {isPending ? (
              <>
                <span className="spinner mr-2"></span>
                Submitting...
              </>
            ) : isConfirming ? (
              <>
                <span className="spinner mr-2"></span>
                Confirming...
              </>
            ) : (
              'Submit Transaction'
            )}
          </button>
        </div>
      </form>

      {hash && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <h3 className="font-semibold text-green-900 mb-2">Transaction Submitted</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-green-700">Transaction Hash:</span>
              <p className="font-mono break-all">{hash}</p>
            </div>
            {isConfirming && (
              <div>
                <span className="text-yellow-700">Status:</span>
                <span className="ml-2 text-yellow-700">Confirming...</span>
              </div>
            )}
            {isSuccess && (
              <div>
                <span className="text-green-700">Status:</span>
                <span className="ml-2 text-green-700">Confirmed!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {network && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">Current Network</h3>
          <div className="text-sm text-gray-700">
            <p><strong>Network:</strong> {network.name}</p>
            <p><strong>Chain ID:</strong> {network.id}</p>
            <p><strong>RPC Proxy:</strong> {proxyConnected ? 'Connected' : 'Disconnected'}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SampleTransaction;
