import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';
import axios from 'axios';
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  DollarSign
} from 'lucide-react';

const ClientContractPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const res = await axios.get(`${API}/client/projects/${projectId}/contract`, {
          withCredentials: true
        });
        setContract(res.data);
      } catch (error) {
        console.error('Error fetching contract:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchContract();
  }, [projectId]);

  const handleSign = async () => {
    if (!confirm('Sign this contract?\n\nBy signing, you agree to the scope, price, and terms outlined in this agreement.')) {
      return;
    }

    setSigning(true);
    try {
      await axios.post(
        `${API}/client/contracts/${contract.contract_id}/sign`,
        {},
        { withCredentials: true }
      );
      alert('✅ Contract signed!\n\n🚀 Project is now active\n👨‍💻 Developers can begin work');
      // Refresh contract
      const res = await axios.get(`${API}/client/projects/${projectId}/contract`, {
        withCredentials: true
      });
      setContract(res.data);
    } catch (error) {
      console.error('Error signing contract:', error);
      alert('Failed to sign contract');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="contract-loading">
        <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="contract-not-found">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <div className="text-white/60 text-sm">No contract found for this project</div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-500/20 text-gray-400',
      sent: 'bg-blue-500/20 text-blue-400',
      pending_signature: 'bg-yellow-500/20 text-yellow-400',
      signed: 'bg-green-500/20 text-green-400',
      active: 'bg-green-600/20 text-green-500',
      paused: 'bg-red-500/20 text-red-400'
    };
    return colors[status] || colors.draft;
  };

  const canSign = ['sent', 'pending_signature'].includes(contract.status) && !contract.signatures.client_signed;

  return (
    <div className="min-h-screen p-6 lg:p-8" data-testid="client-contract-page">
      {/* Back button */}
      <button
        onClick={() => navigate('/client/dashboard-os')}
        className="flex items-center gap-2 text-white/50 hover:text-white mb-6 transition-colors"
        data-testid="back-btn"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Dashboard</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="w-8 h-8 text-blue-400" />
          <h1 className="text-2xl lg:text-3xl font-semibold text-white">
            Contract Agreement
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded text-sm font-medium ${getStatusColor(contract.status)}`}>
            {contract.status.replace('_', ' ').toUpperCase()}
          </span>
          {contract.status === 'active' && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Project Active
            </span>
          )}
        </div>
      </div>

      {/* Contract Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div className="border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-2">{contract.title}</h2>
            <div className="text-sm text-white/50">
              Version {contract.version} · Created {new Date(contract.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Scope */}
          <div className="border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Project Scope</h3>
            <div className="space-y-3">
              {contract.scope.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                  data-testid={`scope-item-${idx}`}
                >
                  <div>
                    <div className="text-white font-medium text-sm">{item.name}</div>
                    {item.estimated_hours > 0 && (
                      <div className="text-xs text-white/50 mt-1">
                        Est. {item.estimated_hours}h
                      </div>
                    )}
                  </div>
                  <div className="text-green-400 font-semibold">
                    ${item.price.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Billing Rules */}
          <div className="border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Billing Terms</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/50">Payment Type:</span>
                <span className="text-white">{contract.billing_rules.type.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">Invoice Trigger:</span>
                <span className="text-white">{contract.billing_rules.auto_invoice_on.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">Payment Terms:</span>
                <span className="text-white">{contract.billing_rules.payment_terms_days} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">Pause on Overdue:</span>
                <span className="text-white">{contract.billing_rules.pause_on_overdue ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/50">Start Date:</span>
                <span className="text-white">{new Date(contract.timeline.start_date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/50">Estimated End:</span>
                <span className="text-white">{new Date(contract.timeline.estimated_end_date).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Total Value */}
          <div className="border border-green-500/30 bg-green-500/10 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-6 h-6 text-green-400" />
              <h3 className="text-sm font-medium text-white/70">Total Contract Value</h3>
            </div>
            <div className="text-3xl font-bold text-green-400">
              ${contract.total_value.toLocaleString()}
            </div>
          </div>

          {/* Signatures */}
          <div className="border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Signatures</h3>
            <div className="space-y-4">
              {/* Provider Signature */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {contract.signatures.provider_signed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-white">Provider Signed</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm text-white">Provider Pending</span>
                    </>
                  )}
                </div>
                {contract.signatures.provider_signed_at && (
                  <div className="text-xs text-white/50 ml-6">
                    {new Date(contract.signatures.provider_signed_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Client Signature */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {contract.signatures.client_signed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-white">Client Signed</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm text-white">Awaiting Your Signature</span>
                    </>
                  )}
                </div>
                {contract.signatures.client_signed_at && (
                  <div className="text-xs text-white/50 ml-6">
                    {new Date(contract.signatures.client_signed_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sign Button */}
          {canSign && (
            <button
              onClick={handleSign}
              disabled={signing}
              className="w-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
              data-testid="sign-contract-btn"
            >
              {signing ? 'Signing...' : '✍️ Sign Contract'}
            </button>
          )}

          {contract.status === 'active' && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="text-sm text-green-400 font-medium mb-1">✅ Contract Active</div>
              <div className="text-xs text-white/60">
                Project work has begun. Invoices will be generated per module completion.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientContractPage;
