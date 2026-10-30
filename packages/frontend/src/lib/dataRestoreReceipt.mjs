// The socket event can beat the HTTP response that normally saves this receipt.
export function saveDataRestoreReceipt(receipt, storage) {
  if (receipt?.source === 'cockpit' && typeof receipt.previous === 'string' && receipt.previous) {
    storage.setItem('racehub:cockpit-backup', receipt.previous)
  }
}
