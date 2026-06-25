// Kernel authority feature flag.
// KERNEL_AUTHORITY=false → rollback to SystemState (legacy read path).
// Default: kernel is authoritative (Stage 3 go-live).
// One-command rollback: set KERNEL_AUTHORITY=false on Railway and redeploy.

export function isKernelAuthority(): boolean {
  return process.env.KERNEL_AUTHORITY !== 'false';
}

export function getAuthorityMode(): 'kernel' | 'legacy' {
  return isKernelAuthority() ? 'kernel' : 'legacy';
}
