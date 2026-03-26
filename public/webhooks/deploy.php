<?php
/**
 * GitHub push webhook → runs a fixed deploy script (Option 1, pull-based).
 *
 * Path in repo: public/webhooks/deploy.php → served as /webhooks/deploy.php
 * (configure PHP execution on your host; do not serve this as raw source.)
 *
 * Config file (secrets, not in git):
 *   - Recommended: place it in the SAME directory as this script:
 *       webhooks/deploy-webhook.config.local.php
 *     and ensure your rsync deploy excludes it so --delete doesn't remove it.
 *   - Alternative: set Apache/PHP-FPM env:
 *       DEPLOY_WEBHOOK_CONFIG=/absolute/path/to/deploy-webhook.config.local.php
 *
 * repo_root is configured inside deploy-webhook.config.local.php (absolute checkout path).
 * deploy.php runs scripts/build_deploy.sh there and passes REPO_DIR to the shell.
 *
 * Deploy:
 *   1. Copy deploy-webhook.config.example.php → webhooks/deploy-webhook.config.local.php on the server.
 *   2. chmod 640 webhooks/deploy-webhook.config.local.php && chown root:www-data (or owner + PHP-FPM group).
 *   3. chmod +x scripts/build_deploy.sh; set DEPLOY_TARGET in deploy_env (see example).
 *   4. Ensure PHP may execute the deploy script, or use sudoers (see below).
 * 5. GitHub: Webhook → JSON, secret = same as in deploy-webhook.config.local.php, push only.
 *
 * Long builds: this request blocks until the script exits. Raise nginx/apache
 * proxy_read_timeout (and GitHub will retry on 5xx) or switch to a queue that
 * returns 202 immediately.
 *
 * Hardening notes:
 *   - Secret never appears in this file; use deploy-webhook.config.local.php (not in git).
 *   - Signature verified with hash_equals before parsing JSON.
 *   - Deploy output is not echoed to the client (reduces information leakage).
 *   - Each run is appended to repo root .deploy-webhook.log by default (override or disable in config).
 *   - Deploy script defaults to repo scripts/build_deploy.sh; must stay under repo root.
 *   - If www-data cannot run your deploy (git/yarn in $HOME), either:
 *       a) Run this pool as your deploy user (PHP-FPM user = you), or
 *       b) sudoers: www-data ALL=(deployuser) NOPASSWD: /bin/bash /full/path/to/repo/scripts/build_deploy.sh
 *          and set 'deploy_command_prefix' => ['sudo', '-n', '-u', 'deployuser'] in deploy-webhook.config.local.php
 *     (Adjust to your policy; prefix is fixed in config, no user input.)
 */

declare(strict_types=1);

header('Content-Type: text/plain; charset=UTF-8');

function getClientIp(): string {
  // Best-effort; on shared hosts this may be behind a proxy.
  $ip = $_SERVER['REMOTE_ADDR'] ?? '';
  return is_string($ip) ? $ip : '';
}

function jsonOut(int $status, array $data): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=UTF-8');
  echo json_encode($data, JSON_UNESCAPED_SLASHES) ?: '{}';
  exit;
}

function configOut(string $message, array $meta = []): void {
  // Intentionally verbose for debugging. This reveals server paths; revert when done.
  http_response_code(500);
  header('Content-Type: text/plain; charset=UTF-8');
  echo "Configuration error\n";
  echo $message . "\n";
  foreach ($meta as $k => $v) {
    if (is_array($v) || is_object($v)) {
      $v = json_encode($v, JSON_UNESCAPED_SLASHES);
    }
    echo $k . '=' . (string) $v . "\n";
  }
  exit;
}

function rotateAndAppendLog(string $path, string $line, int $maxBytes = 1000000, int $keepBytes = 200000): void {
  // Best-effort logging; never throw.
  try {
    $dir = dirname($path);
    if ($dir !== '' && !is_dir($dir)) return;

    $size = @filesize($path);
    if (is_int($size) && $size > $maxBytes) {
      $fh = @fopen($path, 'rb');
      if (is_resource($fh)) {
        @fseek($fh, -1 * $keepBytes, SEEK_END);
        $tail = @stream_get_contents($fh);
        @fclose($fh);
        if (is_string($tail) && $tail !== '') {
          @file_put_contents($path, "---- truncated ----\n" . $tail, LOCK_EX);
        }
      }
    }

    @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
  } catch (\Throwable $e) {
    // ignore
  }
}

