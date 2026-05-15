import { useEffect, useMemo, useState } from 'react';
import { BrowserProvider } from 'ethers';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';
const DEFAULT_NETWORK = (import.meta.env.VITE_DEFAULT_NETWORK || 'amoy').toLowerCase();

const NETWORKS = {
  amoy: {
    id: 80002,
    name: 'Polygon Amoy',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: [import.meta.env.VITE_AMOY_RPC_URL || ''],
    blockExplorerUrls: ['https://www.oklink.com/amoy']
  },
  ganache: {
    id: Number(import.meta.env.VITE_GANACHE_CHAIN_ID || 1337),
    name: 'Ganache Local',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: [import.meta.env.VITE_GANACHE_RPC_URL || 'http://127.0.0.1:8545'],
    blockExplorerUrls: []
  }
};

function getNetworkKey(key) {
  return NETWORKS[key] ? key : 'amoy';
}

const emptyIssuerForm = {
  issuerAddress: '',
  candidateName: '',
  candidateWallet: '',
  degree: '',
  institution: '',
  issueDate: '',
  expiryDate: '',
  issuerName: '',
  email: '',
};

const emptyCandidateQuery = { wallet: '' };
const emptyVerifierQuery = { credentialId: '', wallet: '' };

function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(value) {
  if (!value) return 'N/A';
  const date = new Date(Number(value) * 1000);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
}

