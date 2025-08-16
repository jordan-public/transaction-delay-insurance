import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'ethers';
import toast from 'react-hot-toast';

const PurchaseInsurance = ({ policy, policyAbi }) => {
  const { address, isConnected } = useAccount();
  const [ethAmount, setEthAmount] = useState('0.1');
  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);

  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Get user's current insurance details
  const { data: userInsurance, refetch: refetchUserInsurance } = useReadContract({
    address: policy?.policyAddress,
    abi: policyAbi,
    functionName: 'getUserInsurance',
    args: [address],
    enabled: isConnected && !!policy && !!address,
  });

  // Get quote for the entered ETH amount
  const getQuote = async () => {
    if (!policy || !ethAmount || parseFloat(ethAmount) <= 0) {
      setQuote(null);
      return;
    }

    try {
      setLoadingQuote(true);
      
      // This should be a read contract call
      const response = await fetch('/api/getShareQuote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policyAddress: policy.policyAddress,
          ethAmount: parseEther(ethAmount).toString(),
        }),
      });

      if (response.ok) {
        const quoteData = await response.json();
        setQuote(quoteData);
      }
    } catch (err) {
      console.error('Failed to get quote:', err);
    } finally {
      setLoadingQuote(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      getQuote();
    }, 500);

    return () => clearTimeout(timer);
  }, [ethAmount, policy]);

  useEffect(() => {
    if (isSuccess) {
      toast.success('Insurance purchased successfully!');
      refetchUserInsurance();
    }
  }, [isSuccess, refetchUserInsurance]);

  useEffect(() => {
    if (error) {
      toast.error(`Error: ${error.message}`);
    }
  }, [error]);

  const handlePurchase = async () => {
    if (!policy || !ethAmount || parseFloat(ethAmount) <= 0) {
      toast.error('Please enter a valid ETH amount');
      return;
    }

    try {
      await writeContract({
        address: policy.policyAddress,
        abi: policyAbi,
        functionName: 'purchaseShare',
        value: parseEther(ethAmount),
      });
    } catch (err) {
      console.error('Failed to purchase insurance:', err);
      toast.error('Failed to purchase insurance');
    }
  };

  if (!policy) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <p className="text-gray-500">Please select a policy to purchase insurance</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <p className="text-gray-500">Please connect your wallet to purchase insurance</p>
        </div>
      </div>
    );
  }

  const isLoading = isPending || isConfirming;

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Purchase Insurance</h2>
      
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">Selected Policy</h3>
        <p className="text-gray-700">{policy.name}</p>
        <p className="text-sm text-gray-500">{policy.description}</p>
      </div>

      {userInsurance && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Your Current Coverage</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-700">ETH Deposited:</span>
              <p className="font-medium">{formatEther(userInsurance.ethDeposited || 0)} ETH</p>
            </div>
            <div>
              <span className="text-blue-700">Incidents Remaining:</span>
              <p className="font-medium">{userInsurance.incidentsRemaining?.toString() || '0'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="form-group">
          <label className="label">ETH Amount to Deposit</label>
          <input
            type="number"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            className="input"
            step="0.001"
            min="0.001"
            placeholder="0.1"
          />
          <p className="text-sm text-gray-500 mt-1">
            Amount of ETH to deposit for insurance coverage
          </p>
        </div>

        {loadingQuote ? (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <span className="spinner mr-2"></span>
              <span>Getting quote...</span>
            </div>
          </div>
        ) : quote ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">Coverage Quote</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-green-700">Premium Cost:</span>
                <p className="font-medium">{formatEther(quote.premium)} ETH</p>
              </div>
              <div>
                <span className="text-green-700">Incidents Covered:</span>
                <p className="font-medium">{quote.incidentsCovered.toString()}</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end space-x-4">
          <button
            onClick={getQuote}
            className="btn-secondary"
            disabled={loadingQuote || !ethAmount}
          >
            {loadingQuote ? 'Getting Quote...' : 'Get Quote'}
          </button>
          <button
            onClick={handlePurchase}
            className="btn-primary"
            disabled={isLoading || !quote || !ethAmount}
          >
            {isLoading ? (
              <>
                <span className="spinner mr-2"></span>
                Purchasing...
              </>
            ) : (
              `Purchase Insurance (${ethAmount} ETH)`
            )}
          </button>
        </div>
      </div>

      {hash && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Transaction submitted: 
            <a 
              href={`https://etherscan.io/tx/${hash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-1 underline"
            >
              {hash.slice(0, 10)}...{hash.slice(-8)}
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

export default PurchaseInsurance;
