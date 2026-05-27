export const DELIVERY_STATUS_LABELS = {
  in_progress: 'Proses',
  delivered: 'Terkirim',
  failed: 'Gagal',
}

export const VALIDATION_STATUS_LABELS = {
  pending: 'Menunggu',
  verified: 'Terverifikasi',
  conflict: 'Konflik',
  issue_reported: 'Masalah Dilaporkan',
}

export const COMMON_STATUS_LABELS = {
  ...DELIVERY_STATUS_LABELS,
  ...VALIDATION_STATUS_LABELS,
  resolved: 'Resolved',
  open: 'Open',
}

export function getDeliveryStatusLabel(status) {
  return DELIVERY_STATUS_LABELS[status] || status || '-'
}

export function getValidationStatusLabel(status) {
  return VALIDATION_STATUS_LABELS[status] || status || '-'
}

export function getStatusLabel(status) {
  return COMMON_STATUS_LABELS[status] || status || '-'
}

export function getDistributionValidationStatus(item) {
  return item?.confirmationStatus || item?.validation?.status || item?.validationStatus || 'pending'
}

export function getDistributionDeliveryStatus(item) {
  return item?.deliveryStatus || item?.status || 'in_progress'
}
