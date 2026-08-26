import React, { useState } from 'react';
import { Settings, ShieldAlert, Check, X, Shield, Lock, Power, Save } from 'lucide-react';
import { AdminUser, AdminRole, AdminPermissions, DEFAULT_ADMIN_PERMISSIONS } from './types';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { cloudStore } from './lib/cloudStore';

interface AccountControlManagerProps {
  adminUsers: AdminUser[];
  setAdminUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>;
  currentAdmin: AdminUser;
  onClose: () => void;
}

export default function AccountControlManager({ adminUsers, setAdminUsers, currentAdmin, onClose }: AccountControlManagerProps) {
  const [draftAdminUsers, setDraftAdminUsers] = useState<AdminUser[]>(() => JSON.parse(JSON.stringify(adminUsers)));
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // If roles are empty for existing, assume Owner for current, and maybe Manager for others.
  const users = draftAdminUsers.map(u => ({
    ...u,
    role: u.role || (u.id === currentAdmin.id ? 'Owner' : 'Manager'),
    permissions: u.permissions || JSON.parse(JSON.stringify(DEFAULT_ADMIN_PERMISSIONS))
  }));

  const selectedUser = users.find(u => u.id === selectedUserId);

  const updateUserRole = (id: string, role: AdminRole) => {
    setDraftAdminUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
  };

  const togglePermission = (id: string, category: keyof AdminPermissions, key: string) => {
    setDraftAdminUsers(prev => prev.map(u => {
      if (u.id === id) {
        const perms = u.permissions || JSON.parse(JSON.stringify(DEFAULT_ADMIN_PERMISSIONS));
        return {
          ...u,
          permissions: {
            ...perms,
            [category]: {
              ...(perms[category] as any),
              [key]: !(perms[category] as any)[key]
            }
          }
        };
      }
      return u;
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setAdminUsers(draftAdminUsers);
      await cloudStore.saveSetting('adminUsers', draftAdminUsers);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const isOwner = currentAdmin.role === 'Owner' || !currentAdmin.role;

  if (selectedUser) {
    if (selectedUser.role === 'Owner') {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dash-bg)]/60 p-4">
          <div className="bg-[var(--dash-bg)] w-full max-w-sm rounded-xl overflow-hidden border border-[var(--dash-border)]">
            <div className="p-4 border-b border-[var(--dash-border)] flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Owner Permissions</h2>
              <button onClick={() => setSelectedUserId(null)} className="text-gray-400"><X size={20}/></button>
            </div>
            <div className="p-6 text-center text-gray-400">
               Owners have full access to all systems.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex justify-end bg-[var(--dash-bg)]/60 p-4 sm:p-0">
        <div className="bg-[var(--dash-bg)] w-full max-w-lg h-full overflow-y-auto sm:border-l border-[var(--dash-border)] flex flex-col">
          <div className="p-4 border-b border-[var(--dash-border)] flex items-center sticky top-0 bg-[var(--dash-bg)] z-10">
             <button onClick={() => setSelectedUserId(null)} className="mr-3 text-gray-400 p-2"><X size={24}/></button>
             <div>
               <h2 className="text-lg font-bold text-white">{selectedUser.email}</h2>
               <p className="text-xs text-gray-400">Permissions Control ({selectedUser.role})</p>
             </div>
          </div>

          <div className="p-6 space-y-8 flex-1">
            <PermissionGroup 
              title="Main Sections" 
              category="sections"
              perms={selectedUser.permissions!.sections}
              onChange={(key) => togglePermission(selectedUser.id, 'sections', key)}
              disabled={!isOwner}
            />
            <PermissionGroup 
              title="Products Data" 
              category="product"
              perms={selectedUser.permissions!.product}
              onChange={(key) => togglePermission(selectedUser.id, 'product', key)}
              disabled={!isOwner}
            />
            <PermissionGroup 
              title="Order Details" 
              category="order"
              perms={selectedUser.permissions!.order}
              onChange={(key) => togglePermission(selectedUser.id, 'order', key)}
              disabled={!isOwner}
            />
            <PermissionGroup 
              title="Dashboard Analytics" 
              category="analytics"
              perms={selectedUser.permissions!.analytics}
              onChange={(key) => togglePermission(selectedUser.id, 'analytics', key)}
              disabled={!isOwner}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex bg-[var(--dash-bg)]/80 justify-center">
      <div className="w-full max-w-4xl h-full flex flex-col bg-[#050b09]">
        <div className="p-4 border-b border-[var(--dash-border)] flex items-center justify-between bg-[var(--dash-bg)]">
          <div className="flex items-center">
            <button onClick={onClose} className="text-gray-400 p-2 mr-2 hover:text-white"><X size={24}/></button>
            <h1 className="text-xl font-bold text-white flex items-center gap-2"><Shield size={20} className="text-emerald-400"/> Account Control</h1>
          </div>
          {isOwner && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{ backgroundColor: 'var(--theme-primary, #ff4d6d)', color: '#ffffff' }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs md:text-sm hover:brightness-95 active:scale-95 transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : saved ? (
                <Check size={16} className="text-white" />
              ) : (
                <Save size={16} />
              )}
              <span>{saved ? 'Saved' : 'Save Changes'}</span>
            </button>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-4">
            {users.map(user => (
              <div key={user.id} className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-medium text-lg">{user.email}</h3>
                    {user.id === currentAdmin.id && <span className="bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">You</span>}
                    {user.isBlocked && <span className="bg-red-500/10 text-red-500 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">Blocked</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Role: <span className="text-gray-300">{user.role}</span></span>
                    <span>Last Login: <span className="text-gray-300">{user.loginTimestamp ? format(user.loginTimestamp, 'dd MMM, hh:mm a') : 'Never'}</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {isOwner && user.id !== currentAdmin.id && (
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value as AdminRole)}
                      className="bg-[var(--dash-card)] border border-[var(--dash-border)] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#fafafa] transition-colors"
                    >
                      <option value="Owner">Owner</option>
                      <option value="Manager">Manager</option>
                      <option value="Staff">Staff</option>
                    </select>
                  )}
                  
                  <button
                    onClick={() => setSelectedUserId(user.id)}
                    className="flex-1 sm:flex-none bg-[var(--dash-card)] hover:bg-[var(--dash-border)] border border-[var(--dash-border)] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center"
                  >
                    Permissions
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionGroup({ title, category, perms, onChange, disabled }: { title: string, category: string, perms: Record<string, boolean>, onChange: (key: string) => void, disabled: boolean }) {
  const keys = Object.keys(perms);
  
  return (
    <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl overflow-hidden">
      <div className="bg-[var(--dash-bg)] px-4 py-3 border-b border-[var(--dash-border)]">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
      </div>
      <div className="divide-y divide-[var(--dash-border)]">
        {keys.map(k => (
          <div key={k} className="flex items-center justify-between p-4 bg-[var(--dash-bg)]/50 hover:bg-[var(--dash-bg)] transition-colors">
            <span className="text-gray-300 text-sm capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
            
            <button
              disabled={disabled}
              onClick={() => onChange(k)}
              className={cn("relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none group",
                disabled ? "opacity-50 cursor-not-allowed" : "",
                perms[k] ? 'bg-[#fafafa]' : 'bg-gray-600'
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  perms[k] ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