function StatusBadge({ valid, revoked, expired }) {
  let label = 'Unknown';
  let tone = 'bg-slate-700 text-slate-200';
  if (revoked) {
    label = 'Revoked';
    tone = 'bg-rose-500/20 text-rose-200 border border-rose-400/30';
  } else if (expired) {
    label = 'Expired';
    tone = 'bg-amber-500/20 text-amber-200 border border-amber-400/30';
  } else if (valid) {
    label = 'Valid';
    tone = 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30';
  }

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

function App() {
  const [activeView, setActiveView] = useState('issuer');
  const [walletAddress, setWalletAddress] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [notice, setNotice] = useState('Connect MetaMask to start signing and verifying credentials.');
  const [busy, setBusy] = useState(false);
  const [issuerForm, setIssuerForm] = useState(emptyIssuerForm);
  const [candidateQuery, setCandidateQuery] = useState(emptyCandidateQuery);
  const [candidateCredentials, setCandidateCredentials] = useState([]);
  const [verifierQuery, setVerifierQuery] = useState(emptyVerifierQuery);
  const [verifierResult, setVerifierResult] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [targetNetwork, setTargetNetwork] = useState(getNetworkKey(DEFAULT_NETWORK));

  const canUseBrowserWallet = useMemo(() => typeof window !== 'undefined' && Boolean(window.ethereum), []);

  useEffect(() => {
    if (!canUseBrowserWallet) return undefined;

    let mounted = true;
    window.ethereum.request({ method: 'eth_accounts' }).then((accounts) => {
      if (mounted && accounts?.length) {
        setWalletAddress(accounts[0]);
      }
    });

    window.ethereum.request({ method: 'eth_chainId' }).then((id) => {
      if (mounted) setChainId(Number(id));
    });

    const handleAccountsChanged = (accounts) => {
      setWalletAddress(accounts?.[0] || '');
    };

    const handleChainChanged = (id) => {
      setChainId(Number(id));
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      mounted = false;
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [canUseBrowserWallet]);

  async function ensureTargetNetwork() {
    if (!canUseBrowserWallet) return false;
    const target = NETWORKS[targetNetwork];
    const currentChainId = chainId ?? Number(await window.ethereum.request({ method: 'eth_chainId' }));
    if (currentChainId === target.id) return true;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + target.id.toString(16) }],
      });
      setChainId(target.id);
      return true;
    } catch (error) {
      if (error?.code === 4902) {
        if (!target.rpcUrls[0]) {
          setNotice(`RPC URL missing for ${target.name}. Set the VITE_AMOY_RPC_URL or VITE_GANACHE_RPC_URL env.`);
          return false;
        }
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x' + target.id.toString(16),
            chainName: target.name,
            nativeCurrency: target.nativeCurrency,
            rpcUrls: target.rpcUrls,
            blockExplorerUrls: target.blockExplorerUrls,
          }],
        });
        setChainId(target.id);
        return true;
      }
      setNotice(error?.message || `Please switch MetaMask to ${target.name}.`);
      return false;
    }
  }

  async function connectWallet() {
    if (!canUseBrowserWallet) {
      setNotice('MetaMask is not available in this browser.');
      return;
    }

    try {
      setConnecting(true);
      await ensureTargetNetwork();
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);
      setNotice(`Wallet connected: ${address}`);
    } catch (error) {
      setNotice(error?.message || 'Unable to connect wallet.');
    } finally {
      setConnecting(false);
    }
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(`${BACKEND_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || data.message || data.error || 'Request failed');
    }
    return data;
  }

  async function handleRegisterIssuer(event) {
    event.preventDefault();
    if (!issuerForm.issuerAddress) {
      setNotice('Issuer address is required.');
      return;
    }
    try {
      setBusy(true);
      const result = await requestJson('/issuer/register', {
        method: 'POST',
        body: JSON.stringify({ issuer: issuerForm.issuerAddress }),
      });
      setNotice(`Issuer registered. Tx: ${result.receipt?.transactionHash || 'submitted'}`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleIssueCredential(event) {
    event.preventDefault();
    try {
      const networkOk = await ensureTargetNetwork();
      if (!networkOk) return;
      if (!walletAddress) {
        setNotice('Connect MetaMask to sign the issuance request.');
        return;
      }
      if (!CONTRACT_ADDRESS) {
        setNotice('VITE_CONTRACT_ADDRESS is not set.');
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      const issuer = await signer.getAddress();
      const nonce = (BigInt(Date.now()) * 1000000n + BigInt(Math.floor(Math.random() * 1000000))).toString();
      const deadline = Math.floor(Date.now() / 1000) + 10 * 60;

      const typedDataDomain = {
        name: 'ResumeVerifier',
        version: '1',
        chainId,
        verifyingContract: CONTRACT_ADDRESS,
      };
      const typedDataTypes = {
        IssueCredential: [
          { name: 'issuer', type: 'address' },
          { name: 'candidateWallet', type: 'address' },
          { name: 'candidateName', type: 'string' },
          { name: 'degree', type: 'string' },
          { name: 'institution', type: 'string' },
          { name: 'issueDate', type: 'uint256' },
          { name: 'expiryDate', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      };
      const typedDataMessage = {
        issuer,
        candidateWallet: issuerForm.candidateWallet,
        candidateName: issuerForm.candidateName,
        degree: issuerForm.degree,
        institution: issuerForm.institution,
        issueDate: Number(issuerForm.issueDate),
        expiryDate: Number(issuerForm.expiryDate),
        nonce,
        deadline,
      };

      const signature = await signer.signTypedData(typedDataDomain, typedDataTypes, typedDataMessage);
      setBusy(true);
      const result = await requestJson('/issuer/issue', {
        method: 'POST',
        body: JSON.stringify({
          issuer,
          signature,
          nonce,
          deadline,
          candidateWallet: issuerForm.candidateWallet,
          candidateName: issuerForm.candidateName,
          degree: issuerForm.degree,
          institution: issuerForm.institution,
          issueDate: Number(issuerForm.issueDate),
          expiryDate: Number(issuerForm.expiryDate),
          metadata: {
            source: 'frontend',
            submittedBy: walletAddress || issuerForm.issuerAddress || '',
          },
        }),
      });
      setNotice(`Credential issued with ID ${result.credentialId || 'unknown'} (CID ${result.ipfsCid || 'n/a'})`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadCandidateCredentials(event) {
    event?.preventDefault();
    if (!candidateQuery.wallet) {
      setNotice('Candidate wallet is required.');
      return;
    }

    try {
      setBusy(true);
      const result = await requestJson(`/candidate/by-owner/${candidateQuery.wallet}`);
      setCandidateCredentials(result.credentials || []);
      setNotice(`Loaded ${result.credentials?.length || 0} credential(s) for ${candidateQuery.wallet}`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadVerifierCredential(event) {
    event?.preventDefault();
    if (!verifierQuery.credentialId) {
      setNotice('Credential ID is required.');
      return;
    }

    try {
      setBusy(true);
      const result = await requestJson(`/verify/onchain/${verifierQuery.credentialId}`);
      setVerifierResult(result.credential);
      setNotice(`Verified credential ${verifierQuery.credentialId}`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadVerifierWallet(event) {
    event?.preventDefault();
    if (!verifierQuery.wallet) {
      setNotice('Wallet address is required.');
      return;
    }

    try {
      setBusy(true);
      const result = await requestJson(`/candidate/by-owner/${verifierQuery.wallet}`);
      setVerifierResult({
        wallet_address: result.wallet_address,
        credentials: result.credentials,
      });
      setNotice(`Loaded verification view for ${result.wallet_address}`);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  const shellCard = 'rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl';
  const inputClass = 'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-emerald-400/60 focus:bg-white/8';
  const buttonClass = 'rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60';
  const secondaryButtonClass = 'rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="min-h-screen px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className={`${shellCard} overflow-hidden p-6 sm:p-8`}>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.35em] text-emerald-300/80">Polygon PoS credential verifier</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
                Blockchain-based resume verification with roles, IPFS, and public proof.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Issuers upload credential JSON to Pinata, the backend writes the CID on-chain, candidates can inspect their wallet history, and verifiers can check live state plus the full IPFS payload.
              </p>
            </div>
            <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 sm:min-w-80">
              <div className="flex items-center justify-between gap-4">
                <span>Wallet</span>
                <span className="font-semibold text-slate-100">{walletAddress ? shortenAddress(walletAddress) : 'Not connected'}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Network</span>
                <span className="font-semibold text-slate-100">
                  {chainId ? (chainId === NETWORKS[targetNetwork].id ? NETWORKS[targetNetwork].name : `Chain ${chainId}`) : 'Unknown'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Target</span>
                <select
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100"
                  value={targetNetwork}
                  onChange={(event) => setTargetNetwork(getNetworkKey(event.target.value))}
                >
                  <option value="amoy">Polygon Amoy</option>
                  <option value="ganache">Ganache Local</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Backend</span>
                <span className="font-semibold text-emerald-300">{BACKEND_URL}</span>
              </div>
              {chainId && chainId !== NETWORKS[targetNetwork].id && (
                <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Wrong network. Switch MetaMask to {NETWORKS[targetNetwork].name}.
                </div>
              )}
              <div className="grid gap-2">
                <button className={buttonClass} onClick={connectWallet} disabled={connecting}>
                {connecting ? 'Connecting...' : walletAddress ? 'Reconnect MetaMask' : 'Connect MetaMask'}
                </button>
                <button className={secondaryButtonClass} onClick={ensureTargetNetwork} disabled={!canUseBrowserWallet}>
                  Switch to {NETWORKS[targetNetwork].name}
                </button>
              </div>
              <p className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-400">{notice}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {['issuer', 'candidate', 'verifier'].map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  activeView === view
                    ? 'bg-white text-slate-950'
                    : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)} Dashboard
              </button>
            ))}
          </div>
        </header>

        {activeView === 'issuer' && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className={`${shellCard} p-6`}>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Admin panel</h2>
                  <p className="text-sm text-slate-400">Register trusted issuers before issuing credentials.</p>
                </div>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">ADMIN</span>
              </div>
              <form className="space-y-4" onSubmit={handleRegisterIssuer}>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">Issuer wallet address</label>
                  <input
                    className={inputClass}
                    value={issuerForm.issuerAddress}
                    onChange={(event) => setIssuerForm((current) => ({ ...current, issuerAddress: event.target.value }))}
                    placeholder="0x..."
                  />
                </div>
                <button className={buttonClass} type="submit" disabled={busy}>
                  Register issuer
                </button>
              </form>
            </div>

            <div className={`${shellCard} p-6`}>
              <div className="mb-5">
                <h2 className="text-2xl font-semibold">Issue credential</h2>
                <p className="text-sm text-slate-400">Store the full credential JSON on IPFS, then issue only the CID on-chain.</p>
              </div>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleIssueCredential}>
                <input className={inputClass} placeholder="Candidate name" value={issuerForm.candidateName} onChange={(event) => setIssuerForm((current) => ({ ...current, candidateName: event.target.value }))} />
                <input className={inputClass} placeholder="Candidate wallet" value={issuerForm.candidateWallet} onChange={(event) => setIssuerForm((current) => ({ ...current, candidateWallet: event.target.value }))} />
                <input className={inputClass} placeholder="Degree or credential" value={issuerForm.degree} onChange={(event) => setIssuerForm((current) => ({ ...current, degree: event.target.value }))} />
                <input className={inputClass} placeholder="Institution" value={issuerForm.institution} onChange={(event) => setIssuerForm((current) => ({ ...current, institution: event.target.value }))} />
                <input className={inputClass} placeholder="Issue date (unix)" value={issuerForm.issueDate} onChange={(event) => setIssuerForm((current) => ({ ...current, issueDate: event.target.value }))} />
                <input className={inputClass} placeholder="Expiry date (unix)" value={issuerForm.expiryDate} onChange={(event) => setIssuerForm((current) => ({ ...current, expiryDate: event.target.value }))} />
                <input className={inputClass} placeholder="Issuer name" value={issuerForm.issuerName} onChange={(event) => setIssuerForm((current) => ({ ...current, issuerName: event.target.value }))} />
                <input className={inputClass} placeholder="Contact email" value={issuerForm.email} onChange={(event) => setIssuerForm((current) => ({ ...current, email: event.target.value }))} />
                <div className="sm:col-span-2 flex gap-3">
                  <button className={buttonClass} type="submit" disabled={busy}>
                    {busy ? 'Processing...' : 'Upload to IPFS and issue'}
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}

        {activeView === 'candidate' && (
          <section className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
            <div className={`${shellCard} p-6`}>
              <h2 className="text-2xl font-semibold">Candidate dashboard</h2>
              <p className="mt-2 text-sm text-slate-400">Enter a wallet address to see every credential issued to that address.</p>
              <form className="mt-5 flex gap-3" onSubmit={loadCandidateCredentials}>
                <input
                  className={inputClass}
                  value={candidateQuery.wallet}
                  onChange={(event) => setCandidateQuery({ wallet: event.target.value })}
                  placeholder="0x candidate wallet"
                />
                <button className={buttonClass} type="submit" disabled={busy}>
                  Load
                </button>
              </form>
            </div>
            <div className={`${shellCard} p-6`}>
              <h3 className="text-xl font-semibold">Wallet credentials</h3>
              <div className="mt-4 grid gap-4">
                {candidateCredentials.length === 0 && <p className="text-sm text-slate-400">No credentials loaded yet.</p>}
                {candidateCredentials.map((credential) => (
                  <article key={credential.credential_id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold">{credential.candidate_name}</h4>
                        <p className="text-sm text-slate-400">{credential.degree} at {credential.institution}</p>
                      </div>
                      <StatusBadge valid={credential.valid} revoked={credential.revoked} expired={credential.expired} />
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <p>Credential ID: {credential.credential_id}</p>
                      <p>Wallet: {shortenAddress(credential.candidate_wallet)}</p>
                      <p>Issued: {formatTimestamp(credential.issue_date)}</p>
                      <p>Expires: {formatTimestamp(credential.expiry_date)}</p>
                      <p className="sm:col-span-2">CID: {credential.ipfs_cid}</p>
                    </div>
                    <details className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-emerald-200">View IPFS payload</summary>
                      <pre className="mt-3 overflow-auto text-xs text-slate-300">{JSON.stringify(credential.ipfs_payload, null, 2)}</pre>
                    </details>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeView === 'verifier' && (
          <section className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
            <div className={`${shellCard} p-6`}>
              <h2 className="text-2xl font-semibold">Verifier dashboard</h2>
              <p className="mt-2 text-sm text-slate-400">Check a credential ID or load every credential for a wallet address.</p>
              <div className="mt-5 space-y-4">
                <form className="flex gap-3" onSubmit={loadVerifierCredential}>
                  <input className={inputClass} value={verifierQuery.credentialId} onChange={(event) => setVerifierQuery((current) => ({ ...current, credentialId: event.target.value }))} placeholder="Credential ID" />
                  <button className={buttonClass} type="submit" disabled={busy}>
                    Verify ID
                  </button>
                </form>
                <form className="flex gap-3" onSubmit={loadVerifierWallet}>
                  <input className={inputClass} value={verifierQuery.wallet} onChange={(event) => setVerifierQuery((current) => ({ ...current, wallet: event.target.value }))} placeholder="Wallet address" />
                  <button className={buttonClass} type="submit" disabled={busy}>
                    Load wallet
                  </button>
                </form>
              </div>
            </div>

            <div className={`${shellCard} p-6`}>
              <h3 className="text-xl font-semibold">Live verification result</h3>
              <div className="mt-4 space-y-4">
                {!verifierResult && <p className="text-sm text-slate-400">No verification data loaded yet.</p>}

                {verifierResult?.credential_id && (
                  <article className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="text-lg font-semibold">{verifierResult.candidate_name}</h4>
                        <p className="text-sm text-slate-400">Credential ID {verifierResult.credential_id}</p>
                      </div>
                      <StatusBadge valid={verifierResult.valid} revoked={verifierResult.revoked} expired={verifierResult.expired} />
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                      <p>Issuer: {shortenAddress(verifierResult.issuer_wallet)}</p>
                      <p>Wallet: {shortenAddress(verifierResult.candidate_wallet)}</p>
                      <p>Degree: {verifierResult.degree}</p>
                      <p>Institution: {verifierResult.institution}</p>
                      <p>Issued: {formatTimestamp(verifierResult.issue_date)}</p>
                      <p>Expires: {formatTimestamp(verifierResult.expiry_date)}</p>
                    </div>
                    <details className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-emerald-200">View IPFS payload</summary>
                      <pre className="mt-3 overflow-auto text-xs text-slate-300">{JSON.stringify(verifierResult.ipfs_payload, null, 2)}</pre>
                    </details>
                  </article>
                )}

                {verifierResult?.credentials && (
                  <div className="space-y-4">
                    {verifierResult.credentials.map((credential) => (
                      <article key={credential.credential_id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Wallet result</p>
                            <h4 className="text-lg font-semibold">{credential.candidate_name}</h4>
                          </div>
                          <StatusBadge valid={credential.valid} revoked={credential.revoked} expired={credential.expired} />
                        </div>
                        <p className="mt-3 text-sm text-slate-300">Credential ID: {credential.credential_id}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
