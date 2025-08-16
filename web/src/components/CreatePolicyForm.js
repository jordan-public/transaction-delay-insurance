import React, { useState, useEffect } from 'react';
import { 
  useAccount, 
  useChainId, 
  useWriteContract, 
  useWaitForTransactionReceipt,
  useReadContract
} from 'wagmi';
import { parseEther, formatEther } from 'ethers';
import toast from 'react-hot-toast';

const CreatePolicyForm = ({ policyFactoryAddress, policyFactoryAbi, onPolicyCreated }) => {
  const { address, isConnected } = useAccount();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    delayThreshold: '10',
    premiumPercentage: '100', // 1% in basis points
    protocolFeePercentage: '1000', // 10% in basis points
    payoutPerIncident: '0.01', // ETH
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { writeContract, data: hash, error, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });  React.useEffect(() => {
    if (isSuccess) {
      toast.success('Policy created successfully!');
      onPolicyCreated?.();
      // Reset form
      setFormData({
        name: '',
        description: '',
        delayThreshold: '10',
        premiumPercentage: '100',
        protocolFeePercentage: '1000',
        payoutPerIncident: '0.01',
      });
      setIsSubmitting(false);
    }
  }, [isSuccess, onPolicyCreated]);

  React.useEffect(() => {
    if (error) {
      toast.error(`Error: ${error.message}`);
      setIsSubmitting(false);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isConnected || !policyFactoryAddress) {
      toast.error('Please connect wallet and ensure contract is available');
      return;
    }

    try {
      setIsSubmitting(true);

      const payoutPerIncidentWei = parseEther(formData.payoutPerIncident);

      await writeContract({
        address: policyFactoryAddress,
        abi: policyFactoryAbi,
        functionName: 'createPolicy',
        args: [
          formData.name,
          formData.description,
          '0x0000000000000000000000000000000000000000', // Use default RPC proxy
          BigInt(formData.delayThreshold),
          BigInt(formData.premiumPercentage),
          BigInt(formData.protocolFeePercentage),
          payoutPerIncidentWei,
        ],
      });
    } catch (err) {
      console.error('Failed to create policy:', err);
      toast.error('Failed to create policy');
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isLoading = isPending || isConfirming || isSubmitting;

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Policy</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="form-group">
            <label className="label">Policy Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="input"
              placeholder="e.g., Standard Delay Protection"
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Delay Threshold (blocks)</label>
            <input
              type="number"
              name="delayThreshold"
              value={formData.delayThreshold}
              onChange={handleInputChange}
              className="input"
              min="1"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Number of blocks before transaction is considered delayed
            </p>
          </div>

          <div className="form-group md:col-span-2">
            <label className="label">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="input"
              rows="3"
              placeholder="Describe the policy terms and coverage..."
              required
            />
          </div>

          <div className="form-group">
            <label className="label">Premium Percentage (basis points)</label>
            <input
              type="number"
              name="premiumPercentage"
              value={formData.premiumPercentage}
              onChange={handleInputChange}
              className="input"
              min="1"
              max="10000"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              100 = 1%, 1000 = 10%. Premium as % of pool size.
            </p>
          </div>

          <div className="form-group">
            <label className="label">Protocol Fee (basis points)</label>
            <input
              type="number"
              name="protocolFeePercentage"
              value={formData.protocolFeePercentage}
              onChange={handleInputChange}
              className="input"
              min="0"
              max="10000"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              100 = 1%, 1000 = 10%. Fee taken from deposits.
            </p>
          </div>

          <div className="form-group md:col-span-2">
            <label className="label">Payout Per Incident (ETH)</label>
            <input
              type="number"
              name="payoutPerIncident"
              value={formData.payoutPerIncident}
              onChange={handleInputChange}
              className="input"
              step="0.001"
              min="0.001"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Fixed amount paid out for each valid claim
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setFormData({
              name: '',
              description: '',
              delayThreshold: '10',
              premiumPercentage: '100',
              protocolFeePercentage: '1000',
              payoutPerIncident: '0.01',
            })}
            disabled={isLoading}
          >
            Reset
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!isConnected || isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner mr-2"></span>
                Creating Policy...
              </>
            ) : (
              'Create Policy'
            )}
          </button>
        </div>
      </form>

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

export default CreatePolicyForm;