function earlyLog(string $event, array $meta = []): void {
  $path = __DIR__ . DIRECTORY_SEPARATOR . 'deploy-webhook.error.log';
  $base = [
    'ts' => gmdate('c'),
    'event' => $event,
    'ip' => getClientIp(),
    'delivery' => $_SERVER['HTTP_X_GITHUB_DELIVERY'] ?? '',
  ];
  $record = array_merge($base, $meta);
  rotateAndAppendLog($path, (json_encode($record, JSON_UNESCAPED_SLASHES) ?: '{}') . "\n");
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  exit('Method Not Allowed');
}

$maxBytes = 256 * 1024;
$cl = $_SERVER['CONTENT_LENGTH'] ?? '';
if ($cl !== '' && ctype_digit((string) $cl) && (int) $cl > $maxBytes) {
  http_response_code(413);
  exit('Payload Too Large');
}

$payload = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
if ($payload === false || strlen($payload) > $maxBytes) {
  http_response_code(413);
  exit('Payload Too Large');
}

// Config should NOT be part of the static build output. Keep it as a server-managed file and
// protect it from rsync --delete (either by excluding it in rsync, or by storing it outside web/).
//
// Search order:
//   1) Same directory as this script (recommended if you also protect it from rsync deletion)
//   2) Apache/FPM env DEPLOY_WEBHOOK_CONFIG=/abs/path/to/config
//   3) Parent of webhooks/ (dev repo root or exported site root)
$configPath = '';
$sameDir = __DIR__ . DIRECTORY_SEPARATOR . 'deploy-webhook.config.local.php';
if (is_readable($sameDir)) {
  $configPath = $sameDir;
}
$fromEnv = getenv('DEPLOY_WEBHOOK_CONFIG');
if ($configPath === '' && is_string($fromEnv) && $fromEnv !== '' && is_readable($fromEnv)) {
  $configPath = $fromEnv;
}
if ($configPath === '') {
  $aboveWebhooks = dirname(__DIR__, 2);
  $candidates = [
    $aboveWebhooks . DIRECTORY_SEPARATOR . 'deploy-webhook.config.local.php',
  ];
  foreach ($candidates as $candidate) {
    if (is_readable($candidate)) {
      $configPath = $candidate;
      break;
    }
  }
}
if ($configPath === '') {
  error_log('deploy-webhook: missing deploy-webhook.config.local.php (same dir as deploy.php, or SetEnv DEPLOY_WEBHOOK_CONFIG)');
  earlyLog('config_missing', [
    'tried_same_dir' => __DIR__ . DIRECTORY_SEPARATOR . 'deploy-webhook.config.local.php',
    'tried_env' => is_string(getenv('DEPLOY_WEBHOOK_CONFIG')) && getenv('DEPLOY_WEBHOOK_CONFIG') !== '' ? 'set' : 'unset',
  ]);
  configOut('config file not found/readable', [
    'tried_same_dir' => __DIR__ . DIRECTORY_SEPARATOR . 'deploy-webhook.config.local.php',
    'env_DEPLOY_WEBHOOK_CONFIG' => (string) (getenv('DEPLOY_WEBHOOK_CONFIG') ?: ''),
    'also_tried' => [dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'deploy-webhook.config.local.php'],
  ]);
}

/** @var array{secret:string,repo_root:string,allowed_ref?:string,allowed_repository?:string,deploy_script?:string,script_parent_dir?:string,deploy_command_prefix?:list<string>,deploy_env?:array<string,string>,log_file?:string|false} $config */
$config = require $configPath;

$debug = ($config['debug'] ?? false) === true;
$debugAllowIps = $config['debug_allow_ips'] ?? [];
if (!is_array($debugAllowIps)) $debugAllowIps = [];
$clientIp = getClientIp();
$canDebugToClient = $debug && (count($debugAllowIps) === 0 || in_array($clientIp, $debugAllowIps, true));

