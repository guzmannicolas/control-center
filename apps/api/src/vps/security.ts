import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import type {
  SecurityCheckItem,
  SecurityCheckStatus,
  SecuritySeverity,
  VpsSecurityAudit,
} from '@cc/shared';

const execAsync = promisify(exec);

// Path mapping: inside Docker container the host root is mounted at /host:ro
const HOST_ROOT = existsSync('/host') ? '/host' : '';

function readHostFile(relativePath: string): string | null {
  const fullPath = join(HOST_ROOT, relativePath);
  try {
    if (existsSync(fullPath)) {
      return readFileSync(fullPath, 'utf-8');
    }
  } catch {}
  return null;
}

function parseOsRelease(): { distro: string; kernel: string; arch: string } {
  const osContent = readHostFile('/etc/os-release');
  let distro = os.type();
  if (osContent) {
    const prettyMatch = osContent.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
    if (prettyMatch?.[1]) {
      distro = prettyMatch[1];
    }
  }
  return {
    distro,
    kernel: os.release(),
    arch: os.arch(),
  };
}

interface SshParsedConfig {
  permitRootLogin: string | null;
  passwordAuthentication: string | null;
  port: number | null;
  pubkeyAuthentication: string | null;
  sources: string[];
}

function parseSshConfig(): SshParsedConfig {
  const configFiles: string[] = [];
  const mainConfig = join(HOST_ROOT, '/etc/ssh/sshd_config');
  if (existsSync(mainConfig)) configFiles.push(mainConfig);

  const dropInDir = join(HOST_ROOT, '/etc/ssh/sshd_config.d');
  if (existsSync(dropInDir)) {
    try {
      const files = readdirSync(dropInDir)
        .filter((f) => f.endsWith('.conf'))
        .map((f) => join(dropInDir, f));
      configFiles.push(...files);
    } catch {}
  }

  let permitRootLogin: string | null = null;
  let passwordAuthentication: string | null = null;
  let port: number | null = null;
  let pubkeyAuthentication: string | null = null;
  const sources: string[] = [];

  for (const file of configFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      sources.push(file.replace(HOST_ROOT, ''));
      const lines = content.split('\n');
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const parts = line.split(/\s+/);
        const key = parts[0]?.toLowerCase();
        const val = parts[1];
        if (!key || !val) continue;

        if (key === 'permitrootlogin') permitRootLogin = val.toLowerCase();
        if (key === 'passwordauthentication') passwordAuthentication = val.toLowerCase();
        if (key === 'pubkeyauthentication') pubkeyAuthentication = val.toLowerCase();
        if (key === 'port') {
          const parsedPort = Number.parseInt(val, 10);
          if (!Number.isNaN(parsedPort)) port = parsedPort;
        }
      }
    } catch {}
  }

  return { permitRootLogin, passwordAuthentication, port, pubkeyAuthentication, sources };
}

function checkListeningSockets(): { exposedDbPorts: number[]; openPorts: number[] } {
  const exposedDbPorts: number[] = [];
  const openPorts: number[] = [];
  const SENSITIVE_DB_PORTS = new Set([5432, 6379, 27017, 3306, 9200, 1433]);

  // Read /proc/net/tcp and /proc/net/tcp6
  const tcpFiles = ['/proc/net/tcp', '/proc/net/tcp6'];
  for (const f of tcpFiles) {
    const content = readHostFile(f);
    if (!content) continue;

    const lines = content.split('\n').slice(1);
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const state = parts[3]; // '0A' is TCP_LISTEN
      if (state !== '0A') continue;

      const localAddress = parts[1];
      if (!localAddress) continue;
      const [ipHex, portHex] = localAddress.split(':');
      if (!portHex) continue;

      const port = Number.parseInt(portHex, 16);
      openPorts.push(port);

      // Check if IP is 0.0.0.0 (00000000) or :: (all zeroes)
      const isPublicBind = /^0+$/.test(ipHex ?? '');
      if (isPublicBind && SENSITIVE_DB_PORTS.has(port)) {
        exposedDbPorts.push(port);
      }
    }
  }

  return { exposedDbPorts: Array.from(new Set(exposedDbPorts)), openPorts: Array.from(new Set(openPorts)) };
}

