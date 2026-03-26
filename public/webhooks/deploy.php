<?php
/**
 * GitHub push webhook → runs a fixed deploy script (Option 1, pull-based).
 *
 * Path in repo: public/webhooks/deploy.php → served as /webhooks/deploy.php
 * (configure PHP execution on your host; do not serve this as raw source.)
 *
 * Paths:
 *   This file lives in public/webhooks/, so repo root is dirname(__DIR__, 2).
 *   By default it runs scripts/build_deploy.sh under that root (committed in git).
 *
 * Deploy:
 *   1. Copy deploy.local.example.php → deploy.local.php (secret only + options).
 *   2. chmod 640 deploy.local.php && chown root:www-data (or owner + PHP-FPM group).
 *   3. chmod +x scripts/build_deploy.sh; set DEPLOY_TARGET for the bash script (server env).
 *   4. Ensure PHP may execute the deploy script, or use sudoers (see below).
 * 5. GitHub: Webhook → JSON, secret = same as in deploy.local.php, push only.
 *
 * Long builds: this request blocks until the script exits. Raise nginx/apache
 * proxy_read_timeout (and GitHub will retry on 5xx) or switch to a queue that
 * returns 202 immediately.
 *
 * Hardening notes:
 *   - Secret never appears in this file; use deploy.local.php (not in git).
 *   - Signature verified with hash_equals before parsing JSON.
 *   - Deploy output is not echoed to the client (reduces information leakage).
 *   - Each run is appended to repo root .deploy-webhook.log by default (override or disable in deploy.local.php).
 *   - Deploy script defaults to repo scripts/build_deploy.sh; must stay under repo root.
 *   - If www-data cannot run your deploy (git/yarn in $HOME), either:
 *       a) Run this pool as your deploy user (PHP-FPM user = you), or
 *       b) sudoers: www-data ALL=(deployuser) NOPASSWD: /bin/bash /full/path/to/repo/scripts/build_deploy.sh
 *          and set 'deploy_command_prefix' => ['sudo', '-n', '-u', 'deployuser'] in deploy.local.php
 *     (Adjust to your policy; prefix is fixed in config, no user input.)
 */

declare(strict_types=1);

header('Content-Type: text/plain; charset=UTF-8');

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

$configPath = __DIR__ . '/deploy.local.php';
if (!is_readable($configPath)) {
  error_log('deploy-webhook: missing or unreadable deploy.local.php');
  http_response_code(500);
  exit('Configuration error');
}

/** @var array{secret:string,allowed_ref?:string,allowed_repository?:string,repo_root?:string,deploy_script?:string,script_parent_dir?:string,deploy_command_prefix?:list<string>,deploy_env?:array<string,string>,log_file?:string|false} $config */
$config = require $configPath;

$secret = $config['secret'] ?? '';
if ($secret === '' || strlen($secret) < 16) {
  error_log('deploy-webhook: invalid secret in config');
  http_response_code(500);
  exit('Configuration error');
}

$sigHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
$expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
if (!is_string($sigHeader) || !hash_equals($expected, $sigHeader)) {
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

// Repo root: public/webhooks/deploy.php → ../.. is project root (same layout as in git).
$repoRootConfigured = $config['repo_root'] ?? '';
if ($repoRootConfigured !== '' && !is_string($repoRootConfigured)) {
  error_log('deploy-webhook: repo_root must be a string');
  http_response_code(500);
  exit('Configuration error');
}
$repoRoot = $repoRootConfigured !== ''
  ? realpath($repoRootConfigured)
  : realpath(__DIR__ . '/../..');
if ($repoRoot === false) {
  error_log('deploy-webhook: could not resolve repo root');
  http_response_code(500);
  exit('Configuration error');
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
  http_response_code(500);
  exit('Configuration error');
}

$parentPrefix = rtrim($realParent, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
if (strpos($realScript, $parentPrefix) !== 0) {
  error_log('deploy-webhook: deploy_script escapes script_parent_dir');
  http_response_code(500);
  exit('Configuration error');
}

if (!is_file($realScript) || !is_executable($realScript)) {
  error_log('deploy-webhook: deploy script not executable');
  http_response_code(500);
  exit('Configuration error');
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

$env = array_merge($_ENV, [
  'PATH' => '/usr/local/bin:/usr/bin:/bin',
  'HOME' => getenv('HOME') ?: '',
  'GITHUB_DELIVERY' => $_SERVER['HTTP_X_GITHUB_DELIVERY'] ?? '',
], $deployEnv);

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
