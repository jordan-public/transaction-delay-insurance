import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useRpcProxy } from '../hooks/useRpcProxy';
import toast from 'react-hot-toast';

const InsuranceClaim = ({ policy, policyAbi, network }) => {
  const { address, isConnected } = useAccount();
  const { getDelayProof, getTransactionStatus } = useRpcProxy(network?.id);
  const [txHash, setTxHash] = useState('');
  const [proofData, setProofData] = useState(null);
  const [txStatus, setTxStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const { writeContract, data: hash, error, isPending } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  React.useEffect(() => {
    if (isSuccess) {
      toast.success('Claim submitted successfully!');
      setTxHash('');
      setProofData(null);
      setTxStatus(null);
    }
  }, [isSuccess]);

  React.useEffect(() => {
    if (error) {
      toast.error(`Error: ${error.message}`);
    }
  }, [error]);

  const handleGetProof = async () => {
    if (!txHash.trim()) {
      toast.error('Please enter a transaction hash');
      return;
    }

    try {
      setLoading(true);
      
      // Get transaction status first
      const status = await getTransactionStatus(txHash);
      if (!status) {
        toast.error('Transaction not found in RPC Proxy records');
        return;
      }

      setTxStatus(status);

      // Check if transaction has sufficient delay
      if (status.status !== 'confirmed') {
        toast.warning('Transaction is not confirmed yet');
        return;
      }

      if (!status.delay || status.delay <= 10) { // Assuming 10 block threshold
        toast.warning(`Transaction delay (${status.delay} blocks) is not sufficient for claim`);
        return;
      }

      // Get delay proof
      const proof = await getDelayProof(txHash);
      if (!proof) {
        toast.error('Could not generate delay proof');
        return;
      }

      setProofData(proof);
      toast.success('Delay proof generated successfully!');
    } catch (err) {
      console.error('Failed to get proof:', err);
      toast.error(`Failed to get proof: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async () => {
    if (!proofData || !policy) {
      toast.error('Missing proof data or policy');
      return;
    }

    try {
      const claimProof = {
        txHash: proofData.txHash,
        broadcastBlock: BigInt(proofData.broadcastBlock),
        confirmationBlock: BigInt(proofData.confirmationBlock),
        rpcSignature: proofData.signature,
      };

      await writeContract({
        address: policy.policyAddress,
        abi: policyAbi,
        functionName: 'submitClaim',
        args: [claimProof],
      });
    } catch (err) {
      console.error('Failed to submit claim:', err);
      toast.error('Failed to submit claim');
    }
  };

  if (!policy) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <p className="text-gray-500">Please select a policy to submit a claim</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="card">
        <div className="text-center py-8">
          <p className="text-gray-500">Please connect your wallet to submit claims</p>
        </div>
      </div>
    );
  }

  const isSubmitting = isPending || isConfirming;

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit Insurance Claim</h2>
      
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">Selected Policy</h3>
        <p className="text-gray-700">{policy.name}</p>
        <p className="text-sm text-gray-500">{policy.description}</p>
      </div>

      <div className="space-y-6">
        <div className="form-group">
          <label className="label">Transaction Hash</label>
          <input
            type="text"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            className="input"
            placeholder="0x..."
            disabled={loading || isSubmitting}
          />
          <p className="text-sm text-gray-500 mt-1">
            Enter the hash of the delayed transaction you want to claim for
          </p>
        </div>

        <div className="flex justify-start">
          <button
            onClick={handleGetProof}
            className="btn-secondary"
            disabled={loading || !txHash.trim() || isSubmitting}
          >
            {loading ? (
              <>
                <span className="spinner mr-2"></span>
                Getting Proof...
              </>
            ) : (
              'Get Delay Proof'
            )}
          </button>
        </div>

        {txStatus && (
          <div className={`p-4 rounded-lg border ${
            txStatus.delay && txStatus.delay > 10 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <h3 className="font-semibold mb-2">Transaction Status</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Status:</span>
                <span className={`ml-2 status-${txStatus.status}`}>{txStatus.status}</span>
              </div>
              <div>
                <span className="font-medium">Delay:</span>
                <span className="ml-2">{txStatus.delay || 0} blocks</span>
              </div>
              <div>
                <span className="font-medium">Broadcast Block:</span>
                <span className="ml-2">{txStatus.broadcastBlock}</span>
              </div>
              <div>
                <span className="font-medium">Confirmation Block:</span>
                <span className="ml-2">{txStatus.confirmationBlock || 'N/A'}</span>
              </div>
            </div>
            
            {txStatus.delay && txStatus.delay > 10 ? (
              <div className="mt-2 text-green-700 text-sm">
                ✓ Transaction is eligible for insurance claim
              </div>
            ) : (
              <div className="mt-2 text-yellow-700 text-sm">
                ⚠ Transaction delay is insufficient for claim (need >10 blocks)
              </div>
            )}
          </div>
        )}

        {proofData && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Delay Proof Generated</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-blue-700">Transaction Hash:</span>
                <p className="font-mono break-all">{proofData.txHash}</p>
              </div>
              <div>
                <span className="text-blue-700">Delay:</span>
                <p>{proofData.delay} blocks</p>
              </div>
              <div>
                <span className="text-blue-700">Signature:</span>
                <p className="font-mono text-xs break-all">{proofData.signature}</p>
              </div>
            </div>
          </div>
        )}

        {proofData && (
          <div className="flex justify-end">
            <button
              onClick={handleSubmitClaim}
              className="btn-primary"
              disabled={isSubmitting || !proofData}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner mr-2"></span>
                  Submitting Claim...
                </>
              ) : (
                'Submit Insurance Claim'
              )}
            </button>
          </div>
        )}
      </div>

      {hash && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            Claim transaction submitted: 
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

export default InsuranceClaim;
