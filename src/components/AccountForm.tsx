"use client";

import { useState, useEffect, useRef } from "react";
import { ThemeButton, CancelButton } from "@/components/ui/theme-button";
import { Save } from "lucide-react";
import Modal from "@/components/ui/modal";
import { type Account, type AccountFormData } from "@/types/database";
interface AccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (account: AccountFormData) => void;
  account?: Account | null; // null for new, Account for edit
  loading?: boolean;
  existingAccounts?: Account[]; // For uniqueness validation
}

export default function AccountForm({ 
  isOpen, 
  onClose, 
  onSubmit, 
  account, 
  loading = false,
  existingAccounts = []
}: AccountFormProps) {
  const [formData, setFormData] = useState<AccountFormData>({
    name: '',
    type: 'Individual',
    institution: '',
    account_number: '',
    description: ''
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const nameValidationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    // Clear validation errors when form opens
    setValidationErrors({});
  }, [account, isOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (nameValidationTimeoutRef.current) {
        clearTimeout(nameValidationTimeoutRef.current);
      }
    };
  }, []);

  // Validate account name uniqueness
  const validateAccountName = (name: string): string | null => {
    if (!name.trim()) return 'Account name is required';
    
    const trimmedName = name.trim();
    const isDuplicate = existingAccounts.some(existing => 
      existing.name.toLowerCase() === trimmedName.toLowerCase() && 
      existing.id !== account?.id // Don't check against the account being edited
    );
    
    if (isDuplicate) {
      return 'An account with this name already exists';
    }
    
    return null;
  };

  // Validate form data
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Validate account name
    const nameError = validateAccountName(formData.name);
    if (nameError) {
      errors.name = nameError;
    }
    
    // Validate institution
    if (!formData.institution.trim()) {
      errors.institution = 'Institution is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: keyof AccountFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Real-time validation for account name
  const handleNameChange = (value: string) => {
    handleInputChange('name', value);
    
    // Clear any existing timeout
    if (nameValidationTimeoutRef.current) {
      clearTimeout(nameValidationTimeoutRef.current);
    }
    
    // Validate name in real-time (with debounce)
    nameValidationTimeoutRef.current = setTimeout(() => {
      const nameError = validateAccountName(value);
      if (nameError) {
        setValidationErrors(prev => ({
          ...prev,
          name: nameError
        }));
      } else {
        // Clear error if validation passes
        setValidationErrors(prev => ({
          ...prev,
          name: ''
        }));
      }
    }, 300);
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
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className={`w-full px-3 py-2 bg-[#2d2d2d] border rounded-lg text-white placeholder-[#666666] focus:outline-none focus:ring-2 ${
                  validationErrors.name 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-[#404040] focus:ring-blue-500'
                }`}
                placeholder="e.g., Main Trading Account"
              />
              {validationErrors.name && (
                <p className="mt-1 text-sm text-red-400">{validationErrors.name}</p>
              )}
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
                className={`w-full px-3 py-2 bg-[#2d2d2d] border rounded-lg text-white placeholder-[#666666] focus:outline-none focus:ring-2 ${
                  validationErrors.institution 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-[#404040] focus:ring-blue-500'
                }`}
                placeholder="e.g., Fidelity, TD Ameritrade"
              />
              {validationErrors.institution && (
                <p className="mt-1 text-sm text-red-400">{validationErrors.institution}</p>
              )}
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