$secret = $config['secret'] ?? '';
if ($secret === '' || strlen($secret) < 16) {
  error_log('deploy-webhook: invalid secret in config');
  configOut('invalid secret in config', [
    'configPath' => $configPath,
    'secret_len' => is_string($secret) ? strlen($secret) : 'not_string',
  ]);
}

$sigHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
if (!is_string($sigHeader) || !hash_equals($expected, $sigHeader)) {
  // Safe debug: never print secrets; avoid printing full signatures.
  earlyLog('signature_mismatch', [
    'received_sig_prefix' => is_string($sigHeader) ? substr($sigHeader, 0, 16) : null,
    'expected_sig_prefix' => substr($expected, 0, 16),
    'payload_len' => strlen($payload),
    'payload_sha256' => hash('sha256', $payload),
  ]);
  if ($canDebugToClient) {
    jsonOut(403, [
      'ok' => false,
      'error' => 'signature_mismatch',
      'client_ip' => $clientIp,
      'received_sig_prefix' => is_string($sigHeader) ? substr($sigHeader, 0, 16) : null,
      'expected_sig_prefix' => substr($expected, 0, 16),
      'payload_len' => strlen($payload),
      'payload_sha256' => hash('sha256', $payload),
    ]);
  }
  http_response_code(403);
  exit('Forbidden');
}

$data = json_decode($payload, true);
if (!is_array($data)) {
  http_response_code(400);
  exit('Invalid JSON');
}

$allowedRef = $config['allowed_ref'] ?? 'refs/heads/main';
if (($data['ref'] ?? '') !== $allowedRef) {
  http_response_code(200);
  exit('Ignored (ref)');
}

if (!empty($config['allowed_repository'])) {
  $full = $data['repository']['full_name'] ?? '';
  if ($full !== $config['allowed_repository']) {
    http_response_code(403);
    exit('Forbidden');
  }
}

$repoRootConfigured = $config['repo_root'] ?? '';
if (!is_string($repoRootConfigured) || $repoRootConfigured === '') {
  error_log('deploy-webhook: repo_root must be set to the absolute checkout path in deploy-webhook.config.local.php');
  configOut('repo_root missing/invalid', [
    'configPath' => $configPath,
    'repo_root' => is_string($repoRootConfigured) ? $repoRootConfigured : 'not_string',
  ]);
}
$repoRoot = realpath($repoRootConfigured);
if ($repoRoot === false) {
  error_log('deploy-webhook: repo_root does not exist or is not readable');
  configOut('repo_root not found/readable (realpath failed)', [
    'configPath' => $configPath,
    'repo_root' => $repoRootConfigured,
  ]);
}

$defaultDeployScript = $repoRoot . DIRECTORY_SEPARATOR . 'scripts' . DIRECTORY_SEPARATOR . 'build_deploy.sh';
$scriptConfigured = $config['deploy_script'] ?? '';
$script = ($scriptConfigured !== '' && is_string($scriptConfigured))
  ? $scriptConfigured
  : $defaultDeployScript;

$parentConfigured = $config['script_parent_dir'] ?? '';
$parent = ($parentConfigured !== '' && is_string($parentConfigured))
  ? $parentConfigured
  : $repoRoot;

$realScript = realpath($script);
$realParent = realpath($parent);
if ($realScript === false || $realParent === false) {
  error_log('deploy-webhook: deploy script or script_parent_dir not found');
  configOut('deploy script or script_parent_dir not found (realpath failed)', [
    'configPath' => $configPath,
    'repoRoot' => $repoRoot,
    'deploy_script_configured' => $scriptConfigured,
    'deploy_script_effective' => $script,
    'script_parent_dir_configured' => $parentConfigured,
    'script_parent_dir_effective' => $parent,
  ]);
}

