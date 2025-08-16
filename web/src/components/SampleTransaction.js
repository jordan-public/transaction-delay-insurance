import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { parseEther } from 'ethers';
import { useRpcProxy } from '../hooks/useRpcProxy';
import toast from 'react-hot-toast';

const SampleTransaction = ({ network }) => {
  const { address, isConnected } = useAccount();
  const { broadcastTransaction, isConnected: proxyConnected, loading } = useRpcProxy(network?.id);
  const [txData, setTxData] = useState({
    to: '0x1234567890123456789012345678901234567890',
    value: '0.001',
    gasLimit: '21000',
    gasPrice: '20',
  });
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setIsSubmitting(true);
      setResult(null);

      const transactionData = {
        to: txData.to,
        value: parseEther(txData.value).toString(),
        gasLimit: txData.gasLimit,
        gasPrice: parseEther(txData.gasPrice, 'gwei').toString(),
      };

      const response = await broadcastTransaction(transactionData);
      setResult(response);
      toast.success('Transaction submitted to RPC Proxy!');
    } catch (err) {
      console.error('Failed to submit transaction:', err);
      toast.error(`Failed to submit transaction: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTxData({
      to: '0x1234567890123456789012345678901234567890',
      value: '0.001',
      gasLimit: '21000',
      gasPrice: '20',
    });
    setResult(null);
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
            disabled={isSubmitting}
          >
            Reset
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!isConnected || !proxyConnected || isSubmitting || loading}
          >
            {isSubmitting ? (
              <>
                <span className="spinner mr-2"></span>
                Submitting...
              </>
            ) : (
              'Submit Transaction'
            )}
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <h3 className="font-semibold text-green-900 mb-2">Transaction Result</h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-green-700">Transaction Hash:</span>
              <p className="font-mono break-all">{result.txHash}</p>
            </div>
            <div>
              <span className="text-green-700">Broadcast Block:</span>
              <p className="font-mono">{result.broadcastBlock}</p>
            </div>
            <div>
              <span className="text-green-700">Status:</span>
              <span className={`ml-2 status-${result.status}`}>{result.status}</span>
            </div>
            <div>
              <span className="text-green-700">Timestamp:</span>
              <p className="font-mono">{new Date(result.timestamp).toLocaleString()}</p>
            </div>
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
