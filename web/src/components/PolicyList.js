import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatEther } from 'ethers';

const PolicyList = ({ policyFactoryAddress, policyFactoryAbi, onPolicySelect }) => {
  const { isConnected } = useAccount();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  // Read active policies from contract
  const { data: activePoliciesData, isLoading, refetch } = useReadContract({
    address: policyFactoryAddress,
    abi: policyFactoryAbi,
    functionName: 'getActivePolicies',
    enabled: isConnected && !!policyFactoryAddress,
  });

  useEffect(() => {
    if (activePoliciesData && Array.isArray(activePoliciesData) && activePoliciesData.length === 2) {
      const [policyIds, policyInfos] = activePoliciesData;
      const formattedPolicies = policyIds.map((id, index) => ({
        id: id.toString(),
        ...policyInfos[index],
      }));
      setPolicies(formattedPolicies);
    }
  }, [activePoliciesData]);

  const handleRefresh = () => {
    refetch();
  };

  const formatTimestamp = (timestamp) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  };

  const handlePolicySelect = (policy) => {
    setSelectedPolicy(policy);
    onPolicySelect?.(policy);
  };

  if (!isConnected) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <p className="text-gray-500">Please connect your wallet to view policies</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Available Policies</h2>
        <button
          onClick={handleRefresh}
          className="btn-secondary"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner mr-2"></span>
              Loading...
            </>
          ) : (
            'Refresh'
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-500">Loading policies...</p>
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No active policies found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedPolicy?.id === policy.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handlePolicySelect(policy)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {policy.name}
                    </h3>
                    <span className={policy.active ? 'status-active' : 'status-inactive'}>
                      {policy.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mt-2">{policy.description}</p>
                  
                  <div className="flex items-center space-x-6 mt-3 text-sm text-gray-500">
                    <span>Policy ID: {policy.id}</span>
                    <span>Created: {formatTimestamp(policy.createdAt)}</span>
                    <span>Contract: {policy.policyAddress?.slice(0, 10)}...</span>
                  </div>
                </div>
                
                <div className="ml-4">
                  {selectedPolicy?.id === policy.id && (
                    <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPolicy && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Selected Policy: <strong>{selectedPolicy.name}</strong>
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Contract Address: {selectedPolicy.policyAddress}
          </p>
        </div>
      )}
    </div>
  );
};

export default PolicyList;
