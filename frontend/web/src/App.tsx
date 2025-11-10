import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface CharityProject {
  id: string;
  name: string;
  description: string;
  encryptedNeed: string;
  publicValue1: number;
  publicValue2: number;
  creator: string;
  timestamp: number;
  isVerified: boolean;
  decryptedValue: number;
  allocationAmount: number;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<CharityProject[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newProjectData, setNewProjectData] = useState({ 
    name: "", 
    description: "", 
    needAmount: "",
    urgency: ""
  });
  const [selectedProject, setSelectedProject] = useState<CharityProject | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVerified, setFilterVerified] = useState(false);
  const [stats, setStats] = useState({ total: 0, verified: 0, totalAllocated: 0 });

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [contractAddress, setContractAddress] = useState("");

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected || isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        console.error('FHEVM initialization failed:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const projectsList: CharityProject[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          projectsList.push({
            id: businessId,
            name: businessData.name,
            description: businessData.description,
            encryptedNeed: businessId,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            creator: businessData.creator,
            timestamp: Number(businessData.timestamp),
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0,
            allocationAmount: Math.floor(Number(businessData.publicValue1) * 100 + Number(businessData.publicValue2) * 50)
          });
        } catch (e) {
          console.error('Error loading business data:', e);
        }
      }
      
      setProjects(projectsList);
      
      const total = projectsList.length;
      const verified = projectsList.filter(p => p.isVerified).length;
      const totalAllocated = projectsList.reduce((sum, p) => sum + p.allocationAmount, 0);
      setStats({ total, verified, totalAllocated });
      
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load data" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createProject = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingProject(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating project with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const needAmount = parseInt(newProjectData.needAmount) || 0;
      const businessId = `charity-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, needAmount);
      
      const tx = await contract.createBusinessData(
        businessId,
        newProjectData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        parseInt(newProjectData.urgency) || 1,
        0,
        newProjectData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction confirmation..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "Project created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowCreateModal(false);
      setNewProjectData({ name: "", description: "", needAmount: "", urgency: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingProject(false); 
    }
  };

  const decryptData = async (businessId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(businessId);
      if (businessData.isVerified) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data already verified on-chain" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        return Number(businessData.decryptedValue) || 0;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(businessId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(businessId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "Data verified successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Data is already verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
  };

  const callIsAvailable = async () => {
    try {
      const contract = await getContractWithSigner();
      if (!contract) return;
      
      setTransactionStatus({ visible: true, status: "pending", message: "Checking availability..." });
      const result = await contract.isAvailable();
      
      setTransactionStatus({ visible: true, status: "success", message: "Contract is available!" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Availability check failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterVerified || project.isVerified;
    return matchesSearch && matchesFilter;
  });

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>善款隱私分配 🔐</h1>
            <p>Private Charity Allocation with FHE</p>
          </div>
          <ConnectButton />
        </header>
        
        <div className="connection-prompt">
          <div className="prompt-content">
            <div className="prompt-icon">🤝</div>
            <h2>Connect to Protect Privacy</h2>
            <p>Connect your wallet to start allocating charity funds with full privacy protection using FHE technology</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE System...</p>
        <p className="loading-note">Securing your charity allocations</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading charity projects...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-section">
          <h1>🤝 善款隱私分配</h1>
          <p>FHE-Protected Charity Allocation</p>
        </div>
        
        <div className="header-controls">
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>
          
          <div className="filter-toggle">
            <label>
              <input 
                type="checkbox" 
                checked={filterVerified}
                onChange={(e) => setFilterVerified(e.target.checked)}
              />
              Verified Only
            </label>
          </div>
          
          <button className="test-btn" onClick={callIsAvailable}>
            Test Contract
          </button>
          
          <button 
            className="create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            + New Project
          </button>
          
          <ConnectButton />
        </div>
      </header>

      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.verified}</div>
          <div className="stat-label">Verified</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${stats.totalAllocated.toLocaleString()}</div>
          <div className="stat-label">Total Allocated</div>
        </div>
      </div>

      <main className="main-content">
        <div className="projects-grid">
          {filteredProjects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No projects found</h3>
              <p>{projects.length === 0 ? "Create the first charity project" : "Try adjusting your search filters"}</p>
              {projects.length === 0 && (
                <button 
                  className="create-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Project
                </button>
              )}
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div 
                key={project.id} 
                className={`project-card ${project.isVerified ? 'verified' : ''}`}
                onClick={() => setSelectedProject(project)}
              >
                <div className="card-header">
                  <h3>{project.name}</h3>
                  {project.isVerified && <span className="verified-badge">✅ Verified</span>}
                </div>
                
                <p className="project-desc">{project.description}</p>
                
                <div className="project-meta">
                  <div className="meta-item">
                    <span>Urgency:</span>
                    <strong>{project.publicValue1}/10</strong>
                  </div>
                  <div className="meta-item">
                    <span>Allocation:</span>
                    <strong>${project.allocationAmount}</strong>
                  </div>
                </div>
                
                <div className="data-status">
                  {project.isVerified ? (
                    <div className="decrypted-data">
                      <span>Need Amount: ${project.decryptedValue}</span>
                    </div>
                  ) : (
                    <div className="encrypted-data">
                      <span>🔒 FHE Encrypted</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="create-modal">
            <div className="modal-header">
              <h2>New Charity Project</h2>
              <button onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="fhe-notice">
                <strong>FHE Protection Active</strong>
                <p>Need amount will be encrypted using Zama FHE technology</p>
              </div>
              
              <div className="form-group">
                <label>Project Name</label>
                <input 
                  type="text" 
                  value={newProjectData.name}
                  onChange={(e) => setNewProjectData({...newProjectData, name: e.target.value})}
                  placeholder="Enter project name..."
                />
              </div>
              
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={newProjectData.description}
                  onChange={(e) => setNewProjectData({...newProjectData, description: e.target.value})}
                  placeholder="Describe the charity purpose..."
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label>Need Amount (Integer)</label>
                <input 
                  type="number" 
                  value={newProjectData.needAmount}
                  onChange={(e) => setNewProjectData({...newProjectData, needAmount: e.target.value})}
                  placeholder="Enter amount needed..."
                  min="0"
                  step="1"
                />
                <div className="input-hint">FHE Encrypted Integer</div>
              </div>
              
              <div className="form-group">
                <label>Urgency Level (1-10)</label>
                <input 
                  type="number" 
                  value={newProjectData.urgency}
                  onChange={(e) => setNewProjectData({...newProjectData, urgency: e.target.value})}
                  placeholder="1-10"
                  min="1"
                  max="10"
                />
                <div className="input-hint">Public Data</div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                onClick={() => setShowCreateModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={createProject}
                disabled={creatingProject || isEncrypting || !newProjectData.name || !newProjectData.needAmount}
                className="submit-btn"
              >
                {creatingProject || isEncrypting ? "Encrypting..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProject && (
        <ProjectDetailModal 
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onDecrypt={decryptData}
          isDecrypting={fheIsDecrypting}
        />
      )}

      {transactionStatus.visible && (
        <div className="transaction-toast">
          <div className={`toast-content ${transactionStatus.status}`}>
            <div className="toast-icon">
              {transactionStatus.status === "pending" && "⏳"}
              {transactionStatus.status === "success" && "✅"}
              {transactionStatus.status === "error" && "❌"}
            </div>
            <span>{transactionStatus.message}</span>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-content">
          <p>Powered by Zama FHE Technology - Protecting Privacy in Charity</p>
          <div className="footer-links">
            <span>🔐 Fully Homomorphic Encryption</span>
            <span>💚 Ethical Allocation</span>
            <span>🛡️ Privacy First</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

const ProjectDetailModal: React.FC<{
  project: CharityProject;
  onClose: () => void;
  onDecrypt: (id: string) => Promise<number | null>;
  isDecrypting: boolean;
}> = ({ project, onClose, onDecrypt, isDecrypting }) => {
  const [localDecrypted, setLocalDecrypted] = useState<number | null>(null);

  const handleDecrypt = async () => {
    if (project.isVerified) return;
    
    const result = await onDecrypt(project.id);
    if (result !== null) {
      setLocalDecrypted(result);
    }
  };

  const allocationScore = Math.min(100, Math.floor(
    (project.publicValue1 * 8) + 
    ((project.isVerified ? project.decryptedValue : localDecrypted || 0) / 1000) +
    (project.allocationAmount / 100)
  ));

  return (
    <div className="modal-overlay">
      <div className="detail-modal">
        <div className="modal-header">
          <h2>{project.name}</h2>
          <button onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="project-info">
            <p className="project-description">{project.description}</p>
            
            <div className="info-grid">
              <div className="info-item">
                <label>Creator</label>
                <span>{project.creator.substring(0, 8)}...{project.creator.substring(34)}</span>
              </div>
              <div className="info-item">
                <label>Created</label>
                <span>{new Date(project.timestamp * 1000).toLocaleDateString()}</span>
              </div>
              <div className="info-item">
                <label>Urgency Level</label>
                <span>{project.publicValue1}/10</span>
              </div>
              <div className="info-item">
                <label>Allocation Amount</label>
                <span>${project.allocationAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="encryption-section">
            <h3>FHE Data Protection</h3>
            <div className="encryption-status">
              {project.isVerified ? (
                <div className="status-verified">
                  <span className="status-icon">✅</span>
                  <div>
                    <strong>On-Chain Verified</strong>
                    <p>Need amount: ${project.decryptedValue}</p>
                  </div>
                </div>
              ) : localDecrypted !== null ? (
                <div className="status-decrypted">
                  <span className="status-icon">🔓</span>
                  <div>
                    <strong>Locally Decrypted</strong>
                    <p>Need amount: ${localDecrypted}</p>
                  </div>
                </div>
              ) : (
                <div className="status-encrypted">
                  <span className="status-icon">🔐</span>
                  <div>
                    <strong>FHE Encrypted</strong>
                    <p>Need amount protected by homomorphic encryption</p>
                  </div>
                </div>
              )}
            </div>
            
            {!project.isVerified && (
              <button 
                onClick={handleDecrypt}
                disabled={isDecrypting}
                className="decrypt-btn"
              >
                {isDecrypting ? "Verifying..." : "Verify Decryption"}
              </button>
            )}
          </div>

          <div className="allocation-section">
            <h3>Allocation Score</h3>
            <div className="score-meter">
              <div 
                className="score-fill" 
                style={{ width: `${allocationScore}%` }}
              >
                <span>{allocationScore}%</span>
              </div>
            </div>
            <div className="score-factors">
              <div className="factor">
                <span>Urgency: {project.publicValue1}/10</span>
              </div>
              <div className="factor">
                <span>Need: ${project.isVerified ? project.decryptedValue : localDecrypted || 'Encrypted'}</span>
              </div>
              <div className="factor">
                <span>Allocation: ${project.allocationAmount}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

export default App;

