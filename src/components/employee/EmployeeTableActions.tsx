'use client';

import React from 'react';
import Link from 'next/link';
import { EditEmployeeModal } from './EditEmployeeModal';

interface EmployeeTableActionsProps {
  employee: any;
  userRole: string;
  updateEmployeeAction?: (formData: FormData) => Promise<void>;
}

export function EmployeeTableActions({
  employee,
  userRole,
  updateEmployeeAction,
}: EmployeeTableActionsProps) {
  const canEdit = ['ADMIN', 'HR'].includes(userRole);

  return (
    <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
      <Link
        href={`/employees/${employee.id}`}
        className="win-btn text-[11px] px-2 py-0.5 font-bold text-[#0A246A] whitespace-nowrap flex items-center gap-1"
        title="عرض ملف الموظف"
      >
        <span>👁️</span>
        <span>الملف</span>
      </Link>

      {canEdit && updateEmployeeAction && (
        <EditEmployeeModal
          employee={employee}
          updateEmployeeAction={updateEmployeeAction}
          buttonText="✏️ تعديل"
          buttonClassName="win-btn text-[11px] px-2 py-0.5 font-bold text-emerald-800 whitespace-nowrap flex items-center gap-1"
        />
      )}
    </div>
  );
}