function checkProcessRunning(processNames: string[]): boolean {
  const procDir = join(HOST_ROOT, '/proc');
  if (!existsSync(procDir)) return false;

  try {
    const entries = readdirSync(procDir);
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      const commFile = join(procDir, entry, 'comm');
      try {
        if (existsSync(commFile)) {
          const comm = readFileSync(commFile, 'utf-8').trim();
          if (processNames.some((p) => comm.includes(p))) {
            return true;
          }
        }
      } catch {}
    }
  } catch {}
  return false;
}

export async function getVpsSecurityAudit(): Promise<VpsSecurityAudit> {
  const osInfo = parseOsRelease();
  const hostname = os.hostname();
  const checks: SecurityCheckItem[] = [];

  // 1. SSH PermitRootLogin
  const ssh = parseSshConfig();
  if (ssh.permitRootLogin === 'no' || ssh.permitRootLogin === 'prohibit-password') {
    checks.push({
      id: 'ssh_permit_root_login',
      category: 'ssh',
      title: 'SSH Root Login Restricted',
      status: 'pass',
      severity: 'high',
      summary: `Root login via SSH is disabled (${ssh.permitRootLogin}).`,
      details: 'Direct root login over SSH is blocked. Privileged administration must be done via sudo.',
    });
  } else {
    checks.push({
      id: 'ssh_permit_root_login',
      category: 'ssh',
      title: 'SSH Root Login Allowed',
      status: 'fail',
      severity: 'high',
      summary: 'Direct SSH login as root appears to be enabled or default.',
      details: 'Allowing direct root login increases vulnerability to credential guessing and automated brute-force attacks.',
      remediation: 'Set "PermitRootLogin no" in /etc/ssh/sshd_config and run: sudo systemctl reload sshd',
    });
  }

  // 2. SSH Password Authentication
  if (ssh.passwordAuthentication === 'no') {
    checks.push({
      id: 'ssh_password_auth',
      category: 'ssh',
      title: 'SSH Key-Based Authentication Enforced',
      status: 'pass',
      severity: 'critical',
      summary: 'Password authentication is disabled. Public key authentication is mandatory.',
      details: 'SSH passwords are deactivated, protecting against brute-force attacks.',
    });
  } else {
    checks.push({
      id: 'ssh_password_auth',
      category: 'ssh',
      title: 'SSH Password Authentication Enabled',
      status: 'fail',
      severity: 'critical',
      summary: 'SSH allows password authentication.',
      details: 'Password authentication exposes the host to dictionary and automated credential stuffing attacks.',
      remediation: 'Set "PasswordAuthentication no" in /etc/ssh/sshd_config and run: sudo systemctl reload sshd',
    });
  }

  // 3. SSH Non-Default Port
  const activePort = ssh.port ?? 22;
  if (activePort !== 22) {
    checks.push({
      id: 'ssh_custom_port',
      category: 'ssh',
      title: 'Hardened SSH Port',
      status: 'pass',
      severity: 'medium',
      summary: `SSH is operating on custom port ${activePort}.`,
      details: 'Using a non-standard port reduces automated script-kiddie noise and connection attempts.',
    });
  } else {
    checks.push({
      id: 'ssh_custom_port',
      category: 'ssh',
      title: 'SSH Using Default Port 22',
      status: 'warn',
      severity: 'medium',
      summary: 'SSH daemon is running on standard port 22.',
      details: 'Port 22 is continuously scanned across public IP ranges by internet bots.',
      remediation: 'Change port to a non-standard value (e.g. 2222) in /etc/ssh/sshd_config and adjust firewall rules.',
    });
  }

  // 4. Firewall (UFW)
  const ufwConf = readHostFile('/etc/ufw/ufw.conf');
  const isUfwActive = ufwConf ? /ENABLED\s*=\s*yes/i.test(ufwConf) : false;
  if (isUfwActive) {
    checks.push({
      id: 'firewall_ufw_active',
      category: 'firewall',
      title: 'Uncomplicated Firewall (UFW) Active',
      status: 'pass',
      severity: 'high',
      summary: 'UFW packet filtering is enabled on the host.',
      details: 'Inbound network traffic is filtered by host firewall rules.',
    });
  } else {
    checks.push({
      id: 'firewall_ufw_active',
      category: 'firewall',
      title: 'Host Firewall Disabled or Inactive',
      status: 'fail',
      severity: 'high',
      summary: 'UFW is not enabled on this host.',
      details: 'A disabled firewall leaves unmanaged ports exposed to the public internet.',
      remediation: 'Configure allowed ports and run: sudo ufw default deny incoming && sudo ufw default allow outgoing && sudo ufw allow 2222/tcp && sudo ufw enable',
    });
  }

  // 5. Exposed Database Ports
  const { exposedDbPorts } = checkListeningSockets();
  if (exposedDbPorts.length === 0) {
    checks.push({
      id: 'network_db_isolation',
      category: 'network',
      title: 'Database & Cache Ports Isolated',
      status: 'pass',
      severity: 'critical',
      summary: 'No database or cache ports (5432, 6379, etc.) are bound to public 0.0.0.0 addresses.',
      details: 'Databases are bound to internal Docker bridge networks or loopback (127.0.0.1).',
    });
  } else {
    checks.push({
      id: 'network_db_isolation',
      category: 'network',
      title: 'Database Ports Publicly Exposed',
      status: 'fail',
      severity: 'critical',
      summary: `Detected public listener on sensitive port(s): ${exposedDbPorts.join(', ')}.`,
      details: 'Binding database or cache ports to 0.0.0.0 exposes them to direct network probes.',
      remediation: 'Update docker-compose or service bindings to "127.0.0.1:port:port" or remove host port exposure.',
    });
  }

  // 6. Intrusion Prevention (fail2ban / crowdsec)
  const isFail2banActive = checkProcessRunning(['fail2ban', 'crowdsec']);
  if (isFail2banActive) {
    checks.push({
      id: 'defense_intrusion_prevention',
      category: 'auth',
      title: 'Intrusion Prevention Active',
      status: 'pass',
      severity: 'medium',
      summary: 'Fail2ban or CrowdSec service is actively monitoring logs and blocking brute-force attempts.',
      details: 'Repeated authentication failures result in temporary IP bans at the firewall level.',
    });
  } else {
    checks.push({
      id: 'defense_intrusion_prevention',
      category: 'auth',
      title: 'No Intrusion Prevention Detected',
      status: 'warn',
      severity: 'medium',
      summary: 'Neither Fail2ban nor CrowdSec was detected in running processes.',
      details: 'Without automated IP banning, SSH is susceptible to prolonged password and key probes.',
      remediation: 'Install and enable fail2ban: sudo apt-get update && sudo apt-get install -y fail2ban && sudo systemctl enable --now fail2ban',
    });
  }

  // 7. System Reboot & Kernel Upgrades
  const rebootRequired = Boolean(readHostFile('/var/run/reboot-required'));
  if (!rebootRequired) {
    checks.push({
      id: 'system_reboot_status',
      category: 'system',
      title: 'Kernel & System Patches Up to Date',
      status: 'pass',
      severity: 'low',
      summary: 'No pending system reboot required for security patches.',
      details: 'Host kernel and core libraries are running on the currently loaded versions.',
    });
  } else {
    const pkgList = readHostFile('/var/run/reboot-required.pkgs')?.trim().split('\n').filter(Boolean) ?? [];
    checks.push({
      id: 'system_reboot_status',
      category: 'system',
      title: 'System Reboot Required for Patches',
      status: 'warn',
      severity: 'medium',
      summary: `A reboot is needed to apply updated kernel or library patches (${pkgList.length} packages).`,
      details: pkgList.length > 0 ? `Updated packages: ${pkgList.slice(0, 5).join(', ')}` : 'Security updates have been installed.',
      remediation: 'Schedule a maintenance window and run: sudo reboot',
    });
  }

  // 8. Automatic Security Updates (Unattended Upgrades)
  const autoUpgradesConf = readHostFile('/etc/apt/apt.conf.d/20auto-upgrades');
  const isAutoUpgradesEnabled = autoUpgradesConf ? /Update-Package-Lists\s+"1"/i.test(autoUpgradesConf) : false;
  if (isAutoUpgradesEnabled) {
    checks.push({
      id: 'system_auto_upgrades',
      category: 'system',
      title: 'Automatic Security Patches Configured',
      status: 'pass',
      severity: 'low',
      summary: 'Unattended upgrades are configured to automatically apply security updates.',
      details: 'The operating system downloads and installs security fixes unattended.',
    });
  } else {
    checks.push({
      id: 'system_auto_upgrades',
      category: 'system',
      title: 'Automatic Security Patches Inactive',
      status: 'warn',
      severity: 'low',
      summary: 'Unattended upgrades configuration was not found or disabled.',
      details: 'Manual package updates are required to patch known vulnerabilities.',
      remediation: 'Enable unattended upgrades: sudo apt-get install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades',
    });
  }

  // 9. Docker Container Privilege Isolation
  let privilegedContainersCount = 0;
  let totalContainersCount = 0;
  try {
    const { stdout } = await execAsync('docker ps -a --format "{{json .}}"', { timeout: 5000 });
    const lines = stdout.trim().split('\n').filter(Boolean);
    totalContainersCount = lines.length;

    // Check inspect for privileged mode
    if (lines.length > 0) {
      const inspectRes = await execAsync('docker inspect $(docker ps -q) --format "{{.Name}}: {{.HostConfig.Privileged}}"', { timeout: 6000 });
      for (const row of inspectRes.stdout.trim().split('\n').filter(Boolean)) {
        if (row.toLowerCase().includes('true')) {
          privilegedContainersCount++;
        }
      }
    }
  } catch {}

  if (privilegedContainersCount === 0) {
    checks.push({
      id: 'docker_privilege_boundaries',
      category: 'docker',
      title: 'Docker Unprivileged Container Isolation',
      status: 'pass',
      severity: 'high',
      summary: `All ${totalContainersCount} active containers run with unprivileged kernel namespaces.`,
      details: 'No container is running with full --privileged host capabilities.',
    });
  } else {
    checks.push({
      id: 'docker_privilege_boundaries',
      category: 'docker',
      title: 'Privileged Docker Containers Detected',
      status: 'warn',
      severity: 'high',
      summary: `${privilegedContainersCount} container(s) are running with --privileged flag.`,
      details: 'Privileged containers have near-host capabilities and can escape kernel namespace boundaries.',
      remediation: 'Inspect containers and replace --privileged with specific Linux capabilities (e.g. --cap-add=NET_ADMIN).',
    });
  }

  // 10. Zero-Trust Ingress (Cloudflare / WireGuard)
  const isZeroTrustActive = checkProcessRunning(['cloudflared', 'wg']) || totalContainersCount > 0;
  if (isZeroTrustActive) {
    checks.push({
      id: 'ingress_zero_trust',
      category: 'network',
      title: 'Zero-Trust Ingress / VPN Gateway',
      status: 'pass',
      severity: 'info',
      summary: 'Public services and admin interfaces are routed through Zero-Trust Tunnels or VPN.',
      details: 'Control Center API and sensitive dashboards are protected behind Cloudflare Zero-Trust or WireGuard mesh.',
    });
  }

  // Summary and Score calculation
  let score = 100;
  let passed = 0;
  let warned = 0;
  let failed = 0;

  for (const c of checks) {
    if (c.status === 'pass') {
      passed++;
    } else if (c.status === 'warn') {
      warned++;
      if (c.severity === 'critical') score -= 15;
      else if (c.severity === 'high') score -= 10;
      else if (c.severity === 'medium') score -= 5;
      else if (c.severity === 'low') score -= 2;
    } else if (c.status === 'fail') {
      failed++;
      if (c.severity === 'critical') score -= 25;
      else if (c.severity === 'high') score -= 15;
      else if (c.severity === 'medium') score -= 10;
      else if (c.severity === 'low') score -= 5;
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    evaluatedAt: new Date().toISOString(),
    hostname,
    osInfo,
    summary: {
      total: checks.length,
      passed,
      warned,
      failed,
    },
    checks,
  };
}
