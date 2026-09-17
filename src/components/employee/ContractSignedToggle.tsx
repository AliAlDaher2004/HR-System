'use client';

import React, { useState, useTransition } from 'react';
import { FileCheck, FileX, Check, X } from 'lucide-react';

interface ContractSignedToggleProps {
  contractId: string;
  contractSigned: boolean;
  contractSignedDate?: string | null;
  startDate: string;
  userRole: string;
  toggleContractSignedAction: (formData: FormData) => Promise<void>;
}

export function ContractSignedToggle({
  contractId,
  contractSigned: initialSigned,
  contractSignedDate: initialDate,
  startDate,
  userRole,
  toggleContractSignedAction,
}: ContractSignedToggleProps) {
  const [signed, setSigned] = useState(initialSigned);
  const [signedDate, setSignedDate] = useState(initialDate || startDate);
  const [isPending, startTransition] = useTransition();

  const canManage = ['ADMIN', 'HR'].includes(userRole);

  function handleToggleChange(newSigned: boolean) {
    if (!canManage || isPending) return;

    setSigned(newSigned);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('contractId', contractId);
        formData.set('contractSigned', newSigned ? 'true' : 'false');
        formData.set('contractSignedDate', newSigned ? (signedDate || startDate) : '');

        await toggleContractSignedAction(formData);
      } catch (err: any) {
        setSigned(!newSigned); // Revert on failure
        alert(err.message || 'فشل تحديث حالة توقيع العقد');
      }
    });
  }

  return (
    <div className="flex items-center gap-3 bg-[#ECE9D8] win-raised p-2 rounded text-xs select-none">
      <div className="flex items-center gap-1.5 font-bold">
        {signed ? (
          <span className="flex items-center gap-1 text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded text-[11px]">
            <FileCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>موقع</span>
            {signedDate && <span className="font-mono text-[10px] font-normal">({signedDate})</span>}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded text-[11px]">
            <FileX className="w-3.5 h-3.5 text-rose-700" />
            <span>غير موقع</span>
          </span>
        )}
      </div>

      {canManage && (
        <div className="flex items-center gap-2 mr-auto border-r border-[#808080] pr-3">
          <span className="text-[11px] font-bold text-slate-700">توقيع العقد:</span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleToggleChange(!signed)}
            className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              signed ? 'bg-emerald-600' : 'bg-slate-400'
            }`}
            title={signed ? 'تغيير إلى غير موقع' : 'تغيير إلى موقع'}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                signed ? 'translate-x-0' : '-translate-x-5'
              }`}
            />
          </button>
          <span className="text-[10px] font-bold text-black font-mono">
            {signed ? 'ON' : 'OFF'}
          </span>
        </div>
      )}
    </div>
  );
}
