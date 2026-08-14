import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Edit2, Save, X, RefreshCw, Box, Search, Package, Settings, LogOut, CheckCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './index.css';

// Initialize Supabase Client
const supabaseUrl = 'https://ibflwpfzhqudjautjpaq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliZmx3cGZ6aHF1ZGphdXRqcGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODE4MzMsImV4cCI6MjEwMDk1NzgzM30.NNC4fklFrVO-j682C5IBtWsab5F-6jjRNfogxOmKG4U';
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [activeTab, setActiveTab] = useState('inventory');
  
  // API URL for local development vs production
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [waStatus, setWaStatus] = useState({ connected: false, authenticating: false, qr: null });
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetchStock();
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_items' },
        (payload) => {
          console.log('Change received!', payload);
          fetchStock();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Poll WhatsApp Status when settings are open
  useEffect(() => {
    let interval;
    if (isSettingsOpen) {
      const fetchStatus = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/whatsapp/status`);
          const data = await res.json();
          setWaStatus(data);
        } catch (err) {
          console.error('Failed to fetch WhatsApp status');
        }
      };
      fetchStatus();
      interval = setInterval(fetchStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [isSettingsOpen]);

  const handleDisconnectWhatsApp = async () => {
    setIsResetting(true);
    try {
      await fetch(`${API_BASE_URL}/api/whatsapp/logout`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to disconnect');
    }
    setIsResetting(false);
  };

  const fetchStock = async () => {
    try {
      const { data, error } = await supabase
        .from('stock_items')
        .select('*')
        .order('grn_date', { ascending: false });
        
      if (error) throw error;
      setStockItems(data || []);
    } catch (error) {
      console.error('Error fetching stock:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (item) => {
    setEditingItem({ ...item }); // Clone object
    setIsModalOpen(true);
  };

  const closeEditModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('stock_items')
        .update({ 
          closing_qty: editingItem.closing_qty,
          lot_no: editingItem.lot_no,
          rate_type: editingItem.rate_type
        })
        .eq('id', editingItem.id);

      if (error) throw error;
      
      // Realtime listener will handle updating the UI, but we can optimistically update
      fetchStock(); 
      closeEditModal();
    } catch (error) {
      console.error('Error updating item:', error.message);
      alert('Failed to update stock. Please try again.');
    }
  };

  const filteredItems = stockItems.filter(item => 
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.grn_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.lot_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brand.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <header className="header">
        <h1>
          <span><Box size={32} /></span>
          Lords and Kings Admin
        </h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="action-btn" onClick={fetchStock}>
            <RefreshCw size={18} /> Refresh
          </button>
          <button className="action-btn" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={18} /> Settings
          </button>
        </div>
      </header>

      <div className="glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search by Product, GRN, or Lot No..." 
            style={{ paddingLeft: '2.5rem', background: 'rgba(255,255,255,0.05)' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           <Package size={18} /> {filteredItems.length} Items Found
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div className="loader">
            <div className="spinner"></div> Loading Stock Data...
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>GRN No</th>
                <th>Product</th>
                <th>Brand / Variety</th>
                <th>Lot No</th>
                <th>Rate Type</th>
                <th>Qty</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id}>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{item.grn_number}</td>
                  <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                  <td>
                    <span className="badge">{item.brand}</span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{item.variety}</div>
                  </td>
                  <td>{item.lot_no}</td>
                  <td>{item.rate_type}</td>
                  <td>
                    <span className={`qty-pill ${item.closing_qty <= 10 ? 'low' : ''}`}>
                      {Number(item.closing_qty).toFixed(2)} {item.uom}
                    </span>
                  </td>
                  <td style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="action-btn edit" onClick={() => openEditModal(item)}>
                      <Edit2 size={16} /> Edit
                    </button>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No matching stock items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      <div className={`modal-overlay ${isModalOpen ? 'active' : ''}`}>
        <div className="modal glass-panel">
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Edit Stock Item</h2>
            <button className="action-btn" onClick={closeEditModal} style={{ border: 'none', padding: '0.5rem' }}>
              <X size={20} />
            </button>
          </div>
          
          {editingItem && (
            <form onSubmit={handleUpdateStock}>
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{editingItem.grn_number}</div>
                <div style={{ fontWeight: 500, fontSize: '1.1rem', marginTop: '0.2rem' }}>{editingItem.product_name} ({editingItem.brand})</div>
              </div>

              <div className="form-group">
                <label>Closing Quantity ({editingItem.uom})</label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-input" 
                  value={editingItem.closing_qty}
                  onChange={(e) => setEditingItem({...editingItem, closing_qty: e.target.value})}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Lot Number</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editingItem.lot_no}
                    onChange={(e) => setEditingItem({...editingItem, lot_no: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Rate Type</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editingItem.rate_type}
                    onChange={(e) => setEditingItem({...editingItem, rate_type: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="action-btn" onClick={closeEditModal}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Save size={18} /> Save Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <div className={`modal-overlay ${isSettingsOpen ? 'active' : ''}`}>
        <div className="modal glass-panel">
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Bot Settings</h2>
            <button className="action-btn" onClick={() => setIsSettingsOpen(false)} style={{ border: 'none', padding: '0.5rem' }}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>WhatsApp Connection</h3>
            
            {waStatus.connected ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: 'var(--success)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', margin: '0 auto 1rem'
                }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Successfully Connected</h3>
                <p style={{ color: 'var(--text-muted)' }}>Your WhatsApp bot is currently active and listening for messages.</p>
                <button 
                  className="action-btn" 
                  onClick={handleDisconnectWhatsApp}
                  disabled={isResetting}
                  style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)', marginTop: '1.5rem' }}
                >
                  <LogOut size={16} /> {isResetting ? 'Disconnecting...' : 'Disconnect & Link New Account'}
                </button>
              </div>
            ) : waStatus.authenticating ? (
              <div className="loader" style={{ minHeight: '150px' }}>
                <div className="spinner"></div> Authenticating with WhatsApp...
              </div>
            ) : waStatus.qr ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Scan this QR code with your WhatsApp app to link a new device.</p>
                <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', display: 'inline-block' }}>
                   <QRCodeSVG value={waStatus.qr} size={200} />
                </div>
              </div>
            ) : (
              <div className="loader" style={{ minHeight: '150px' }}>
                <div className="spinner"></div> {isResetting ? 'Resetting Session...' : 'Loading Status...'}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
