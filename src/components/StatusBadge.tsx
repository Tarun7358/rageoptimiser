import React from 'react';

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'danger' | 'info' | 'purple' | string;
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const getBadgeClass = () => {
    switch (status.toLowerCase()) {
      case 'success':
      case 'active':
      case 'online':
      case 'passed':
        return 'badge-success';
      case 'warning':
      case 'idle':
      case 'risk':
        return 'badge-warning';
      case 'danger':
      case 'offline':
      case 'alert':
      case 'quarantined':
        return 'badge-danger';
      case 'purple':
      case 'privileged':
      case 'owner':
        return 'badge-purple';
      default:
        return 'badge-info';
    }
  };

  return (
    <span className={`badge ${getBadgeClass()}`}>
      {label}
    </span>
  );
}