$parentPrefix = rtrim($realParent, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
if (strpos($realScript, $parentPrefix) !== 0) {
  error_log('deploy-webhook: deploy_script escapes script_parent_dir');
  configOut('deploy_script escapes script_parent_dir', [
    'deploy_script_realpath' => $realScript,
    'script_parent_realpath' => $realParent,
  ]);
}

if (!is_file($realScript) || !is_executable($realScript)) {
  error_log('deploy-webhook: deploy script not executable');
  configOut('deploy script not executable', [
    'deploy_script_realpath' => $realScript,
    'is_file' => is_file($realScript) ? 'yes' : 'no',
    'is_executable' => is_executable($realScript) ? 'yes' : 'no',
  ]);
}

$prefix = $config['deploy_command_prefix'] ?? [];
if (!is_array($prefix) || $prefix !== array_values($prefix)) {
  error_log('deploy-webhook: deploy_command_prefix must be a list');
  http_response_code(500);
  exit('Configuration error');
}
foreach ($prefix as $part) {
  if (!is_string($part) || $part === '') {
    error_log('deploy-webhook: invalid deploy_command_prefix entry');
    http_response_code(500);
    exit('Configuration error');
  }
}

$bash = ['/bin/bash', '--noprofile', '--norc', $realScript];
$resolvedCmd = array_merge($prefix, $bash);

$descriptorspec = [
  0 => ['pipe', 'r'],
  1 => ['pipe', 'w'],
  2 => ['pipe', 'w'],
];

$deployEnv = $config['deploy_env'] ?? [];
if (!is_array($deployEnv)) {
  error_log('deploy-webhook: deploy_env must be an array of string keys to string values');
  http_response_code(500);
  exit('Configuration error');
}
foreach ($deployEnv as $k => $v) {
  if (!is_string($k) || !is_string($v)) {
    error_log('deploy-webhook: deploy_env must use string keys and string values');
    http_response_code(500);
    exit('Configuration error');
  }
}

// REPO_DIR last so it always matches resolved repo_root (do not rely on ~/… paths in deploy_env).
$basePath = getenv('PATH');
if (!is_string($basePath) || $basePath === '') {
  $basePath = '/usr/local/bin:/usr/bin:/bin';
}

// Prefer PATH from deploy_env if provided; otherwise inherit the PHP process PATH.
$effectivePath = $basePath;
if (isset($deployEnv['PATH']) && is_string($deployEnv['PATH']) && $deployEnv['PATH'] !== '') {
  $effectivePath = $deployEnv['PATH'];
  unset($deployEnv['PATH']);
}

$env = array_merge($_ENV, [
  'PATH' => $effectivePath,
  'HOME' => getenv('HOME') ?: '',
  'GITHUB_DELIVERY' => $_SERVER['HTTP_X_GITHUB_DELIVERY'] ?? '',
], $deployEnv, [
  'REPO_DIR' => $repoRoot,
]);

$cwd = $realParent;
$process = proc_open($resolvedCmd, $descriptorspec, $pipes, $cwd, $env);
if (!is_resource($process)) {
  error_log('deploy-webhook: proc_open failed');
  http_response_code(500);
  exit('Deploy failed');
}

fclose($pipes[0]);
$stdout = stream_get_contents($pipes[1]);
$stderr = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$code = proc_close($process);

$logRaw = $config['log_file'] ?? null;
if ($logRaw === false) {
  $logFile = null;
} elseif (is_string($logRaw) && $logRaw !== '') {
  $logFile = $logRaw;
} elseif ($logRaw === null || $logRaw === '') {
  $logFile = $repoRoot . DIRECTORY_SEPARATOR . '.deploy-webhook.log';
} else {
  error_log('deploy-webhook: log_file must be false, a non-empty string, or omitted');
  http_response_code(500);
  exit('Configuration error');
}

if ($logFile !== null) {
  $line = sprintf(
    "[%s] exit=%d delivery=%s\n--- stdout ---\n%s\n--- stderr ---\n%s\n",
    gmdate('c'),
    $code,
    $_SERVER['HTTP_X_GITHUB_DELIVERY'] ?? '',
    is_string($stdout) ? $stdout : '',
    is_string($stderr) ? $stderr : ''
  );
  if (file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX) === false) {
    error_log('deploy-webhook: could not write log file: ' . $logFile);
  }
}

if ($code !== 0) {
  error_log('deploy-webhook: deploy script exited ' . $code);
  http_response_code(500);
  exit('Deploy failed');
}

http_response_code(200);
echo 'OK';
