"use client";

import { useState, useEffect } from "react";
import { ThemeButton, CancelButton } from "@/components/ui/theme-button";
import { Save } from "lucide-react";
import Modal from "@/components/ui/modal";
import { type Account, type AccountFormData } from "@/hooks/useAccounts";
interface AccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (account: AccountFormData) => void;
  account?: Account | null; // null for new, Account for edit
  loading?: boolean;
}

export default function AccountForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  account, 
  loading = false 
}: AccountFormProps) {
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    type: 'Individual',
    institution: '',
    account_number: '',
    description: ''
  });

  const isEditing = !!account?.id;

  // Reset form when account changes or form opens
  useEffect(() => {
    if (account) {
      setFormData(account);
    } else {
      setFormData({
        name: '',
        type: 'Individual',
        institution: '',
        account_number: '',
        description: ''
      });
    }
  }, [account, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim() && formData.institution.trim()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: keyof AccountFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${isEditing ? 'Edit' : 'Add New'} Account`}
      description={isEditing ? 'Update your account information' : 'Create a new trading account'}
      maxWidth="md"
    >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Account Name */}
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Account Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded-lg text-white placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Main Trading Account"
              />
            </div>

            {/* Account Type */}
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Account Type *
              </label>
                             <select
                 value={formData.type}
                 onChange={(e) => handleInputChange('type', e.target.value)}
                 className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
               >
                 <option value="Individual">Individual</option>
                 <option value="Corporate">Corporate</option>
                 <option value="SMSF">SMSF (Self-Managed Super Fund)</option>
                 <option value="IRA">IRA</option>
                 <option value="401k">401k</option>
                 <option value="Roth IRA">Roth IRA</option>
                 <option value="Traditional IRA">Traditional IRA</option>
                 <option value="Other">Other</option>
               </select>
            </div>

            {/* Institution */}
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Institution *
              </label>
              <input
                type="text"
                value={formData.institution}
                onChange={(e) => handleInputChange('institution', e.target.value)}
                required
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded-lg text-white placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Fidelity, TD Ameritrade"
              />
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Account Number
              </label>
              <input
                type="text"
                value={formData.account_number}
                onChange={(e) => handleInputChange('account_number', e.target.value)}
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded-lg text-white placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional account number"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[#b3b3b3] mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-[#2d2d2d] border border-[#404040] rounded-lg text-white placeholder-[#666666] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Optional description or notes"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <ThemeButton
                type="submit"
                icon={Save}
                disabled={loading || !formData.name.trim() || !formData.institution.trim()}
                className="flex-1"
              >
                {loading ? 'Saving...' : (isEditing ? 'Update' : 'Create')}
              </ThemeButton>
              <CancelButton
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </CancelButton>
            </div>
          </form>
    </Modal>
  );
}
