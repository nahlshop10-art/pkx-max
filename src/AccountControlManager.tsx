import React, { useState } from 'react';
import { ChevronLeft, Shield, Lock, Power, Save, Check, X, ShieldAlert, UserCheck, ShieldCheck } from 'lucide-react';
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
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 600);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const isOwner = currentAdmin.role === 'Owner' || !currentAdmin.role;

  if (selectedUser) {
    return (
      <div className="fixed inset-0 z-[110] bg-[#070b14]/90 backdrop-blur-md flex justify-end">
        <div className="bg-[#0b1120] w-full max-w-lg h-full overflow-y-auto border-l border-[#1e293b] flex flex-col shadow-2xl">
          <div className="p-4 md:p-5 border-b border-[#1e293b] flex items-center justify-between sticky top-0 bg-[#0b1120]/90 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedUserId(null)} 
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white truncate max-w-[220px]">{selectedUser.email}</h2>
                <p className="text-[11px] text-slate-400 font-medium">Role: {selectedUser.role} Access</p>
              </div>
            </div>
            <button 
              onClick={() => setSelectedUserId(null)}
              className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-colors"
            >
              Done
            </button>
          </div>

          <div className="p-4 md:p-6 space-y-6 flex-1">
            {selectedUser.role === 'Owner' ? (
              <div className="bg-[#070b14] border border-[#1e293b] rounded-2xl p-8 text-center space-y-3">
                <ShieldCheck size={36} className="mx-auto text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Full Administrator Privileges</h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                  Owner accounts have unrestricted access to all dashboard sections, APIs, and settings.
                </p>
              </div>
            ) : (
              <>
                <PermissionGroup 
                  title="Dashboard Sections" 
                  category="sections"
                  perms={selectedUser.permissions!.sections}
                  onChange={(key) => togglePermission(selectedUser.id, 'sections', key)}
                  disabled={!isOwner}
                />
                <PermissionGroup 
                  title="Products Permissions" 
                  category="product"
                  perms={selectedUser.permissions!.product}
                  onChange={(key) => togglePermission(selectedUser.id, 'product', key)}
                  disabled={!isOwner}
                />
                <PermissionGroup 
                  title="Orders & Sales" 
                  category="order"
                  perms={selectedUser.permissions!.order}
                  onChange={(key) => togglePermission(selectedUser.id, 'order', key)}
                  disabled={!isOwner}
                />
                <PermissionGroup 
                  title="Analytics & Reports" 
                  category="analytics"
                  perms={selectedUser.permissions!.analytics}
                  onChange={(key) => togglePermission(selectedUser.id, 'analytics', key)}
                  disabled={!isOwner}
                />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#070b14] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3.5 md:px-8 md:py-4 border-b border-[#1e293b]/70 bg-[#070b14]/90 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0"
            title="Go back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <Shield size={20} />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Team & Role Permissions
              </h1>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Manage staff roles, granular section access, and employee accounts
              </p>
            </div>
          </div>
        </div>

        {isOwner && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-pink-500 hover:bg-pink-600 active:scale-95 transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50 cursor-pointer shrink-0"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : saved ? (
              <Check size={16} className="text-white stroke-[3]" />
            ) : (
              <Save size={16} />
            )}
            <span>{saved ? 'Saved' : isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        )}
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 max-w-3xl mx-auto w-full pb-28 overscroll-y-contain custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="space-y-3">
          {users.map(user => (
            <div 
              key={user.id} 
              className="bg-[#0b1120] border border-[#1e293b]/70 rounded-2xl p-4 md:p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-slate-700"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="text-sm md:text-base font-bold text-white truncate">{user.email}</h3>
                  {user.id === currentAdmin.id && (
                    <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                      You
                    </span>
                  )}
                  {user.isBlocked && (
                    <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                      Blocked
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Role: <strong className="text-slate-200">{user.role}</strong></span>
                  <span>•</span>
                  <span>Last Login: <span className="text-slate-300">{user.loginTimestamp ? format(user.loginTimestamp, 'dd MMM, hh:mm a') : 'Never'}</span></span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {isOwner && user.id !== currentAdmin.id && (
                  <select
                    value={user.role}
                    onChange={(e) => updateUserRole(user.id, e.target.value as AdminRole)}
                    className="bg-[#070b14] border border-[#1e293b] text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-pink-500 transition-colors"
                  >
                    <option value="Owner">Owner</option>
                    <option value="Manager">Manager</option>
                    <option value="Staff">Staff</option>
                  </select>
                )}
                
                <button
                  onClick={() => setSelectedUserId(user.id)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-white transition-all active:scale-95"
                >
                  Permissions
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-0 bg-[#070b14]/90 backdrop-blur-md border-t border-[#1e293b] p-3.5 md:p-4 flex items-center justify-between z-20 shrink-0">
        <span className="text-xs text-slate-500">
          Only Store Owners can alter role permissions
        </span>
        {isOwner && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-pink-500 hover:bg-pink-600 active:scale-95 transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check size={16} className="stroke-[3]" />
            )}
            Save Changes
          </button>
        )}
      </div>
    </div>
  );
}

function PermissionGroup({ title, category, perms, onChange, disabled }: { title: string, category: string, perms: Record<string, boolean>, onChange: (key: string) => void, disabled: boolean }) {
  const keys = Object.keys(perms);
  
  return (
    <div className="bg-[#070b14] border border-[#1e293b] rounded-2xl overflow-hidden shadow-md">
      <div className="px-4 py-3 border-b border-[#1e293b] bg-[#0b1120]/50">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="divide-y divide-[#1e293b]/50">
        {keys.map(k => (
          <div key={k} className="flex items-center justify-between p-3.5 px-4 hover:bg-white/[0.02] transition-colors">
            <span className="text-slate-300 text-xs md:text-sm capitalize font-medium">{k.replace(/([A-Z])/g, ' $1')}</span>
            
            <button
              disabled={disabled}
              onClick={() => onChange(k)}
              className={cn(
                "w-10 h-5.5 rounded-full relative transition-all duration-200 p-0.5 focus:outline-none shrink-0",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                perms[k] ? 'bg-emerald-500 shadow-sm shadow-emerald-500/20' : 'bg-slate-700/60'
              )}
            >
              <div
                className={cn(
                  "w-4.5 h-4.5 rounded-full bg-white transition-all shadow-sm",
                  perms[k] ? 'translate-x-4.5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

